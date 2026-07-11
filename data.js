/*
 * Definición del álbum "Usa Mex Can".
 * Cada sección tiene un código interno único (id), una etiqueta visible (label),
 * un emoji y la lista de números de figuritas que la componen.
 *
 * Si algún rango no coincide con tu álbum, editá simplemente los arrays de abajo.
 * La app se adapta sola.
 */

// Helper: genera un rango inclusivo [a..b]
function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(String(i));
  return out;
}

// Secciones especiales de la introducción
const SPECIAL_SECTIONS = [
  { id: 'FWC_T', label: 'FWC', emoji: '🏆', stickers: ['00', '1', '2', '3', '4'] },
  { id: 'FWC_W', label: 'FWC', emoji: '🌎', stickers: range(5, 8) },
  { id: 'FWC_S', label: 'FWC', emoji: '📜', stickers: range(9, 19) },
];

// Selecciones nacionales (todas: figuritas 1 a 20, donde la 1 es el escudo)
const TEAMS = [
  { id: 'MEX', emoji: '🇲🇽' }, { id: 'RSA', emoji: '🇿🇦' }, { id: 'KOR', emoji: '🇰🇷' },
  { id: 'CZE', emoji: '🇨🇿' }, { id: 'CAN', emoji: '🇨🇦' }, { id: 'BIH', emoji: '🇧🇦' },
  { id: 'QAT', emoji: '🇶🇦' }, { id: 'SUI', emoji: '🇨🇭' }, { id: 'BRA', emoji: '🇧🇷' },
  { id: 'MAR', emoji: '🇲🇦' }, { id: 'HAI', emoji: '🇭🇹' }, { id: 'SCO', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: 'USA', emoji: '🇺🇸' }, { id: 'PAR', emoji: '🇵🇾' }, { id: 'AUS', emoji: '🇦🇺' },
  { id: 'TUR', emoji: '🇹🇷' }, { id: 'GER', emoji: '🇩🇪' }, { id: 'CUW', emoji: '🇨🇼' },
  { id: 'CIV', emoji: '🇨🇮' }, { id: 'ECU', emoji: '🇪🇨' }, { id: 'NED', emoji: '🇳🇱' },
  { id: 'JPN', emoji: '🇯🇵' }, { id: 'SWE', emoji: '🇸🇪' }, { id: 'TUN', emoji: '🇹🇳' },
  { id: 'BEL', emoji: '🇧🇪' }, { id: 'EGY', emoji: '🇪🇬' }, { id: 'IRN', emoji: '🇮🇷' },
  { id: 'NZL', emoji: '🇳🇿' }, { id: 'ESP', emoji: '🇪🇸' }, { id: 'CPV', emoji: '🇨🇻' },
  { id: 'KSA', emoji: '🇸🇦' }, { id: 'URU', emoji: '🇺🇾' }, { id: 'FRA', emoji: '🇫🇷' },
  { id: 'SEN', emoji: '🇸🇳' }, { id: 'IRQ', emoji: '🇮🇶' }, { id: 'NOR', emoji: '🇳🇴' },
  { id: 'ARG', emoji: '🇦🇷' }, { id: 'ALG', emoji: '🇩🇿' }, { id: 'AUT', emoji: '🇦🇹' },
  { id: 'JOR', emoji: '🇯🇴' }, { id: 'POR', emoji: '🇵🇹' }, { id: 'COD', emoji: '🇨🇩' },
  { id: 'UZB', emoji: '🇺🇿' }, { id: 'COL', emoji: '🇨🇴' }, { id: 'ENG', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'CRO', emoji: '🇭🇷' }, { id: 'GHA', emoji: '🇬🇭' }, { id: 'PAN', emoji: '🇵🇦' },
];

const TEAM_SECTIONS = TEAMS.map(t => ({
  id: t.id,
  label: t.id,
  emoji: t.emoji,
  stickers: range(1, 20),
}));

// Sección final de patrocinador (Coca-Cola): 14 figuritas y es OPCIONAL.
// Al marcarla como opcional, la app permite elegir (con un checkbox) si cuenta
// o no para los faltantes y el progreso total. Ajustá el rango si tu álbum difiere.
const CLOSING_SECTIONS = [
  { id: 'CC', label: 'CC', emoji: '🥤', stickers: range(1, 14), optional: true },
];

const ALBUM = [...SPECIAL_SECTIONS, ...TEAM_SECTIONS, ...CLOSING_SECTIONS];

const ALBUM_NAME = 'Usa Mex Can 26';

// Total de figuritas del álbum
const ALBUM_TOTAL = ALBUM.reduce((n, s) => n + s.stickers.length, 0);
