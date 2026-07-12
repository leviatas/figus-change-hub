/* ===========================================================================
 * Figus Change Hub — app cliente (sin servidor).
 * Estado guardado en localStorage. Compartir/comparar vía enlace o texto.
 * =========================================================================== */

'use strict';

const STORE_KEY = 'fch:v1:counts';
const PROFILE_KEY = 'fch:v1:profile';
const UI_KEY = 'fch:v1:ui';

/* ---------- Estado ---------- */
// counts[sectionId][sticker] = cantidad que tenés (0 = falta, 1 = tengo, 2+ = repes)
let counts = load(STORE_KEY, {});
let profile = load(PROFILE_KEY, { name: '', contact: '' });
let ui = load(UI_KEY, { collapsed: {}, filter: 'all', search: '', countOptional: false });

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function persist() { save(STORE_KEY, counts); }

function getCount(sectionId, sticker) {
  return (counts[sectionId] && counts[sectionId][sticker]) || 0;
}
function setCount(sectionId, sticker, n) {
  if (!counts[sectionId]) counts[sectionId] = {};
  if (n <= 0) delete counts[sectionId][sticker];
  else counts[sectionId][sticker] = n;
  if (counts[sectionId] && Object.keys(counts[sectionId]).length === 0) delete counts[sectionId];
  persist();
}

/* ---------- Helpers de DOM ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function sectionById(id) { return ALBUM.find(s => s.id === id); }

/* ---------- Estadísticas ---------- */
// ¿Una sección cuenta para el total/faltantes? Las opcionales (ej.: Coca-Cola)
// solo cuentan si el usuario marcó el checkbox correspondiente.
function isCounted(section) {
  return !section.optional || !!ui.countOptional;
}

function stats() {
  let total = 0, have = 0, need = 0, repe = 0;
  for (const s of ALBUM) {
    if (!isCounted(s)) continue;
    for (const st of s.stickers) {
      total++;
      const c = getCount(s.id, st);
      if (c >= 1) have++; else need++;
      if (c >= 2) repe += (c - 1);
    }
  }
  return { total, have, need, repe };
}

function renderProgress() {
  const { total, have, need, repe } = stats();
  $('#prog-total').textContent = total;
  $('#prog-have').textContent = have;
  $('#prog-need').textContent = need;
  $('#prog-repe').textContent = repe;
  $('#prog-fill').style.width = total ? (100 * have / total).toFixed(1) + '%' : '0%';
}

/* ---------- Render del álbum ---------- */
function sectionStats(s) {
  let have = 0;
  for (const st of s.stickers) if (getCount(s.id, st) >= 1) have++;
  return { have, total: s.stickers.length };
}

function sectionComplete(s) {
  const { have, total } = sectionStats(s);
  return total > 0 && have === total;
}

// ¿La sección arranca colapsada? Si la persona ya la tocó (colapsó/expandió),
// respetamos su elección. Si nunca la tocó, por defecto las secciones completas
// arrancan colapsadas (así ves de una lo que te falta) y las demás, abiertas.
function isCollapsed(s) {
  if (s.id in ui.collapsed) return !!ui.collapsed[s.id];
  return sectionComplete(s);
}

function stickerClass(c) {
  if (c >= 2) return 'repe';
  if (c >= 1) return 'have';
  return 'missing';
}

function matchesFilter(c, filter) {
  if (filter === 'missing') return c === 0;
  if (filter === 'have') return c >= 1;
  if (filter === 'repe') return c >= 2;
  return true;
}

function renderAlbum() {
  const root = $('#album-root');
  const filter = ui.filter || 'all';
  const search = (ui.search || '').trim().toUpperCase();
  root.innerHTML = '';

  let anyShown = false;

  for (const s of ALBUM) {
    if (search && !(`${s.label} ${s.emoji} ${s.id}`.toUpperCase().includes(search))) continue;

    const visibleStickers = s.stickers.filter(st => matchesFilter(getCount(s.id, st), filter));
    if (filter !== 'all' && visibleStickers.length === 0) continue;

    anyShown = true;
    const ss = sectionStats(s);
    const collapsed = isCollapsed(s);

    const sec = document.createElement('div');
    sec.className = 'section' + (collapsed ? ' collapsed' : '');

    const head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = `
      <span class="emoji">${s.emoji}</span>
      <span class="name">${s.label}</span>
      <span class="count">
        <span class="mini-bar"><span class="mini-fill" style="width:${100*ss.have/ss.total}%"></span></span>
        <span class="sec-num">${ss.have}/${ss.total}</span>
        <span class="caret">▾</span>
      </span>`;
    head.addEventListener('click', () => {
      // Partimos del estado realmente visible (no del valor crudo guardado, que
      // puede ser undefined cuando la sección arranca colapsada por defecto).
      const next = !sec.classList.contains('collapsed');
      ui.collapsed[s.id] = next;
      save(UI_KEY, ui);
      sec.classList.toggle('collapsed', next);
    });
    sec.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'stickers';
    for (const st of s.stickers) {
      if (filter !== 'all' && !matchesFilter(getCount(s.id, st), filter)) continue;
      const c = getCount(s.id, st);
      const cell = document.createElement('div');
      cell.className = 'sticker ' + stickerClass(c);
      cell.textContent = st;
      if (c >= 2) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = '×' + c;
        cell.appendChild(b);
      }
      // Tap: sumar (0→1→2→3…). Long-press / click derecho: restar.
      cell.addEventListener('click', () => bumpSticker(s.id, st, +1, cell, sec, head));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); bumpSticker(s.id, st, -1, cell, sec, head); });
      let pressTimer = null;
      cell.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => { bumpSticker(s.id, st, -1, cell, sec, head); pressTimer = 'done'; }, 450);
      }, { passive: true });
      cell.addEventListener('touchend', (e) => {
        if (pressTimer === 'done') { e.preventDefault(); }
        clearTimeout(pressTimer); pressTimer = null;
      });
      grid.appendChild(cell);
    }
    sec.appendChild(grid);
    root.appendChild(sec);
  }

  if (!anyShown) {
    root.innerHTML = `<div class="empty">No hay figuritas que coincidan con este filtro.</div>`;
  }
}

