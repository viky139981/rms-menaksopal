function ok_(data, message) {
  return { success: true, message: message || 'OK', data: data === undefined ? null : data };
}

function fail_(message, code) {
  return { success: false, message: message || 'Terjadi kesalahan.', code: code || 'ERROR' };
}

function now_() {
  return new Date();
}

function formatDate_(value, format) {
  if (!value) return '';
  return Utilities.formatDate(new Date(value), APP.TIMEZONE, format || APP.DATETIME_FORMAT);
}

function normalize_(v) {
  return String(v == null ? '' : v).trim();
}

function uuid_(prefix) {
  const raw = Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
  return `${prefix}-${raw}`;
}

function newSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function hashPassword_(password, salt) {
  return sha256Hex_(`${salt}:${password}`);
}

function constantTimeEqual_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function randomPassword_(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  for (let i = 0; i < length; i++) {
    const v = bytes[i % bytes.length] < 0 ? bytes[i % bytes.length] + 256 : bytes[i % bytes.length];
    out += chars[v % chars.length];
  }
  return out;
}

function monthRoman_(month) {
  const map = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const n = Number(month);
  if (n < 1 || n > 12) throw new Error('Bulan tidak valid.');
  return map[n];
}

function cleanObject_(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => out[k] = typeof obj[k] === 'string' ? obj[k].trim() : obj[k]);
  return out;
}

function escapeHtml_(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function isValidIPv4_(ip) {
  if (!ip) return true;
  const parts = String(ip).trim().split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function isValidNIK_(nik) {
  if (!nik) return true;
  return /^\d{16}$/.test(String(nik).trim());
}

function assertRequired_(obj, fields) {
  fields.forEach(f => {
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '') {
      throw new Error(`Field ${f} wajib diisi.`);
    }
  });
}

function lower_(v) { return normalize_(v).toLowerCase(); }
function upper_(v) { return normalize_(v).toUpperCase(); }

function paginate_(rows, query) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(APP.MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || APP.DEFAULT_PAGE_SIZE)));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page: safePage,
    pageSize: pageSize,
    total: total,
    totalPages: totalPages
  };
}

function compareValues_(a, b, dir) {
  const d = String(dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  if (a == null && b == null) return 0;
  if (a == null) return -1 * d;
  if (b == null) return 1 * d;
  if (a instanceof Date && b instanceof Date) return (a - b) * d;
  return String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' }) * d;
}
