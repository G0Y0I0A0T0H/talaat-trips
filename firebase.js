// ============================================================
//  طلعت — Firebase Configuration & Shared Utilities
//  Replace values below with your Firebase project config.
//  Console → Add Web App → Copy firebaseConfig
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCuPPl4QU6_8qrody7YjzKzbbbWf04JBJ8",
  authDomain: "tripflow-app-8df8a.firebaseapp.com",
  databaseURL: "https://tripflow-app-8df8a-default-rtdb.firebaseio.com",
  projectId: "tripflow-app-8df8a",
  storageBucket: "tripflow-app-8df8a.firebasestorage.app",
  messagingSenderId: "888270159468",
  appId: "1:888270159468:web:8b97cf5e713760a328a249",
  measurementId: "G-B692K88CJN"
};

try {
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.database();
  window.FIREBASE_READY = true;
  console.log('✅ Firebase connected');
} catch (e) {
  window.FIREBASE_READY = false;
  window.db = null;
  console.warn('Firebase init failed, using local mode:', e.message);
}

// ── Currency ──────────────────────────────────────────────────
// Extend here for multi-currency: swap symbol/locale per user setting.
const CURRENCY = { symbol: 'ج.م', locale: 'ar-EG', decimals: 0 };

function formatCurrency(value, decimals) {
  const d = decimals !== undefined ? decimals : CURRENCY.decimals;
  const n = Number(value) || 0;
  return n.toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }) + ' ' + CURRENCY.symbol;
}

// ── Date Helpers ──────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

function formatTime(str) {
  if (!str) return '';
  const [h, m] = str.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function daysBetween(start, end) {
  if (!start) return 0;
  const s = new Date(start), e = new Date(end || start);
  return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
}

function daysUntil(str) {
  if (!str) return null;
  return Math.ceil((new Date(str) - new Date()) / 86400000);
}

function tripStatus(info) {
  if (!info || !info.startDate) return 'planned';
  const now = new Date(), s = new Date(info.startDate), e = new Date(info.endDate || info.startDate);
  if (now < s) return 'planned';
  if (now > e) return 'ended';
  return 'active';
}

// ── ID & Escape ───────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── LocalStorage (fallback) ───────────────────────────────────
const LS_KEY = 'talaat_v2';

function lsGet() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function lsSet(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function lsGetTrip(id) {
  const all = lsGet();
  return all.trips?.[id] || { info: {}, members: {}, items: {}, activities: {}, expenses: {}, meals: {}, memories: {} };
}
function lsSaveTrip(id, data) {
  const all = lsGet();
  if (!all.trips) all.trips = {};
  all.trips[id] = data;
  lsSet(all);
}
function lsGetTrips() {
  const all = lsGet();
  const result = {};
  if (all.trips) {
    Object.entries(all.trips).forEach(([id, t]) => { result[id] = t.info || {}; });
  }
  return result;
}
function lsSaveTrips(trips) {
  const all = lsGet();
  if (!all.trips) all.trips = {};
  Object.entries(trips).forEach(([id, info]) => {
    if (!all.trips[id]) all.trips[id] = {};
    all.trips[id].info = info;
  });
  lsSet(all);
}
function lsDeleteTrip(id) {
  const all = lsGet();
  if (all.trips) delete all.trips[id];
  lsSet(all);
}

// ── Trip Type Metadata ────────────────────────────────────────
const TRIP_TYPES = {
  farm:     { label: 'مزرعة',      icon: 'ph-plant',           grad: 'linear-gradient(140deg,#0d3321 0%,#1a5c3a 100%)' },
  beach:    { label: 'شاطئ',       icon: 'ph-waves',           grad: 'linear-gradient(140deg,#0b2f4a 0%,#0e5a8a 100%)' },
  chalet:   { label: 'شاليه',      icon: 'ph-house-simple',    grad: 'linear-gradient(140deg,#1e1040 0%,#3b1f7a 100%)' },
  camping:  { label: 'تخييم',      icon: 'ph-tree-evergreen',  grad: 'linear-gradient(140deg,#12311a 0%,#1e5929 100%)' },
  roadtrip: { label: 'رحلة برية',  icon: 'ph-car',             grad: 'linear-gradient(140deg,#1e1c1a 0%,#3a3632 100%)' },
  travel:   { label: 'سفر',        icon: 'ph-airplane',        grad: 'linear-gradient(140deg,#0f2347 0%,#1a3d7c 100%)' },
  custom:   { label: 'مخصص',       icon: 'ph-star',            grad: 'linear-gradient(140deg,#231040 0%,#4a1e7a 100%)' },
};

// ── Checklist Category Metadata ───────────────────────────────
const CATEGORIES = {
  food:        { label: 'طعام',        icon: 'ph-fork-knife',    color: '#f97316' },
  drinks:      { label: 'مشروبات',     icon: 'ph-drop',          color: '#38bdf8' },
  bbq:         { label: 'شواء',        icon: 'ph-fire',          color: '#ef4444' },
  snacks:      { label: 'سناكس',       icon: 'ph-cookie',        color: '#fbbf24' },
  fruits:      { label: 'فواكه',       icon: 'ph-leaf',          color: '#4ade80' },
  electronics: { label: 'إلكترونيات',  icon: 'ph-plug',          color: '#a78bfa' },
  cleaning:    { label: 'تنظيف',       icon: 'ph-sparkle',       color: '#67e8f9' },
  swimming:    { label: 'سباحة',       icon: 'ph-waves',         color: '#60a5fa' },
  games:       { label: 'ألعاب',       icon: 'ph-game-controller',color: '#c084fc' },
  emergency:   { label: 'طوارئ',       icon: 'ph-plus-circle',   color: '#fb7185' },
  other:       { label: 'أخرى',        icon: 'ph-cube',          color: '#94a3b8' },
};

// ── Expense Category Metadata ─────────────────────────────────
const EXP_CATEGORIES = {
  food:          { label: 'طعام',        icon: 'ph-fork-knife' },
  transport:     { label: 'مواصلات',     icon: 'ph-car' },
  accommodation: { label: 'إقامة',       icon: 'ph-house-simple' },
  shopping:      { label: 'تسوق',        icon: 'ph-shopping-bag' },
  entertainment: { label: 'ترفيه',       icon: 'ph-music-note' },
  fuel:          { label: 'وقود',        icon: 'ph-gas-pump' },
  other:         { label: 'أخرى',        icon: 'ph-cube' },
};

// ── Member Avatar Palette ─────────────────────────────────────
const AVATAR_COLORS = ['#16a34a','#2563eb','#dc2626','#9333ea','#0891b2','#c2410c','#0d9488','#d97706'];

function memberInitial(name) { return (name || '?').charAt(0); }
function memberColor(name) { return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length]; }
function renderAvatar(name, size = 'md') {
  const c = memberColor(name), i = memberInitial(name);
  return `<div class="avatar avatar--${size}" style="background:${c}" title="${esc(name)}">${esc(i)}</div>`;
}
