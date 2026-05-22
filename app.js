// ============================================================
//  طلعت — Trips Dashboard
// ============================================================
'use strict';

const state = {
  trips: {},        // { tripId: { name, type, location, budget, startDate, endDate, description, createdAt } }
  isLocalMode: false,
};

let tripsRef = null;

// ── Firebase / Local init ─────────────────────────────────────
function initData() {
  if (!window.FIREBASE_READY || !window.db) {
    state.isLocalMode = true;
    state.trips = lsGetTrips();
    hideLoader(); renderTrips();
    return;
  }

  tripsRef = window.db.ref('trips');
  let resolved = false;

  const timeout = setTimeout(() => {
    if (!resolved) {
      state.isLocalMode = true;
      tripsRef.off();
      state.trips = lsGetTrips();
      hideLoader(); renderTrips();
      showToast('يعمل في الوضع المحلي', 'info', 4000);
    }
  }, 7000);

  // Listen to trip info nodes only (not full trip data — keeps bandwidth low)
  tripsRef.on('value', snap => {
    resolved = true;
    clearTimeout(timeout);
    const raw = snap.val() || {};
    // Each child has sub-keys (info, members, items…); we only read .info here
    state.trips = {};
    Object.entries(raw).forEach(([id, data]) => {
      if (data && data.info) state.trips[id] = data.info;
    });
    hideLoader(); renderTrips();
  }, err => {
    resolved = true;
    clearTimeout(timeout);
    state.isLocalMode = true;
    state.trips = lsGetTrips();
    hideLoader(); renderTrips();
    showToast('تعذّر الاتصال بـ Firebase', 'error');
  });
}

function hideLoader() {
  document.getElementById('tripsLoading').classList.add('hidden');
}

// ── TRIP CRUD ─────────────────────────────────────────────────
function createTripData(form) {
  return {
    name:        form.name.trim(),
    type:        form.type || 'farm',
    location:    form.location.trim(),
    budget:      parseFloat(form.budget) || 0,
    startDate:   form.startDate || '',
    endDate:     form.endDate || '',
    description: form.description.trim(),
    createdAt:   Date.now(),
  };
}

function saveTripToFirebase(id, info) {
  window.db.ref(`trips/${id}/info`).set(info).catch(() => showToast('خطأ في الحفظ', 'error'));
}

function deleteTripFromFirebase(id) {
  window.db.ref(`trips/${id}`).remove().catch(() => showToast('خطأ في الحذف', 'error'));
}

// ── RENDER ────────────────────────────────────────────────────
function renderTrips() {
  const grid   = document.getElementById('tripsGrid');
  const empty  = document.getElementById('tripsEmpty');
  const heroSub = document.getElementById('heroSub');
  const entries = Object.entries(state.trips);

  const count = entries.length;
  heroSub.textContent = count === 0 ? 'لا توجد رحلات مجدولة'
    : `${count} ${count === 1 ? 'رحلة' : 'رحلات'} مجدولة`;

  if (count === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  // Sort by startDate desc, then createdAt desc
  entries.sort(([, a], [, b]) => {
    const da = a.startDate || ''; const db = b.startDate || '';
    if (da && db) return da > db ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  grid.innerHTML = entries.map(([id, info]) => buildTripCard(id, info)).join('');

  // Attach click handlers
  grid.querySelectorAll('.trip-card-link').forEach(el => {
    el.addEventListener('click', () => openTrip(el.dataset.id));
  });

  grid.querySelectorAll('.tc-menu-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleDropdown(btn.dataset.id);
    });
  });
}