function bumpSticker(sectionId, sticker, delta, cell, sec, head) {
  const cur = getCount(sectionId, sticker);
  let next = cur + delta;
  if (next < 0) next = 0;
  setCount(sectionId, sticker, next);

  // Actualización visual puntual (sin re-render completo, más ágil)
  cell.className = 'sticker ' + stickerClass(next);
  cell.querySelector('.badge')?.remove();
  if (next >= 2) {
    const b = document.createElement('span'); b.className = 'badge'; b.textContent = '×' + next; cell.appendChild(b);
  }
  // Si hay un filtro activo y la celda dejó de calificar, re-render
  const filter = ui.filter || 'all';
  if (filter !== 'all' && !matchesFilter(next, filter)) { renderAlbum(); }
  else {
    const s = sectionById(sectionId);
    const ss = sectionStats(s);
    head.querySelector('.mini-fill').style.width = (100*ss.have/ss.total) + '%';
    head.querySelector('.sec-num').textContent = `${ss.have}/${ss.total}`;
  }
  renderProgress();
}

/* ---------- Exportación de texto ---------- */
function listByKind(kind) {
  // kind: 'faltan' → count 0 ; 'repetidas' → count >=2
  const lines = [];
  for (const s of ALBUM) {
    // No pedimos como faltantes las de una sección opcional que no estás contando.
    if (kind === 'faltan' && !isCounted(s)) continue;
    const nums = [];
    for (const st of s.stickers) {
      const c = getCount(s.id, st);
      if (kind === 'faltan' && c === 0) nums.push(st);
      if (kind === 'repetidas' && c >= 2) nums.push(c >= 3 ? `${st} (x${c-1})` : st);
    }
    if (nums.length) lines.push(`${s.label} ${s.emoji}: ${nums.join(', ')}`);
  }
  return lines;
}

function buildExport(kind) {
  const header = `Intercambio de Figuritas\n${ALBUM_NAME}`;
  if (kind === 'ambas') {
    const faltan = listByKind('faltan');
    const repes = listByKind('repetidas');
    let out = header + '\n\nMe faltan\n' + (faltan.length ? faltan.join('\n') : '(ninguna, álbum completo 🎉)');
    out += '\n\nRepetidas\n' + (repes.length ? repes.join('\n') : '(ninguna)');
    return out;
  }
  const title = kind === 'faltan' ? 'Me faltan' : 'Repetidas';
  const list = listByKind(kind);
  return `${header}\n\n${title}\n` + (list.length ? list.join('\n') : '(ninguna)');
}

let currentExportKind = 'faltan';
function renderExport() {
  $('#export-text').textContent = buildExport(currentExportKind);
}

/* ---------- Compartir vía enlace ---------- */
function encodeState() {
  const payload = {
    v: 1,
    n: profile.name || '',
    c: profile.contact || '',
    a: ALBUM_NAME,
    d: counts, // { sectionId: { sticker: count } }
  };
  const json = JSON.stringify(payload);
  return b64EncodeUnicode(json);
}
function buildShareLink() {
  const base = location.origin + location.pathname;
  return base + '#col=' + encodeState();
}
function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

