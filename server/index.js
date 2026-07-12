/* ===========================================================================
 * Figus Change Hub — servidor.
 * Sirve el sitio estático y expone una API mínima para publicar y listar
 * colecciones (el "muro de comunidad"), respaldadas en Postgres.
 * =========================================================================== */

import express from 'express';
import pg from 'pg';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const MAX_LIST = 200;
// Clave de administrador para la telemetría (menú de Admin). Si no está seteada,
// el panel de admin queda deshabilitado (responde 503).
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || '').trim();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 10,
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function initDb() {
  // Esperamos a que la BD esté lista (arranque de contenedores)
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    try { await pool.query('SELECT 1'); ready = true; }
    catch (e) { console.log(`[db] esperando a Postgres… (${i + 1})`); await sleep(2000); }
  }
  if (!ready) throw new Error('No se pudo conectar a la base de datos');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      edit_token  UUID NOT NULL DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL DEFAULT '',
      contact     TEXT NOT NULL DEFAULT '',
      album       TEXT NOT NULL DEFAULT '',
      data        JSONB NOT NULL DEFAULT '{}'::jsonb,
      stats       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS collections_updated_idx ON collections (updated_at DESC);`);
  console.log('[db] listo');
}

/* ---------- Validación ---------- */
function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function validData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  // { sectionId: { sticker: count } } — saneamos a números
  const out = {};
  for (const [sec, obj] of Object.entries(d)) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    const inner = {};
    for (const [st, n] of Object.entries(obj)) {
      const num = Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
      if (num > 0) inner[String(st).slice(0, 6)] = num;
    }
    if (Object.keys(inner).length) out[String(sec).slice(0, 16)] = inner;
  }
  return out;
}

/* ---------- Admin / Telemetría ---------- */
function num(v) { return Math.max(0, Math.floor(Number(v) || 0)); }

// Verifica la clave de admin del pedido (header x-admin-token) contra ADMIN_TOKEN.
// Devuelve true si pasa; si no, responde el error correspondiente y devuelve false.
function checkAdmin(req, res) {
  if (!ADMIN_TOKEN) { res.status(503).json({ error: 'admin_disabled' }); return false; }
  const given = String(req.get('x-admin-token') || '');
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_TOKEN);
  // Comparación en tiempo constante (evita filtrar el token por timing).
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) { res.status(401).json({ error: 'unauthorized' }); return false; }
  return true;
}

/* ---------- App ---------- */
const app = express();
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Telemetría del servidor (solo admin). Métricas agregadas de la comunidad.
app.get('/api/admin/telemetry', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const r = await pool.query(`SELECT album, stats, data, created_at, updated_at FROM collections`);
    const now = Date.now();
    const DAY = 86400000;
    let new24h = 0, new7d = 0, active7d = 0;
    const albums = new Map();      // nombre de álbum -> cantidad de listas
    const totals = { have: 0, need: 0, repe: 0 };
    const spare = new Map();       // "SECC #n" -> repetidas en circulación

    for (const row of r.rows) {
      const created = new Date(row.created_at).getTime();
      const updated = new Date(row.updated_at).getTime();
      if (now - created <= DAY) new24h++;
      if (now - created <= 7 * DAY) new7d++;
      if (now - updated <= 7 * DAY) active7d++;

      const album = (row.album || '').trim() || '(sin nombre)';
      albums.set(album, (albums.get(album) || 0) + 1);

      const s = row.stats || {};
      totals.have += num(s.have);
      totals.need += num(s.need);
      totals.repe += num(s.repe);

      const data = row.data || {};
      for (const [sec, obj] of Object.entries(data)) {
        if (!obj || typeof obj !== 'object') continue;
        for (const [st, n] of Object.entries(obj)) {
          const c = num(n);
          if (c >= 2) {
            const key = `${sec} #${st}`;
            spare.set(key, (spare.get(key) || 0) + (c - 1));
          }
        }
      }
    }

    const totalTracked = totals.have + totals.need;
    const avgCompletion = totalTracked ? totals.have / totalTracked : 0;
    const albumList = Array.from(albums.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const topSpare = Array.from(spare.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.json({
      collections: r.rowCount,
      new24h, new7d, active7d,
      totals, avgCompletion,
      albums: albumList,
      topSpare,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db' }); }
});

// Listar colecciones publicadas (para el muro de comunidad)
app.get('/api/collections', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, contact, album, data, stats, updated_at
         FROM collections ORDER BY updated_at DESC LIMIT $1`, [MAX_LIST]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'db' }); }
});

// Obtener una colección puntual
app.get('/api/collections/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, contact, album, data, stats, updated_at
         FROM collections WHERE id = $1`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(400).json({ error: 'bad_id' }); }
});

// Publicar
app.post('/api/collections', async (req, res) => {
  const data = validData(req.body.data);
  if (data === null) return res.status(400).json({ error: 'bad_data' });
  const name = clean(req.body.name, 60);
  const contact = clean(req.body.contact, 120);
  const album = clean(req.body.album, 60);
  const stats = (req.body.stats && typeof req.body.stats === 'object') ? req.body.stats : {};
  try {
    const r = await pool.query(
      `INSERT INTO collections (name, contact, album, data, stats)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, edit_token`,
      [name, contact, album, data, stats]);
    res.status(201).json({ id: r.rows[0].id, editToken: r.rows[0].edit_token });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db' }); }
});

// Actualizar (requiere editToken)
app.put('/api/collections/:id', async (req, res) => {
  const data = validData(req.body.data);
  if (data === null) return res.status(400).json({ error: 'bad_data' });
  const token = clean(req.body.editToken, 64);
  if (!token) return res.status(400).json({ error: 'missing_token' });
  const name = clean(req.body.name, 60);
  const contact = clean(req.body.contact, 120);
  const album = clean(req.body.album, 60);
  const stats = (req.body.stats && typeof req.body.stats === 'object') ? req.body.stats : {};
  try {
    const r = await pool.query(
      `UPDATE collections SET name=$1, contact=$2, album=$3, data=$4, stats=$5, updated_at=now()
        WHERE id=$6 AND edit_token=$7 RETURNING id`,
      [name, contact, album, data, stats, req.params.id, token]);
    if (!r.rowCount) return res.status(404).json({ error: 'not_found_or_forbidden' });
    res.json({ id: r.rows[0].id });
  } catch (e) { res.status(400).json({ error: 'bad_request' }); }
});

// Borrar (requiere editToken)
app.delete('/api/collections/:id', async (req, res) => {
  const token = clean(req.body && req.body.editToken, 64);
  if (!token) return res.status(400).json({ error: 'missing_token' });
  try {
    const r = await pool.query(
      `DELETE FROM collections WHERE id=$1 AND edit_token=$2`, [req.params.id, token]);
    if (!r.rowCount) return res.status(404).json({ error: 'not_found_or_forbidden' });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: 'bad_request' }); }
});

// Sitio estático
app.use(express.static(STATIC_DIR));

initDb()
  .then(() => app.listen(PORT, () => {
    console.log(`[web] escuchando en http://0.0.0.0:${PORT}`);
    console.log(`[admin] telemetría ${ADMIN_TOKEN ? 'habilitada' : 'deshabilitada (falta ADMIN_TOKEN)'}`);
  }))
  .catch(err => { console.error(err); process.exit(1); });