function buildTripCard(id, info) {
  const type   = TRIP_TYPES[info.type] || TRIP_TYPES.farm;
  const status = tripStatus(info);
  const days   = info.startDate && info.endDate ? daysBetween(info.startDate, info.endDate) : null;
  const due    = daysUntil(info.startDate);

  const statusLabel = { planned: 'مخطط', active: 'نشطة', ended: 'منتهية' }[status];
  const locationHtml = info.location
    ? `<div class="tc-location"><i class="ph ph-map-pin"></i>${esc(info.location)}</div>` : '';
  const datesHtml = info.startDate
    ? `<div class="tc-meta-item"><i class="ph ph-calendar-blank"></i>${formatShortDate(info.startDate)}${info.endDate ? ' — ' + formatShortDate(info.endDate) : ''}</div>` : '';
  const budgetHtml = info.budget
    ? `<div class="tc-meta-item"><i class="ph ph-money"></i>${formatCurrency(info.budget)}</div>` : '';
  const daysHtml = days
    ? `<div class="tc-meta-item"><i class="ph ph-clock"></i>${days} ${days === 1 ? 'يوم' : 'أيام'}</div>` : '';
  const countdownHtml = status === 'planned' && due !== null && due > 0
    ? `<div class="tc-meta-item" style="color:var(--accent-text)"><i class="ph ph-hourglass"></i>${due} يوم للرحلة</div>` : '';

  return `
    <div class="trip-card trip-card-link" data-id="${id}" style="cursor:pointer">
      <div class="tc-cover" style="overflow:hidden">
        <div class="tc-cover-bg" style="overflow:hidden">
          <div class="tc-cover-bg-inner" style="background:${type.grad}"></div>
        </div>
        <div class="tc-cover-icon"><i class="ph ${type.icon}"></i></div>
        <div class="tc-cover-overlay"></div>
        <div class="tc-cover-top">
          <span class="badge badge--${status}">${statusLabel}</span>
          <button class="tc-menu-btn" data-id="${id}" onclick="event.stopPropagation()">
            <i class="ph ph-dots-three-vertical"></i>
          </button>
        </div>
      </div>
      <div class="tc-body">
        <div class="tc-name">${esc(info.name || 'رحلة بدون اسم')}</div>
        ${locationHtml}
        <div class="tc-meta">
          ${datesHtml}${daysHtml}${budgetHtml}${countdownHtml}
        </div>
        <div class="tc-footer">
          <span class="type-chip" style="background:rgba(0,0,0,0.22);backdrop-filter:none;border-color:var(--bd)">
            <i class="ph ${type.icon}" style="font-size:12px"></i> ${type.label}
          </span>
        </div>
      </div>
      <!-- Dropdown (hidden by default) -->
      <div class="tc-dropdown hidden" id="drop-${id}">
        <button class="tc-drop-item" onclick="event.stopPropagation();openEditTrip('${id}')">
          <i class="ph ph-pencil-simple"></i> تعديل
        </button>
        <button class="tc-drop-item danger" onclick="event.stopPropagation();confirmDeleteTrip('${id}')">
          <i class="ph ph-trash"></i> حذف
        </button>
      </div>
    </div>`;
}

function toggleDropdown(id) {
  document.querySelectorAll('.tc-dropdown').forEach(d => {
    if (d.id !== `drop-${id}`) d.classList.add('hidden');
  });
  document.getElementById(`drop-${id}`)?.classList.toggle('hidden');
}

// Close dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.tc-dropdown').forEach(d => d.classList.add('hidden'));
});

// ── NAVIGATE ──────────────────────────────────────────────────
function openTrip(id) {
  window.location.href = `trip.html?id=${id}`;
}

// ── MODAL: CREATE/EDIT ────────────────────────────────────────
function openCreateModal() {
  document.getElementById('editTripId').value = '';
  document.getElementById('tripModalTitle').innerHTML = '<i class="ph ph-map-trifold"></i> رحلة جديدة';
  document.getElementById('tName').value = '';
  document.getElementById('tType').value = 'farm';
  document.getElementById('tLocation').value = '';
  document.getElementById('tBudget').value = '';
  document.getElementById('tStart').value = '';
  document.getElementById('tEnd').value = '';
  document.getElementById('tDesc').value = '';
  showOverlay('tripOverlay');
  setTimeout(() => document.getElementById('tName').focus(), 120);
}