function parseIncoming(text) {
  // Devuelve { name, contact, album, counts } o null.
  text = (text || '').trim();
  if (!text) return null;

  // 1) ¿Enlace o token base64 (#col=...)?
  let token = null;
  const m = text.match(/[#?&]col=([^\s&]+)/);
  if (m) token = m[1];
  else if (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 40) token = text;

  if (token) {
    try {
      const obj = JSON.parse(b64DecodeUnicode(token));
      if (obj && obj.d) return { name: obj.n || '', contact: obj.c || '', album: obj.a || '', counts: obj.d };
    } catch (e) { /* sigue al parser de texto */ }
  }

  // 2) Parser de texto plano ("Me faltan / Repetidas" o "I need / Swaps")
  return parseTextList(text);
}

// Mapa emoji/label -> sectionId (para reconocer listas pegadas como texto)
function buildLabelIndex() {
  const idx = {};
  ALBUM.forEach(s => {
    idx[`${s.label} ${s.emoji}`] = s.id;
    idx[s.label + s.emoji] = s.id;
  });
  return idx;
}

function parseTextList(text) {
  const lines = text.split(/\r?\n/);
  const result = { name: '', contact: '', album: '', counts: {} };
  // Sección "modo": lo que trae el otro. Interpretamos su lista de repetidas
  // como cosas que puede DAR, y sus faltantes como cosas que NECESITA.
  // Guardamos con convención: count 0 = falta, count 2 = repe (una).
  let mode = null; // 'faltan' | 'repetidas'
  const teamCodes = ALBUM.map(s => s.id);

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const low = line.toLowerCase();
    if (/(^|\s)(me faltan|i need|faltan)(\s|$)/.test(low)) { mode = 'faltan'; continue; }
    if (/(^|\s)(repetidas|swaps|repes)(\s|$)/.test(low)) { mode = 'repetidas'; continue; }

    // línea de datos: "CODE emoji: n, n, n"
    const cm = line.match(/^([A-Za-z]{2,4})\s*[^\d:]*:\s*(.+)$/);
    if (cm && mode) {
      const code = cm[1].toUpperCase();
      // FWC aparece 3 veces con distinto emoji: intentamos deducir por emoji
      let sid = null;
      if (code === 'FWC') {
        if (line.includes('🏆')) sid = 'FWC_T';
        else if (line.includes('🌎') || line.includes('🌍')) sid = 'FWC_W';
        else sid = 'FWC_S';
      } else if (teamCodes.includes(code)) sid = code;
      if (!sid) continue;
      const items = cm[2].split(',').map(x => x.trim()).filter(Boolean);
      if (!result.counts[sid]) result.counts[sid] = {};
      for (const item of items) {
        // "5" o "5 (x2)" (x2 = dos repes → count 3)
        const im = item.match(/(\d+)\s*(?:\(x(\d+)\))?/);
        if (!im) continue;
        const n = im[1];
        if (mode === 'repetidas') {
          const repes = im[2] ? Math.max(1, parseInt(im[2], 10)) : 1;
          result.counts[sid][n] = repes + 1;
        } else {
          result.counts[sid][n] = 0;
        }
      }
    }
  }
  const hasData = Object.keys(result.counts).length > 0;
  return hasData ? result : null;
}

/* ---------- Importación a tu propio álbum ---------- */
// Igual que parseIncoming, pero distingue el origen para poder reconstruir
// el álbum correctamente (un enlace/respaldo es una foto completa; una lista
// de texto solo trae faltantes/repetidas).
function parseForImport(text) {
  text = (text || '').trim();
  if (!text) return null;

  // Enlace o token base64 (#col=...) → foto completa
  let token = null;
  const m = text.match(/[#?&]col=([^\s&]+)/);
  if (m) token = m[1];
  else if (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 40) token = text;
  if (token) {
    try {
      const obj = JSON.parse(b64DecodeUnicode(token));
      if (obj && obj.d) return { kind: 'snapshot', name: obj.n || '', contact: obj.c || '', album: obj.a || '', counts: obj.d };
    } catch (e) { /* seguimos */ }
  }

  // Respaldo JSON { counts, profile, album }
  if (/^\s*\{/.test(text)) {
    try {
      const obj = JSON.parse(text);
      if (obj && obj.counts && typeof obj.counts === 'object' && !Array.isArray(obj.counts)) {
        return {
          kind: 'snapshot',
          name: (obj.profile && obj.profile.name) || '',
          contact: (obj.profile && obj.profile.contact) || '',
          album: obj.album || '',
          counts: obj.counts,
        };
      }
    } catch (e) { /* no era JSON válido */ }
  }

  // Lista de texto (Me faltan / Repetidas)
  const list = parseTextList(text);
  if (list) return { kind: 'textlist', name: list.name, contact: list.contact, album: list.album, counts: list.counts };
  return null;
}

// Devuelve el objeto counts resultante de importar `parsed` con el modo dado.
function importedCounts(parsed, mode) {
  const clone = o => JSON.parse(JSON.stringify(o || {}));

  if (parsed.kind === 'snapshot') {
    if (mode === 'replace') return clone(parsed.counts);
    const base = clone(counts);
    for (const sid in parsed.counts) {
      base[sid] = base[sid] || {};
      for (const st in parsed.counts[sid]) base[sid][st] = parsed.counts[sid][st];
    }
    return base;
  }

  // textlist
  const p = parsed.counts;
  if (mode === 'replace') {
    // Reconstruimos el álbum completo: todo "la tengo" salvo lo que aparezca
    // listado como faltante (0) o repetida (>=2).
    const base = {};
    for (const s of ALBUM) {
      for (const st of s.stickers) {
        const v = p[s.id] && p[s.id][st];
        let val;
        if (v === 0) val = 0;
        else if (v >= 2) val = v;
        else val = 1;
        if (val > 0) { base[s.id] = base[s.id] || {}; base[s.id][st] = val; }
      }
    }
    return base;
  }

  // merge de lista de texto sobre lo actual
  const base = clone(counts);
  for (const sid in p) {
    for (const st in p[sid]) {
      const v = p[sid][st];
      if (v === 0) { if (base[sid]) delete base[sid][st]; }
      else { base[sid] = base[sid] || {}; base[sid][st] = v; }
    }
  }
  return base;
}

function statsFor(cts) {
  let total = 0, have = 0, need = 0, repe = 0;
  for (const s of ALBUM) for (const st of s.stickers) {
    total++;
    const c = (cts[s.id] && cts[s.id][st]) || 0;
    if (c >= 1) have++; else need++;
    if (c >= 2) repe += (c - 1);
  }
  return { total, have, need, repe };
}

let importMode = 'merge';

function renderImportPreview(parsed) {
  const el = $('#import-preview');
  if (!parsed) {
    el.innerHTML = `<div class="empty">No pude leer esa lista o enlace. Pegá tu enlace del hub o el texto que genera Exportar.</div>`;
    return null;
  }
  const next = importedCounts(parsed, importMode);
  const before = stats();
  const after = statsFor(next);
  let changed = 0;
  for (const s of ALBUM) for (const st of s.stickers) {
    const a = getCount(s.id, st);
    const b = (next[s.id] && next[s.id][st]) || 0;
    if (a !== b) changed++;
  }
  const src = parsed.kind === 'snapshot' ? 'enlace / respaldo' : 'lista de texto';
  el.innerHTML = `
    <div class="import-preview-box">
      <div class="ipv-title">Vista previa · ${escapeHtml(src)}${parsed.album ? ' · ' + escapeHtml(parsed.album) : ''}</div>
      <div class="ipv-row"><span>La tengo</span><b>${before.have} → ${after.have}</b></div>
      <div class="ipv-row"><span>Me faltan</span><b>${before.need} → ${after.need}</b></div>
      <div class="ipv-row"><span>Repetidas</span><b>${before.repe} → ${after.repe}</b></div>
      <div class="ipv-row total"><span>Figuritas que cambian</span><b>${changed}</b></div>
    </div>`;
  return next;
}

function applyImport(next) {
  if (!next) return;
  counts = next;
  for (const sid in counts) {
    if (counts[sid] && Object.keys(counts[sid]).length === 0) delete counts[sid];
  }
  persist();
  renderProgress();
  renderAlbum();
  toast('✅ Lista importada a tu álbum', true);
}

/* ---------- Comparación / intercambios ---------- */
function computeTrades(other) {
  // "Doy": tengo repes (count>=2) y la otra persona la necesita (count 0)
  // "Recibo": me falta (count 0) y la otra persona la tiene repe (count>=2)
  //   Si la lista del otro vino como texto de faltantes/repes usamos esa convención.
  const give = [];
  const get = [];
  for (const s of ALBUM) {
    for (const st of s.stickers) {
      const mine = getCount(s.id, st);
      const theirs = (other.counts[s.id] && other.counts[s.id][st]) || 0;
      const theyNeed = theirs === 0;
      const theyHaveSpare = theirs >= 2;
      if (mine >= 2 && theyNeed) give.push({ s, st });
      if (mine === 0 && theyHaveSpare) get.push({ s, st });
    }
  }
  return { give, get };
}

function groupBySection(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.s.id)) map.set(it.s.id, { s: it.s, nums: [] });
    map.get(it.s.id).nums.push(it.st);
  }
  return Array.from(map.values());
}

function renderMatches(other) {
  const root = $('#match-root');
  const { give, get } = computeTrades(other);
  const who = other.name ? other.name : 'la otra persona';

  let html = '';

  if (other.name || other.contact) {
    html += `<div class="contact-card">
      <div class="who">👤 ${escapeHtml(other.name || 'Sin nombre')}</div>
      ${other.contact ? `<div class="ct">Contacto: ${linkifyContact(other.contact)}</div>` : ''}
      ${other.album ? `<div class="ct">Álbum: ${escapeHtml(other.album)}</div>` : ''}
    </div>`;
  }

  const swaps = Math.min(give.length, get.length);
  if (give.length || get.length) {
    html += `<div class="swap-headline">🔄 Podés cambiar <b>${swaps}</b> figurita${swaps === 1 ? '' : 's'} con ${escapeHtml(who)}` +
      `${swaps < Math.max(give.length, get.length) ? ` <span style="color:var(--muted)">(cambio parejo, 1 por 1)</span>` : ''}.</div>`;
  }

  if (!give.length && !get.length) {
    html += `<div class="empty">No encontramos intercambios posibles con ${escapeHtml(who)} por ahora. 🙈<br>Puede que necesiten actualizar sus listas.</div>`;
    root.innerHTML = html;
    showMatches();
    return;
  }

  html += `<div class="match-block get">
    <h3>📥 Le pedís a ${escapeHtml(who)} <span class="tag get">${get.length}</span></h3>`;
  if (get.length) {
    html += groupBySection(get).map(g =>
      `<div style="margin-bottom:8px"><b>${g.s.label} ${g.s.emoji}</b><div class="match-list">${
        g.nums.map(n => `<span class="match-item"><b>${n}</b></span>`).join('')
      }</div></div>`).join('');
  } else html += `<div class="empty" style="padding:8px">No te falta nada que le sobre.</div>`;
  html += `</div>`;

  html += `<div class="match-block give">
    <h3>📤 Le das a ${escapeHtml(who)} <span class="tag give">${give.length}</span></h3>`;
  if (give.length) {
    html += groupBySection(give).map(g =>
      `<div style="margin-bottom:8px"><b>${g.s.label} ${g.s.emoji}</b><div class="match-list">${
        g.nums.map(n => `<span class="match-item"><b>${n}</b></span>`).join('')
      }</div></div>`).join('');
  } else html += `<div class="empty" style="padding:8px">No te sobra nada que necesite.</div>`;
  html += `</div>`;

  root.innerHTML = html;
  showMatches();
  toast(`✅ ${give.length + get.length} coincidencias con ${who}`, true);
}

function showMatches() {
  switchTab('trade');
  setTimeout(() => $('#match-root').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function linkifyContact(c) {
  const safe = escapeHtml(c);
  const digits = c.replace(/[^\d]/g, '');
  if (/^\+?\d[\d\s\-]{6,}$/.test(c) && digits.length >= 8) {
    return `<a href="https://wa.me/${digits}" target="_blank" rel="noopener">${safe}</a>`;
  }
  if (/^\S+@\S+\.\S+$/.test(c)) return `<a href="mailto:${safe}">${safe}</a>`;
  return safe;
}

/* ---------- Enlace entrante (alguien abrió tu link) ---------- */
function checkIncomingUrl() {
  const m = location.hash.match(/col=([^&]+)/);
  if (!m) return;
  const parsed = parseIncoming(location.hash);
  if (!parsed) return;
  // Mostrar aviso NO intrusivo (banner discreto), no un popup.
  const notice = $('#notice');
  const who = parsed.name || 'alguien';
  const { give, get } = computeTrades(parsed);
  notice.innerHTML = `
    <span>📩 <b>${escapeHtml(who)}</b> compartió su álbum con vos.
    ${(give.length+get.length) ? `Hay <b>${give.length+get.length}</b> figuritas para cambiar.` : 'Compará para ver si hay cambios.'}</span>
    <button class="btn primary" id="notice-see" style="padding:7px 12px">Ver intercambios</button>
    <span class="x" id="notice-x" title="Cerrar">✕</span>`;
  notice.classList.add('show');
  $('#notice-see').addEventListener('click', () => {
    $('#compare-in').value = location.href;
    renderMatches(parsed);
    notice.classList.remove('show');
  });
  $('#notice-x').addEventListener('click', () => {
    notice.classList.remove('show');
    history.replaceState(null, '', location.pathname);
  });
}

/* ---------- Toast (no intrusivo) ---------- */
function toast(msg, good) {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (good ? ' good' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------- Compartir/copiar ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('📋 Copiado', true); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); toast('📋 Copiado', true); } catch { toast('No se pudo copiar'); }
    ta.remove();
  }
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
  copyText(text);
}

/* ---------- Comunidad (modo en línea: requiere servidor + BD) ---------- */
const ONLINE = location.protocol === 'http:' || location.protocol === 'https:';
const PUBLISH_KEY = 'fch:v1:published';

async function apiHealth() {
  try { const r = await fetch('api/health', { cache: 'no-store' }); return r.ok; }
  catch { return false; }
}

async function publishMine() {
  if (!profile.name && !profile.contact) {
    toast('Cargá tu nombre o contacto antes de publicar');
    return;
  }
  const payload = { name: profile.name || '', contact: profile.contact || '', album: ALBUM_NAME, data: counts, stats: stats() };
  const pub = load(PUBLISH_KEY, null);
  try {
    let res;
    if (pub && pub.id) {
      res = await fetch('api/collections/' + pub.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, editToken: pub.editToken }),
      });
      if (res.status === 404) { // fue borrada: republicar
        res = await fetch('api/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    } else {
      res = await fetch('api/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    if (!res.ok) throw new Error('bad');
    const body = await res.json();
    if (body.id) save(PUBLISH_KEY, { id: body.id, editToken: body.editToken || (pub && pub.editToken) });
    $('#unpublish-btn').style.display = '';
    toast('📢 Tu lista está publicada', true);
    loadCommunity();
  } catch { toast('No se pudo publicar 😕'); }
}

async function unpublishMine() {
  const pub = load(PUBLISH_KEY, null);
  if (!pub) return;
  try {
    await fetch('api/collections/' + pub.id, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editToken: pub.editToken }),
    });
    localStorage.removeItem(PUBLISH_KEY);
    $('#unpublish-btn').style.display = 'none';
    toast('Publicación eliminada', true);
    loadCommunity();
  } catch { toast('No se pudo quitar'); }
}