function openEditTrip(id) {
  const info = state.trips[id];
  if (!info) return;
  document.getElementById('editTripId').value = id;
  document.getElementById('tripModalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> تعديل الرحلة';
  document.getElementById('tName').value     = info.name     || '';
  document.getElementById('tType').value     = info.type     || 'farm';
  document.getElementById('tLocation').value = info.location || '';
  document.getElementById('tBudget').value   = info.budget   || '';
  document.getElementById('tStart').value    = info.startDate || '';
  document.getElementById('tEnd').value      = info.endDate   || '';
  document.getElementById('tDesc').value     = info.description || '';
  showOverlay('tripOverlay');
  setTimeout(() => document.getElementById('tName').focus(), 120);
}

function closeTripModal() { hideOverlay('tripOverlay'); }

function saveTrip() {
  const name = document.getElementById('tName').value.trim();
  if (!name) { shakeEl(document.getElementById('tName')); showToast('الرجاء إدخال اسم الرحلة', 'error'); return; }

  const info = createTripData({
    name,
    type:        document.getElementById('tType').value,
    location:    document.getElementById('tLocation').value,
    budget:      document.getElementById('tBudget').value,
    startDate:   document.getElementById('tStart').value,
    endDate:     document.getElementById('tEnd').value,
    description: document.getElementById('tDesc').value,
  });

  const editId = document.getElementById('editTripId').value;
  const id = editId || genId();

  if (state.isLocalMode) {
    state.trips[id] = info;
    lsSaveTrips(state.trips);
    renderTrips();
  } else {
    state.trips[id] = info;
    saveTripToFirebase(id, info);
    renderTrips();
  }

  closeTripModal();
  showToast(editId ? 'تم تعديل الرحلة' : 'تم إنشاء الرحلة', 'success');
}

// ── CONFIRM DELETE ────────────────────────────────────────────
let _pendingDeleteId = null;

function confirmDeleteTrip(id) {
  const info = state.trips[id];
  _pendingDeleteId = id;
  document.getElementById('confirmMsg').textContent = `هل تريد حذف رحلة "${info?.name || ''}"؟ سيتم حذف جميع البيانات.`;
  showOverlay('confirmOverlay');
}

document.getElementById('confirmOk').addEventListener('click', () => {
  if (_pendingDeleteId) {
    const id = _pendingDeleteId;
    delete state.trips[id];
    if (state.isLocalMode) {
      lsDeleteTrip(id);
    } else {
      deleteTripFromFirebase(id);
    }
    renderTrips();
    showToast('تم حذف الرحلة', 'info');
    _pendingDeleteId = null;
  }
  hideOverlay('confirmOverlay');
});

document.getElementById('confirmCancel').addEventListener('click', () => {
  _pendingDeleteId = null;
  hideOverlay('confirmOverlay');
});

// ── OVERLAY HELPERS ───────────────────────────────────────────
function showOverlay(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
}
function handleOverlayClick(e, overlayId, closeFn) {
  if (e.target.id === overlayId) closeFn();
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastStack');
  const icons = { success: 'ph-fill ph-check-circle', error: 'ph-fill ph-x-circle', info: 'ph-fill ph-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="toast-ico ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 280); }, duration);
}

// ── SHAKE ANIMATION ───────────────────────────────────────────
function shakeEl(el) {
  el.animate([
    {transform:'translateX(0)'},{transform:'translateX(-8px)'},
    {transform:'translateX(8px)'},{transform:'translateX(-4px)'},
    {transform:'translateX(4px)'},{transform:'translateX(0)'}
  ], { duration:380, easing:'ease' });
}

// ── KEYBOARD ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTripModal(); hideOverlay('confirmOverlay'); }
  if (e.key === 'n' || e.key === 'N') {
    if (!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) openCreateModal();
  }
});

// ── HEADER BINDINGS ───────────────────────────────────────────
document.getElementById('createTripBtn').addEventListener('click', openCreateModal);
document.getElementById('tName').addEventListener('keydown', e => { if (e.key === 'Enter') saveTrip(); });

// ── INIT ──────────────────────────────────────────────────────
initData();