async function loadCommunity() {
  const listEl = $('#community-list');
  listEl.innerHTML = '<div class="empty">Cargando…</div>';
  let rows;
  try { rows = await (await fetch('api/collections', { cache: 'no-store' })).json(); }
  catch { listEl.innerHTML = '<div class="empty">No se pudo cargar la comunidad.</div>'; return; }

  const pub = load(PUBLISH_KEY, null);
  const others = rows.filter(r => !(pub && r.id === pub.id));
  if (!others.length) {
    listEl.innerHTML = '<div class="empty">Todavía no hay otras listas publicadas.<br>¡Publicá la tuya y avisá a tus conocidos! 🙌</div>';
    return;
  }

  // Calculamos automáticamente el potencial de cambio con cada persona.
  // swaps = min(le das, te da) → cantidad de cambios figu-por-figu posibles.
  const ranked = others.map(r => {
    const other = { name: r.name, contact: r.contact, album: r.album, counts: r.data };
    const { give, get } = computeTrades(other);
    return { r, other, give: give.length, get: get.length, swaps: Math.min(give.length, get.length) };
  }).sort((a, b) =>
    b.swaps - a.swaps || (b.give + b.get) - (a.give + a.get) || a.r.name.localeCompare(b.r.name)
  );

  // Mostramos SOLO personas con las que hay un intercambio real (le das algo y te da algo)
  const withSwaps = ranked.filter(x => x.swaps > 0);
  const totalSwaps = withSwaps.reduce((n, x) => n + x.swaps, 0);

  if (!withSwaps.length) {
    listEl.innerHTML = `<div class="empty">Por ahora no hay nadie con quien puedas hacer un cambio figu-por-figu.<br>Probá más tarde o avisá a más gente para que publiquen su lista. 🙌</div>`;
    return;
  }

  const summary = `<div class="community-summary">🔄 Podés hacer <b>${totalSwaps}</b> cambio(s) con <b>${withSwaps.length}</b> persona(s).</div>`;

  listEl.innerHTML = summary + withSwaps.map(({ r, give, get, swaps }) => {
    return `<div class="match-block get" style="cursor:pointer" data-id="${r.id}">
      <h3>👤 ${escapeHtml(r.name || 'Sin nombre')} <span class="tag get">🔄 ${swaps} cambio${swaps > 1 ? 's' : ''}</span></h3>
      <div class="ct" style="font-size:.82rem;margin-bottom:4px">
        📤 Le das <b>${give}</b> que necesita · 📥 Te da <b>${get}</b> que te falta
      </div>
      ${r.contact ? `<div class="ct" style="font-size:.82rem">📇 ${linkifyContact(r.contact)}</div>` : '<div class="ct" style="font-size:.78rem;color:var(--muted)">Sin contacto cargado</div>'}
      <div class="ct" style="color:var(--muted);font-size:.75rem;margin-top:6px">Tocá para ver qué figuritas son →</div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-id]').forEach(el => {
    // No dispares el detalle si tocaron el link de contacto
    el.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const item = ranked.find(x => x.r.id === el.dataset.id);
      renderMatches(item.other);
    });
  });

  if (totalSwaps) toast(`🔔 ${totalSwaps} cambio(s) posibles con ${withSwaps.length} persona(s)`, true);
}

/* ---------- Admin · Telemetría ---------- */
// Se accede tocando la versión en el pie. Pide la clave (ADMIN_TOKEN del .env)
// y muestra métricas agregadas de la comunidad servidas por /api/admin/telemetry.
const ADMIN_TOKEN_KEY = 'fch:v1:adminToken';

function openAdmin() {
  const ov = $('#admin-overlay');
  ov.classList.remove('hidden');
  if (!ONLINE) {
    $('#admin-body').innerHTML = `<div class="empty">La telemetría de admin requiere el servidor con base de datos. Abrí la app desde el servidor, no como archivo local.</div>`;
    return;
  }
  const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (saved) loadTelemetry(saved);
  else renderAdminLogin();
}
function closeAdmin() { $('#admin-overlay').classList.add('hidden'); }

function renderAdminLogin(msg) {
  $('#admin-body').innerHTML = `
    <p class="hint">Ingresá la clave de administrador (<code>ADMIN_TOKEN</code>) para ver la telemetría del servidor.</p>
    <div class="field">
      <input id="admin-token-in" type="password" placeholder="Clave de admin" autocomplete="off" />
    </div>
    ${msg ? `<p class="admin-error">${escapeHtml(msg)}</p>` : ''}
    <button class="btn primary block" id="admin-login-btn">Entrar</button>`;
  $('#admin-login-btn').addEventListener('click', () => {
    const t = $('#admin-token-in').value.trim();
    if (t) loadTelemetry(t);
  });
  $('#admin-token-in').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#admin-login-btn').click();
  });
  setTimeout(() => $('#admin-token-in')?.focus(), 50);
}

async function loadTelemetry(token) {
  $('#admin-body').innerHTML = `<div class="empty">Cargando telemetría…</div>`;
  let res;
  try {
    res = await fetch('api/admin/telemetry', { headers: { 'x-admin-token': token }, cache: 'no-store' });
  } catch { renderAdminLogin('No se pudo conectar con el servidor.'); return; }
  if (res.status === 401) { sessionStorage.removeItem(ADMIN_TOKEN_KEY); renderAdminLogin('Clave incorrecta.'); return; }
  if (res.status === 503) { sessionStorage.removeItem(ADMIN_TOKEN_KEY); renderAdminLogin('La telemetría no está configurada en el servidor (falta ADMIN_TOKEN).'); return; }
  if (!res.ok) { renderAdminLogin('Error del servidor al obtener la telemetría.'); return; }
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  try { renderTelemetry(await res.json()); }
  catch { renderAdminLogin('No se pudo leer la respuesta del servidor.'); }
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('es-AR'); } catch { return iso; }
}

function renderTelemetry(t) {
  const pct = ((t.avgCompletion || 0) * 100).toFixed(1);
  const totals = t.totals || { have: 0, need: 0, repe: 0 };
  const albums = (t.albums || []).map(a =>
    `<div class="tele-row"><span>${escapeHtml(a.name)}</span><b>${a.count}</b></div>`).join('')
    || '<div class="empty" style="padding:12px">Sin listas publicadas todavía.</div>';
  const spare = (t.topSpare || []).map(s =>
    `<div class="tele-row"><span>${escapeHtml(s.key)}</span><b>×${s.count}</b></div>`).join('')
    || '<div class="empty" style="padding:12px">Nadie cargó repetidas todavía.</div>';

  $('#admin-body').innerHTML = `
    <div class="tele-grid">
      <div class="tele-tile"><div class="tele-num">${t.collections}</div><div class="tele-lbl">Listas publicadas</div></div>
      <div class="tele-tile"><div class="tele-num">${t.active7d}</div><div class="tele-lbl">Activas (7 días)</div></div>
      <div class="tele-tile"><div class="tele-num">${t.new24h}</div><div class="tele-lbl">Nuevas (24 h)</div></div>
      <div class="tele-tile"><div class="tele-num">${t.new7d}</div><div class="tele-lbl">Nuevas (7 días)</div></div>
      <div class="tele-tile"><div class="tele-num">${totals.have}</div><div class="tele-lbl">Figuritas pegadas</div></div>
      <div class="tele-tile"><div class="tele-num">${totals.repe}</div><div class="tele-lbl">Repes en circulación</div></div>
      <div class="tele-tile"><div class="tele-num">${totals.need}</div><div class="tele-lbl">Faltantes totales</div></div>
      <div class="tele-tile"><div class="tele-num">${pct}%</div><div class="tele-lbl">Completado promedio</div></div>
    </div>
    <div class="tele-sec"><h3>Álbumes</h3>${albums}</div>
    <div class="tele-sec"><h3>Top repes en circulación</h3>${spare}</div>
    <div class="tele-ts">Generado ${escapeHtml(fmtDate(t.generatedAt))}</div>
    <div class="tele-foot">
      <button class="btn" id="admin-refresh">↻ Actualizar</button>
      <button class="btn ghost" id="admin-logout">Cerrar sesión</button>
    </div>`;
  $('#admin-refresh').addEventListener('click', () => {
    const tok = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (tok) loadTelemetry(tok);
  });
  $('#admin-logout').addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    renderAdminLogin();
  });
}

/* ---------- Navegación por tabs ---------- */
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-content').forEach(c => c.classList.add('hidden'));
  $('#tab-' + name).classList.remove('hidden');
  if (name === 'export') renderExport();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- PWA: service worker + instalación ---------- */
let deferredInstallPrompt = null;

function setupPWA() {
  // Registrar el service worker (solo con http/https; no en file://)
  if ('serviceWorker' in navigator && ONLINE) {
    window.addEventListener('load', () => {
      // Auto-actualización: cuando el SW nuevo toma control (skipWaiting +
      // clients.claim), recargamos una sola vez para servir los assets frescos.
      // En la primera instalación no había controlador, así que no recargamos.
      // Esto evita quedar atrapado con un app.js viejo cacheado: no depende de
      // que la persona toque ningún botón.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !hadController) return;
        reloaded = true;
        window.location.reload();
      });

      // La versión (fuente única) está escrita a mano en el pie de index.html.
      // La leemos del DOM y la pasamos en la URL del SW: así, cada release cambia
      // la URL del script y el navegador SIEMPRE detecta el SW nuevo (aunque
      // sw.js no cambie byte a byte). El propio sw.js lee esa versión del ?v=.
      const version = ($('#app-version')?.textContent || '').trim().replace(/^v/i, '');
      const swUrl = 'sw.js' + (version ? '?v=' + encodeURIComponent(version) : '');
      navigator.serviceWorker.register(swUrl).catch(() => {});
    });
  }

  const btn = $('#install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btn) btn.style.display = '';
  });
  if (btn) btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) { toast('Usá el menú del navegador para instalar 📲'); return; }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch {}
    deferredInstallPrompt = null;
    btn.style.display = 'none';
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (btn) btn.style.display = 'none';
    toast('🎉 App instalada', true);
  });

  // Si ya está corriendo instalada, aclaramos la ayuda.
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) {
    const help = $('#install-help');
    if (help) help.textContent = 'Ya estás usando la app instalada. 🎉';
  }
}

/* ---------- Init & eventos ---------- */
function init() {
  $('#album-name').textContent = ALBUM_NAME;
  // (La versión ya está escrita a mano en el pie de index.html; no la tocamos.)
  // Perfil
  $('#profile-name').value = profile.name || '';
  $('#profile-contact').value = profile.contact || '';
  // Filtro / search restaurados
  $('#search').value = ui.search || '';
  $$('.chip-filter').forEach(c => c.classList.toggle('active', c.dataset.filter === (ui.filter || 'all')));

  // Checkbox de secciones opcionales (ej.: Coca-Cola): solo aparece si el
  // álbum tiene alguna sección marcada como opcional.
  const optToggle = $('#opt-toggle');
  const optCheck = $('#count-optional');
  if (ALBUM.some(s => s.optional)) {
    optToggle.hidden = false;
    optCheck.checked = !!ui.countOptional;
    optCheck.addEventListener('change', () => {
      ui.countOptional = optCheck.checked;
      save(UI_KEY, ui);
      renderProgress();
      renderExport();
    });
  }

  renderProgress();
  renderAlbum();

  // Tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Filtros
  $$('.chip-filter').forEach(c => c.addEventListener('click', () => {
    ui.filter = c.dataset.filter; save(UI_KEY, ui);
    $$('.chip-filter').forEach(x => x.classList.toggle('active', x === c));
    renderAlbum();
  }));

  // Búsqueda
  let searchT;
  $('#search').addEventListener('input', e => {
    ui.search = e.target.value; save(UI_KEY, ui);
    clearTimeout(searchT); searchT = setTimeout(renderAlbum, 120);
  });

  // Colapsar todo / expandir todo
  $('#collapse-all').addEventListener('click', () => {
    const anyOpen = ALBUM.some(s => !isCollapsed(s));
    ALBUM.forEach(s => ui.collapsed[s.id] = anyOpen);
    save(UI_KEY, ui);
    $('#collapse-all').textContent = anyOpen ? 'Expandir todo' : 'Colapsar todo';
    renderAlbum();
  });

  // Export segmented
  $$('#export-seg .seg-btn').forEach(b => b.addEventListener('click', () => {
    currentExportKind = b.dataset.kind;
    $$('#export-seg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    renderExport();
  }));
  $('#copy-btn').addEventListener('click', () => copyText(buildExport(currentExportKind)));
  $('#download-btn').addEventListener('click', () =>
    downloadFile(`figuritas-${currentExportKind}.txt`, buildExport(currentExportKind)));
  $('#share-text-btn').addEventListener('click', () => shareText(buildExport(currentExportKind)));

  // Generar enlace
  $('#gen-link-btn').addEventListener('click', () => {
    const link = buildShareLink();
    $('#link-out').value = link;
    $('#link-field-wrap').style.display = 'block';
    copyText(link);
  });

  // Respaldo
  $('#backup-btn').addEventListener('click', () =>
    downloadFile('figus-respaldo.json', JSON.stringify({ counts, profile, album: ALBUM_NAME }, null, 2), 'application/json'));
  $('#restore-btn').addEventListener('click', () => $('#restore-file').click());
  $('#restore-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (obj.counts) { counts = obj.counts; persist(); }
        if (obj.profile) { profile = obj.profile; save(PROFILE_KEY, profile); $('#profile-name').value = profile.name||''; $('#profile-contact').value = profile.contact||''; }
        renderProgress(); renderAlbum();
        toast('✅ Respaldo restaurado', true);
      } catch { toast('Archivo inválido'); }
    };
    reader.readAsText(file);
  });

  // Importar a tu propio álbum
  const importHints = {
    merge: 'Combina lo que pegás con lo que ya tenías marcado, sin borrar el resto.',
    replace: 'Reemplaza todo tu álbum: lo listado en "me faltan" queda como faltante, lo de "repetidas" como repetida y el resto como "la tengo".',
  };
  $$('#import-mode-seg .seg-btn').forEach(b => b.addEventListener('click', () => {
    importMode = b.dataset.mode;
    $$('#import-mode-seg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    $('#import-mode-hint').textContent = importHints[importMode] || '';
    if ($('#import-in').value.trim()) renderImportPreview(parseForImport($('#import-in').value));
  }));
  $('#import-preview-btn').addEventListener('click', () =>
    renderImportPreview(parseForImport($('#import-in').value)));
  $('#import-apply-btn').addEventListener('click', () => {
    const parsed = parseForImport($('#import-in').value);
    if (!parsed) { renderImportPreview(parsed); toast('No pude leer esa lista o enlace 🤔'); return; }
    applyImport(renderImportPreview(parsed));
  });
  $('#import-file-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      const parsed = parseForImport(raw);
      if (!parsed) { toast('No pude leer ese archivo 🤔'); return; }
      // Mostramos el texto pegado salvo que sea un respaldo JSON (poco legible).
      $('#import-in').value = /\.json$/i.test(file.name) ? '' : raw;
      applyImport(renderImportPreview(parsed));
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Perfil guardar
  $('#save-profile').addEventListener('click', () => {
    profile.name = $('#profile-name').value.trim();
    profile.contact = $('#profile-contact').value.trim();
    save(PROFILE_KEY, profile);
    toast('✅ Datos guardados', true);
  });

  // Comparar
  $('#compare-btn').addEventListener('click', () => {
    const parsed = parseIncoming($('#compare-in').value);
    if (!parsed) { toast('No pude leer esa lista o enlace 🤔'); return; }
    renderMatches(parsed);
  });

  // Comunidad (solo si hay servidor detrás)
  if (ONLINE) {
    $('#publish-btn').addEventListener('click', publishMine);
    $('#refresh-community').addEventListener('click', loadCommunity);
    $('#unpublish-btn').addEventListener('click', unpublishMine);
    apiHealth().then(ok => {
      if (!ok) return;
      $('#community-panel').style.display = '';
      if (load(PUBLISH_KEY, null)) $('#unpublish-btn').style.display = '';
      loadCommunity();
    });
  }

  // Menú de Admin: se abre tocando la versión del pie.
  const verEl = $('#app-version');
  if (verEl) {
    verEl.style.cursor = 'pointer';
    verEl.title = 'Admin';
    verEl.addEventListener('click', openAdmin);
  }
  $('#admin-close').addEventListener('click', closeAdmin);
  $('#admin-overlay').addEventListener('click', e => { if (e.target.id === 'admin-overlay') closeAdmin(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#admin-overlay').classList.contains('hidden')) closeAdmin();
  });

  checkIncomingUrl();
  setupPWA();
}

document.addEventListener('DOMContentLoaded', init);
