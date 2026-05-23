// ============================================================
//  طلعت — Trip Detail Logic
// ============================================================
'use strict';

// ── STATE ─────────────────────────────────────────────────────
const S = {
  tripId:     null,
  info:       {},
  members:    {},
  items:      {},
  activities: {},
  expenses:   {},
  meals:      {},
  memories:   {},
  activeTab:  'checklist',
  isLocalMode: false,
  filter: { cat: 'all', status: 'all', search: '' },
};

// ── MODAL SAVE CALLBACK ───────────────────────────────────────
let _modalType = null;
let _modalEditId = null;

// ── URL PARAM ─────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
S.tripId = urlParams.get('id');
if (!S.tripId) window.location.href = 'app.html';

// ── FIREBASE REFS ─────────────────────────────────────────────
function ref(path) { return window.db.ref(`trips/${S.tripId}/${path}`); }

// ── INIT DATA ─────────────────────────────────────────────────
function initData() {
  if (!window.FIREBASE_READY || !window.db) {
    S.isLocalMode = true;
    loadFromLocal();
    return;
  }

  let resolved = false;
  const timeout = setTimeout(() => {
    if (!resolved) {
      S.isLocalMode = true;
      ref('').off();
      loadFromLocal();
      showToast('يعمل في الوضع المحلي', 'info', 4000);
    }
  }, 7000);

  ref('').on('value', snap => {
    resolved = true; clearTimeout(timeout);
    const data = snap.val() || {};
    S.info       = data.info       || {};
    S.members    = data.members    || {};
    S.items      = data.items      || {};
    S.activities = data.activities || {};
    S.expenses   = data.expenses   || {};
    S.meals      = data.meals      || {};
    S.memories   = data.memories   || {};
    hideAllLoaders();
    renderAll();
  }, () => {
    resolved = true; clearTimeout(timeout);
    S.isLocalMode = true;
    loadFromLocal();
  });
}

function loadFromLocal() {
  const data = lsGetTrip(S.tripId);
  S.info       = data.info       || {};
  S.members    = data.members    || {};
  S.items      = data.items      || {};
  S.activities = data.activities || {};
  S.expenses   = data.expenses   || {};
  S.meals      = data.meals      || {};
  S.memories   = data.memories   || {};
  hideAllLoaders();
  renderAll();
}

function persist() {
  if (!S.isLocalMode) return;
  lsSaveTrip(S.tripId, { info: S.info, members: S.members, items: S.items, activities: S.activities, expenses: S.expenses, meals: S.meals, memories: S.memories });
}

function fbSet(path, val) {
  if (S.isLocalMode) { persist(); return; }
  ref(path).set(val).catch(() => showToast('خطأ في الحفظ', 'error'));
}
function fbRemove(path) {
  if (S.isLocalMode) { persist(); return; }
  ref(path).remove().catch(() => showToast('خطأ في الحذف', 'error'));
}

function hideAllLoaders() {
  ['itemsLoading','tlLoading','expLoading','mealLoading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('memEmpty').classList.remove('hidden');
}

// ── RENDER ALL ────────────────────────────────────────────────
function renderAll() {
  renderCover();
  renderStats();
  renderActiveTab();
}

function renderActiveTab() {
  switch (S.activeTab) {
    case 'checklist': renderChecklist(); break;
    case 'timeline':  renderTimeline();  break;
    case 'expenses':  renderExpenses();  break;
    case 'meals':     renderMeals();     break;
    case 'members':   renderMembers();   break;
    case 'memories':  renderMemories();  break;
  }
}

// ── COVER ─────────────────────────────────────────────────────
function renderCover() {
  const info = S.info;
  const type = TRIP_TYPES[info.type] || TRIP_TYPES.farm;
  const status = tripStatus(info);
  const statusLabel = { planned: 'مخطط', active: 'نشطة', ended: 'منتهية' }[status];

  document.getElementById('tripCoverBg').style.background = type.grad;
  document.getElementById('tripCoverIcon').innerHTML = `<i class="ph ${type.icon}"></i>`;
  document.getElementById('tripCoverName').textContent = info.name || 'رحلة';
  document.getElementById('headerTripName').textContent = info.name || 'رحلة';

  const statusEl = document.getElementById('headerStatus');
  statusEl.style.display = 'inline-flex';
  statusEl.className = `badge badge--${status}`;
  statusEl.textContent = statusLabel;

  document.getElementById('tripCoverType').innerHTML =
    `<span class="type-chip"><i class="ph ${type.icon}" style="font-size:12px"></i> ${type.label}</span>`;

  const meta = [];
  if (info.location) meta.push(`<span><i class="ph ph-map-pin"></i>${esc(info.location)}</span>`);
  if (info.startDate) {
    const d = info.endDate
      ? `${formatShortDate(info.startDate)} — ${formatShortDate(info.endDate)}`
      : formatShortDate(info.startDate);
    meta.push(`<span><i class="ph ph-calendar-blank"></i>${d}</span>`);
  }
  if (info.startDate && info.endDate) {
    const n = daysBetween(info.startDate, info.endDate);
    meta.push(`<span><i class="ph ph-clock"></i>${n} ${n===1?'يوم':'أيام'}</span>`);
  }
  document.getElementById('tripCoverMeta').innerHTML = meta.join('');

  document.title = `طلعت — ${info.name || 'رحلة'}`;
}

function renderStats() {
  const items   = Object.values(S.items);
  const total   = items.length;
  const done    = items.filter(i => i.purchased).length;
  const expenses = Object.values(S.expenses);
  const expTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const members  = Object.keys(S.members).length;

  document.getElementById('stat-items').textContent   = total;
  document.getElementById('stat-done').textContent    = done;
  document.getElementById('stat-budget').textContent  = formatCurrency(expTotal);
  document.getElementById('stat-members').textContent = members;
}

// ── TAB SWITCHING ─────────────────────────────────────────────
document.getElementById('tabNav').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  S.activeTab = tab;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));

  renderActiveTab();
  updateFab();
});

function updateFab() {
  const fabActions = {
    checklist: () => openItemModal(),
    timeline:  () => openActivityModal(),
    expenses:  () => openExpenseModal(),
    meals:     () => openMealModal(),
    members:   () => { document.getElementById('memberInput').focus(); },
    memories:  () => openMemoryModal(),
  };
  document.getElementById('fab').onclick = fabActions[S.activeTab] || (() => {});
}

// ═══════════════════════════════════════════════════════════════
//  CHECKLIST TAB
// ═══════════════════════════════════════════════════════════════

function renderChecklist() {
  renderCategoryBadges();
  renderItemsList();
}

function renderCategoryBadges() {
  const all = Object.values(S.items);
  const counts = { all: all.length };
  all.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });
  Object.keys(CATEGORIES).concat(['all']).forEach(k => {
    const el = document.getElementById(`cn-${k}`);
    if (el) el.textContent = counts[k] || 0;
  });
}

function getFilteredItems() {
  const { cat, status, search } = S.filter;
  const q = search.toLowerCase().trim();
  let items = Object.entries(S.items).map(([id, d]) => ({ id, ...d }));

  if (cat !== 'all')       items = items.filter(i => i.category === cat);
  if (status === 'pending') items = items.filter(i => !i.purchased);
  if (status === 'done')    items = items.filter(i =>  i.purchased);
  if (q) items = items.filter(i => (i.name||'').toLowerCase().includes(q) || (i.notes||'').toLowerCase().includes(q));

  items.sort((a, b) => {
    if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return items;
}

function renderItemsList() {
  const filtered = getFilteredItems();
  const total    = Object.keys(S.items).length;
  const container = document.getElementById('itemsList');
  const loader    = document.getElementById('itemsLoading');
  const empty     = document.getElementById('itemsEmpty');
  const noRes     = document.getElementById('itemsNoResults');

  loader.style.display = 'none';
  empty.classList.toggle('hidden',   total > 0 || filtered.length > 0);
  noRes.classList.toggle('hidden',   total === 0 || filtered.length > 0);
  container.classList.toggle('hidden', filtered.length === 0);

  if (filtered.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = filtered.map((item, i) => buildItemCard(item, i)).join('');
  renderStats();
}

function buildItemCard(item, delay = 0) {
  const cat    = CATEGORIES[item.category] || CATEGORIES.other;
  const member = item.assignedTo ? S.members[item.assignedTo] : null;
  const price  = item.price ? formatCurrency((item.price || 0) * (item.qty || 1)) : '';
  const qtyStr = (item.qty > 1 || item.unit) ? `×${item.qty || 1}${item.unit ? ' ' + item.unit : ''}` : '';

  return `<div class="item-card${item.purchased ? ' is-done' : ''}"
    style="--cat-c:${cat.color};animation-delay:${delay*25}ms" data-id="${item.id}">
    <div class="item-check${item.purchased ? ' checked' : ''}" onclick="toggleItem('${item.id}')">
      ${item.purchased ? '<i class="ph-fill ph-check"></i>' : ''}
    </div>
    <div class="item-cat-ico"><i class="ph ${cat.icon}"></i></div>
    <div class="item-body">
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-sub">
        <span class="cat-chip">${cat.label}</span>
        ${qtyStr ? `<span class="item-qty-lbl">${esc(qtyStr)}</span>` : ''}
        ${item.notes ? `<span class="item-note">${esc(item.notes)}</span>` : ''}
      </div>
    </div>
    <div class="item-end">
      ${member ? `<div class="item-person">${renderAvatar(member.name,'xs')}<span class="item-person-name">${esc(member.name)}</span></div>` : ''}
      ${price ? `<span class="item-price">${price}</span>` : ''}
      <div class="item-actions">
        <button class="item-act-btn" onclick="openEditItemModal('${item.id}')" title="تعديل"><i class="ph ph-pencil-simple"></i></button>
        <button class="item-act-btn del" onclick="confirmDelete('item','${item.id}','${esc(item.name)}')" title="حذف"><i class="ph ph-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function toggleItem(id) {
  const current = S.items[id]?.purchased;
  S.items[id].purchased = !current;
  fbSet(`items/${id}/purchased`, !current);
  renderItemsList();
  renderStats();
  showToast(!current ? 'تم تأشير العنصر' : 'تم إلغاء التأشير', 'success', 1600);
}

// Item modal
function openItemModal() {
  _modalType   = 'item';
  _modalEditId = null;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-plus"></i> إضافة عنصر';
  document.getElementById('modalBody').innerHTML  = itemFormHtml({});
  bindQtyControls();
  populateMembersSelect('iAssigned');
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('iName').focus(), 100);
}

function openEditItemModal(id) {
  const item = S.items[id]; if (!item) return;
  _modalType   = 'item';
  _modalEditId = id;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> تعديل العنصر';
  document.getElementById('modalBody').innerHTML  = itemFormHtml(item);
  bindQtyControls();
  populateMembersSelect('iAssigned', item.assignedTo);
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('iName').focus(), 100);
}

function itemFormHtml(item) {
  const catOptions = Object.entries(CATEGORIES).map(([k, v]) =>
    `<option value="${k}"${item.category===k?' selected':''}>${v.label}</option>`).join('');
  return `
    <div class="field-row">
      <div class="field field--grow">
        <label class="field-label">الاسم <span class="req">*</span></label>
        <input type="text" id="iName" class="field-input" value="${esc(item.name||'')}" placeholder="مثال: ماء معدني" autocomplete="off">
      </div>
      <div class="field" style="width:120px;flex-shrink:0">
        <label class="field-label">الكمية</label>
        <div class="qty-ctrl">
          <button class="qty-step" id="qtyMinus" type="button"><i class="ph ph-minus"></i></button>
          <input type="number" id="iQty" class="qty-val" value="${item.qty||1}" min="1">
          <button class="qty-step" id="qtyPlus" type="button"><i class="ph ph-plus"></i></button>
        </div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">الفئة</label>
        <div class="select-wrap">
          <select id="iCategory" class="field-input field-select">${catOptions}</select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
      <div class="field">
        <label class="field-label">السعر (ج.م)</label>
        <input type="number" id="iPrice" class="field-input" value="${item.price||''}" placeholder="0" min="0" step="0.5">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">مسؤول الشراء</label>
        <div class="select-wrap">
          <select id="iAssigned" class="field-input field-select"><option value="">— غير محدد —</option></select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
      <div class="field">
        <label class="field-label">الوحدة</label>
        <input type="text" id="iUnit" class="field-input" value="${esc(item.unit||'')}" placeholder="حبة، لتر، كيلو">
      </div>
    </div>
    <div class="field">
      <label class="field-label">ملاحظات</label>
      <textarea id="iNotes" class="field-input field-textarea" rows="2" placeholder="أضف ملاحظة...">${esc(item.notes||'')}</textarea>
    </div>`;
}

function bindQtyControls() {
  document.getElementById('qtyMinus')?.addEventListener('click', () => {
    const f = document.getElementById('iQty');
    if (f && +f.value > 1) f.value = +f.value - 1;
  });
  document.getElementById('qtyPlus')?.addEventListener('click', () => {
    const f = document.getElementById('iQty');
    if (f) f.value = +f.value + 1;
  });
}

function saveItem() {
  const name = document.getElementById('iName').value.trim();
  if (!name) { shakeEl(document.getElementById('iName')); showToast('الرجاء إدخال الاسم', 'error'); return false; }

  const data = {
    name,
    qty:        Math.max(1, parseInt(document.getElementById('iQty').value) || 1),
    category:   document.getElementById('iCategory').value || 'other',
    price:      parseFloat(document.getElementById('iPrice').value) || 0,
    unit:       document.getElementById('iUnit').value.trim(),
    notes:      document.getElementById('iNotes').value.trim(),
    assignedTo: document.getElementById('iAssigned').value,
    purchased:  _modalEditId ? (S.items[_modalEditId]?.purchased || false) : false,
    createdAt:  _modalEditId ? (S.items[_modalEditId]?.createdAt || Date.now()) : Date.now(),
  };

  const id = _modalEditId || genId();
  S.items[id] = data;
  fbSet(`items/${id}`, data);
  renderChecklist();
  renderStats();
  showToast(_modalEditId ? 'تم التعديل' : 'تمت الإضافة', 'success');
  return true;
}

// Checklist filter bindings
document.getElementById('catBar').addEventListener('click', e => {
  const btn = e.target.closest('.cat-btn'); if (!btn) return;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.filter.cat = btn.dataset.cat;
  renderItemsList();
});

document.getElementById('statusFilter').addEventListener('click', e => {
  const btn = e.target.closest('.s-pill'); if (!btn) return;
  document.querySelectorAll('.s-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.filter.status = btn.dataset.status;
  renderItemsList();
});

let _searchTimer;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(_searchTimer);
  const q = e.target.value;
  document.getElementById('searchClear').classList.toggle('hidden', !q);
  _searchTimer = setTimeout(() => { S.filter.search = q; renderItemsList(); }, 200);
});
document.getElementById('searchClear').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.add('hidden');
  S.filter.search = '';
  renderItemsList();
});

// ═══════════════════════════════════════════════════════════════
//  TIMELINE / ACTIVITIES TAB
// ═══════════════════════════════════════════════════════════════

function renderTimeline() {
  const list = Object.entries(S.activities).map(([id, d]) => ({ id, ...d }));
  const el   = document.getElementById('timeline');
  const empty = document.getElementById('tlEmpty');

  if (list.length === 0) { empty.classList.remove('hidden'); el.innerHTML = ''; return; }
  empty.classList.add('hidden');

  // Sort by date then time
  list.sort((a, b) => {
    const da = (a.date || '') + (a.time || '');
    const db = (b.date || '') + (b.time || '');
    return da.localeCompare(db);
  });

  // Group by date
  const groups = {};
  list.forEach(act => {
    const k = act.date || 'no-date';
    if (!groups[k]) groups[k] = [];
    groups[k].push(act);
  });

  el.innerHTML = Object.entries(groups).map(([date, acts]) => {
    const label = date === 'no-date' ? 'بدون تاريخ' : formatDate(date);
    const items  = acts.map((act, i) => buildTlItem(act, i === acts.length - 1)).join('');
    return `<div class="tl-date-group">
      <div class="tl-date-sep">${label}</div>
      <div class="tl-items">${items}</div>
    </div>`;
  }).join('');
}

function buildTlItem(act, isLast) {
  const member  = act.assignedTo ? S.members[act.assignedTo] : null;
  const status  = act.status || 'planned';
  const lblMap  = { planned:'مخطط', active:'جارٍ', done:'مكتمل' };
  return `<div class="tl-item">
    <div class="tl-connector">
      <div class="tl-dot ${status}"></div>
      ${isLast ? '' : '<div class="tl-line"></div>'}
    </div>
    <div class="tl-content">
      ${act.time ? `<div class="tl-time">${formatTime(act.time)}</div>` : ''}
      <div class="tl-card ${status}">
        <div class="tl-card-head">
          <span class="tl-title">${esc(act.title)}</span>
          <span class="act-badge ${status}">${lblMap[status]}</span>
        </div>
        ${act.description ? `<div class="tl-desc">${esc(act.description)}</div>` : ''}
        <div class="tl-footer">
          <div class="tl-meta">
            ${member ? `<div class="tl-assigned">${renderAvatar(member.name,'xs')}<span>${esc(member.name)}</span></div>` : ''}
          </div>
          <div class="tl-actions">
            <button class="item-act-btn" onclick="cycleActivityStatus('${act.id}')" title="تغيير الحالة"><i class="ph ph-arrows-clockwise"></i></button>
            <button class="item-act-btn" onclick="openEditActivityModal('${act.id}')" title="تعديل"><i class="ph ph-pencil-simple"></i></button>
            <button class="item-act-btn del" onclick="confirmDelete('activity','${act.id}','${esc(act.title)}')" title="حذف"><i class="ph ph-trash"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function cycleActivityStatus(id) {
  const cycle = { planned:'active', active:'done', done:'planned' };
  const next  = cycle[S.activities[id]?.status || 'planned'];
  S.activities[id].status = next;
  fbSet(`activities/${id}/status`, next);
  renderTimeline();
  showToast('تم تحديث الحالة', 'success', 1500);
}

function openActivityModal() {
  _modalType   = 'activity';
  _modalEditId = null;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-calendar-plus"></i> إضافة نشاط';
  document.getElementById('modalBody').innerHTML  = activityFormHtml({});
  populateMembersSelect('aAssigned');
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('aTitle').focus(), 100);
}

function openEditActivityModal(id) {
  const act = S.activities[id]; if (!act) return;
  _modalType   = 'activity';
  _modalEditId = id;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> تعديل النشاط';
  document.getElementById('modalBody').innerHTML  = activityFormHtml(act);
  populateMembersSelect('aAssigned', act.assignedTo);
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('aTitle').focus(), 100);
}

function activityFormHtml(act) {
  return `
    <div class="field">
      <label class="field-label">العنوان <span class="req">*</span></label>
      <input type="text" id="aTitle" class="field-input" value="${esc(act.title||'')}" placeholder="مثال: غداء الشواء" autocomplete="off">
    </div>
    <div class="field">
      <label class="field-label">الوصف</label>
      <textarea id="aDesc" class="field-input field-textarea" rows="2" placeholder="تفاصيل النشاط...">${esc(act.description||'')}</textarea>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">التاريخ</label>
        <input type="date" id="aDate" class="field-input" value="${act.date||''}">
      </div>
      <div class="field">
        <label class="field-label">الوقت</label>
        <input type="time" id="aTime" class="field-input" value="${act.time||''}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">المسؤول</label>
        <div class="select-wrap">
          <select id="aAssigned" class="field-input field-select"><option value="">— غير محدد —</option></select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
      <div class="field">
        <label class="field-label">الحالة</label>
        <div class="select-wrap">
          <select id="aStatus" class="field-input field-select">
            <option value="planned"${(act.status||'planned')==='planned'?' selected':''}>مخطط</option>
            <option value="active"${act.status==='active'?' selected':''}>جارٍ</option>
            <option value="done"${act.status==='done'?' selected':''}>مكتمل</option>
          </select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
    </div>`;
}

function saveActivity() {
  const title = document.getElementById('aTitle').value.trim();
  if (!title) { shakeEl(document.getElementById('aTitle')); showToast('الرجاء إدخال العنوان', 'error'); return false; }

  const data = {
    title,
    description: document.getElementById('aDesc').value.trim(),
    date:        document.getElementById('aDate').value,
    time:        document.getElementById('aTime').value,
    assignedTo:  document.getElementById('aAssigned').value,
    status:      document.getElementById('aStatus').value || 'planned',
    createdAt:   _modalEditId ? (S.activities[_modalEditId]?.createdAt || Date.now()) : Date.now(),
  };

  const id = _modalEditId || genId();
  S.activities[id] = data;
  fbSet(`activities/${id}`, data);
  renderTimeline();
  showToast(_modalEditId ? 'تم التعديل' : 'تمت الإضافة', 'success');
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  EXPENSES TAB
// ═══════════════════════════════════════════════════════════════

function renderExpenses() {
  const list   = Object.entries(S.expenses).map(([id, d]) => ({ id, ...d }));
  const empty  = document.getElementById('expEmpty');
  const content = document.getElementById('expContent');

  if (list.length === 0) { empty.classList.remove('hidden'); content.classList.add('hidden'); return; }
  empty.classList.add('hidden'); content.classList.remove('hidden');

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const total    = list.reduce((s, e) => s + (e.amount || 0), 0);
  const memberCount = Math.max(Object.keys(S.members).length, 1);

  document.getElementById('expSummary').innerHTML = `
    <div class="exp-stat"><span class="exp-stat-val">${formatCurrency(total)}</span><span class="exp-stat-lbl">الإجمالي</span></div>
    <div class="exp-stat"><span class="exp-stat-val">${formatCurrency(total/memberCount,1)}</span><span class="exp-stat-lbl">للشخص</span></div>
    <div class="exp-stat"><span class="exp-stat-val">${list.length}</span><span class="exp-stat-lbl">مدفوعات</span></div>`;

  document.getElementById('expList').innerHTML = list.map(buildExpCard).join('');
  renderSettlement();
  renderStats();
}

function buildExpCard(exp) {
  const payer  = exp.paidBy ? S.members[exp.paidBy] : null;
  const cat    = EXP_CATEGORIES[exp.category] || EXP_CATEGORIES.other;
  const partsCount = (exp.participants || []).length;
  return `<div class="exp-card">
    <div class="exp-ico"><i class="ph ${cat.icon}"></i></div>
    <div class="exp-body">
      <div class="exp-title">${esc(exp.title)}</div>
      <div class="exp-sub">
        ${payer ? `<div class="exp-payer">${renderAvatar(payer.name,'xs')} <span>${esc(payer.name)} دفع</span></div>` : ''}
        ${partsCount ? `<span class="exp-parts">${partsCount} مشاركين</span>` : ''}
        ${exp.notes ? `<span class="exp-parts">${esc(exp.notes)}</span>` : ''}
      </div>
    </div>
    <div class="exp-end">
      <span class="exp-amount">${formatCurrency(exp.amount)}</span>
      <div class="exp-actions">
        <button class="item-act-btn" onclick="openEditExpenseModal('${exp.id}')" title="تعديل"><i class="ph ph-pencil-simple"></i></button>
        <button class="item-act-btn del" onclick="confirmDelete('expense','${exp.id}','${esc(exp.title)}')" title="حذف"><i class="ph ph-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function renderSettlement() {
  const members  = Object.entries(S.members);
  if (!members.length) { document.getElementById('settlementList').innerHTML = '<p style="color:var(--t3);font-size:13px">أضف أعضاء أولاً لرؤية التسوية</p>'; return; }

  const balance = {};
  members.forEach(([id]) => balance[id] = 0);

  Object.values(S.expenses).forEach(exp => {
    const amount = exp.amount || 0;
    const payer  = exp.paidBy;
    const parts  = exp.participants?.length ? exp.participants : Object.keys(S.members);
    const share  = amount / Math.max(parts.length, 1);
    if (balance[payer] !== undefined) balance[payer] += amount;
    parts.forEach(pid => { if (balance[pid] !== undefined) balance[pid] -= share; });
  });

  const max = Math.max(...Object.values(balance).map(Math.abs), 1);

  document.getElementById('settlementList').innerHTML = members.map(([id, m]) => {
    const val  = balance[id] || 0;
    const sign = val > 0 ? 'pos' : val < 0 ? 'neg' : 'zero';
    const pct  = Math.round((Math.abs(val) / max) * 100);
    const label = val > 0 ? `يستحق ${formatCurrency(val)}` : val < 0 ? `يدفع ${formatCurrency(Math.abs(val))}` : 'مستوٍ';
    return `<div class="settle-row">
      ${renderAvatar(m.name,'sm')}
      <span class="settle-name">${esc(m.name)}</span>
      <div class="settle-bar-wrap">
        <div class="settle-bar"><div class="settle-bar-fill ${sign}" style="width:${pct}%"></div></div>
      </div>
      <span class="settle-amount ${sign}">${label}</span>
    </div>`;
  }).join('');
}

function openExpenseModal() {
  _modalType   = 'expense';
  _modalEditId = null;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-receipt"></i> إضافة مصروف';
  document.getElementById('modalBody').innerHTML  = expenseFormHtml({});
  populateMembersSelect('ePayedBy');
  populateMembersCheckboxes('eParticipants');
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('eTitle').focus(), 100);
}

function openEditExpenseModal(id) {
  const exp = S.expenses[id]; if (!exp) return;
  _modalType   = 'expense';
  _modalEditId = id;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> تعديل المصروف';
  document.getElementById('modalBody').innerHTML  = expenseFormHtml(exp);
  populateMembersSelect('ePayedBy', exp.paidBy);
  populateMembersCheckboxes('eParticipants', exp.participants);
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('eTitle').focus(), 100);
}

function expenseFormHtml(exp) {
  const catOptions = Object.entries(EXP_CATEGORIES).map(([k, v]) =>
    `<option value="${k}"${exp.category===k?' selected':''}>${v.label}</option>`).join('');
  return `
    <div class="field-row">
      <div class="field field--grow">
        <label class="field-label">العنوان <span class="req">*</span></label>
        <input type="text" id="eTitle" class="field-input" value="${esc(exp.title||'')}" placeholder="مثال: فحم شواء" autocomplete="off">
      </div>
      <div class="field" style="width:130px;flex-shrink:0">
        <label class="field-label">المبلغ (ج.م) <span class="req">*</span></label>
        <input type="number" id="eAmount" class="field-input" value="${exp.amount||''}" placeholder="0" min="0" step="0.5">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">من دفع؟</label>
        <div class="select-wrap">
          <select id="ePayedBy" class="field-input field-select"><option value="">— غير محدد —</option></select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
      <div class="field">
        <label class="field-label">الفئة</label>
        <div class="select-wrap">
          <select id="eCategory" class="field-input field-select">${catOptions}</select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="field-label">المشاركون في المصروف</label>
      <div id="eParticipants" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:var(--bg-input);border:1px solid var(--bd);border-radius:var(--r-md);min-height:40px"></div>
    </div>
    <div class="field">
      <label class="field-label">ملاحظات</label>
      <input type="text" id="eNotes" class="field-input" value="${esc(exp.notes||'')}" placeholder="تفاصيل إضافية...">
    </div>`;
}

function populateMembersCheckboxes(containerId, selected = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const members = Object.entries(S.members);
  if (!members.length) { container.innerHTML = '<span style="font-size:12px;color:var(--t3)">لا يوجد أعضاء</span>'; return; }
  container.innerHTML = members.map(([id, m]) => {
    const checked = !selected.length || selected.includes(id);
    return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600;color:var(--t1)">
      <input type="checkbox" value="${id}" ${checked?'checked':''} style="accent-color:var(--accent);width:15px;height:15px">
      ${renderAvatar(m.name,'xs')} ${esc(m.name)}
    </label>`;
  }).join('');
}

function saveExpense() {
  const title  = document.getElementById('eTitle').value.trim();
  const amount = parseFloat(document.getElementById('eAmount').value);
  if (!title)       { shakeEl(document.getElementById('eTitle'));  showToast('الرجاء إدخال العنوان', 'error'); return false; }
  if (!amount || amount <= 0) { shakeEl(document.getElementById('eAmount')); showToast('الرجاء إدخال مبلغ صحيح', 'error'); return false; }

  const checkboxes = document.querySelectorAll('#eParticipants input[type="checkbox"]:checked');
  const participants = Array.from(checkboxes).map(c => c.value);

  const data = {
    title,
    amount,
    paidBy:       document.getElementById('ePayedBy').value,
    category:     document.getElementById('eCategory').value || 'other',
    participants,
    notes:        document.getElementById('eNotes').value.trim(),
    createdAt:    _modalEditId ? (S.expenses[_modalEditId]?.createdAt || Date.now()) : Date.now(),
  };

  const id = _modalEditId || genId();
  S.expenses[id] = data;
  fbSet(`expenses/${id}`, data);
  renderExpenses();
  renderStats();
  showToast(_modalEditId ? 'تم التعديل' : 'تمت الإضافة', 'success');
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  MEALS TAB
// ═══════════════════════════════════════════════════════════════

const MEAL_TYPES = {
  breakfast: { label: 'الفطور',  icon: 'ph-sun',           cls: 'breakfast' },
  lunch:     { label: 'الغداء',  icon: 'ph-sun-horizon',   cls: 'lunch' },
  dinner:    { label: 'العشاء',  icon: 'ph-moon',          cls: 'dinner' },
  snacks:    { label: 'السناكس', icon: 'ph-cookie',        cls: 'snacks' },
};

function renderMeals() {
  const list  = Object.entries(S.meals).map(([id, d]) => ({ id, ...d }));
  const empty = document.getElementById('mealEmpty');
  const cont  = document.getElementById('mealsContent');

  if (list.length === 0) { empty.classList.remove('hidden'); cont.classList.add('hidden'); return; }
  empty.classList.add('hidden'); cont.classList.remove('hidden');

  Object.entries(MEAL_TYPES).forEach(([type, meta]) => {
    const items = list.filter(m => m.type === type).sort((a, b) => (a.time||'').localeCompare(b.time||''));
    const wrap  = document.getElementById(`meals${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (!wrap) return;
    if (items.length === 0) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="meal-section-title ${meta.cls}"><i class="ph-fill ${meta.icon}"></i>${meta.label}</div>
      <div class="meal-cards">${items.map(m => buildMealCard(m)).join('')}</div>`;
  });
}

function buildMealCard(meal) {
  const member = meal.assignedTo ? S.members[meal.assignedTo] : null;
  return `<div class="meal-card">
    <div class="meal-body">
      <div class="meal-title">${esc(meal.title)}</div>
      <div class="meal-meta">
        ${meal.time ? `<div class="meal-time"><i class="ph ph-clock"></i>${formatTime(meal.time)}</div>` : ''}
        ${member ? `<div class="meal-assigned">${renderAvatar(member.name,'xs')}<span>${esc(member.name)}</span></div>` : ''}
      </div>
      ${meal.ingredients ? `<div class="meal-ingredients"><i class="ph ph-list-bullets" style="font-size:11px;margin-left:4px"></i>${esc(meal.ingredients)}</div>` : ''}
    </div>
    <div class="meal-actions">
      <button class="item-act-btn" onclick="openEditMealModal('${meal.id}')" title="تعديل"><i class="ph ph-pencil-simple"></i></button>
      <button class="item-act-btn del" onclick="confirmDelete('meal','${meal.id}','${esc(meal.title)}')" title="حذف"><i class="ph ph-trash"></i></button>
    </div>
  </div>`;
}

function openMealModal() {
  _modalType   = 'meal';
  _modalEditId = null;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-fork-knife"></i> إضافة وجبة';
  document.getElementById('modalBody').innerHTML  = mealFormHtml({});
  populateMembersSelect('mAssigned');
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('mTitle').focus(), 100);
}

function openEditMealModal(id) {
  const meal = S.meals[id]; if (!meal) return;
  _modalType   = 'meal';
  _modalEditId = id;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-pencil-simple"></i> تعديل الوجبة';
  document.getElementById('modalBody').innerHTML  = mealFormHtml(meal);
  populateMembersSelect('mAssigned', meal.assignedTo);
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('mTitle').focus(), 100);
}

function mealFormHtml(meal) {
  const typeOpts = Object.entries(MEAL_TYPES).map(([k, v]) =>
    `<option value="${k}"${meal.type===k?' selected':''}>${v.label}</option>`).join('');
  return `
    <div class="field-row">
      <div class="field field--grow">
        <label class="field-label">اسم الوجبة <span class="req">*</span></label>
        <input type="text" id="mTitle" class="field-input" value="${esc(meal.title||'')}" placeholder="مثال: شواء مشكل" autocomplete="off">
      </div>
      <div class="field" style="width:120px;flex-shrink:0">
        <label class="field-label">النوع</label>
        <div class="select-wrap">
          <select id="mType" class="field-input field-select">${typeOpts}</select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">الوقت</label>
        <input type="time" id="mTime" class="field-input" value="${meal.time||''}">
      </div>
      <div class="field">
        <label class="field-label">المسؤول</label>
        <div class="select-wrap">
          <select id="mAssigned" class="field-input field-select"><option value="">— غير محدد —</option></select>
          <i class="ph ph-caret-down sel-arrow"></i>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="field-label">المكونات المطلوبة</label>
      <input type="text" id="mIngredients" class="field-input" value="${esc(meal.ingredients||'')}" placeholder="مثال: لحم، فحم، بهارات...">
    </div>`;
}

function saveMeal() {
  const title = document.getElementById('mTitle').value.trim();
  if (!title) { shakeEl(document.getElementById('mTitle')); showToast('الرجاء إدخال اسم الوجبة', 'error'); return false; }

  const data = {
    title,
    type:        document.getElementById('mType').value || 'lunch',
    time:        document.getElementById('mTime').value,
    assignedTo:  document.getElementById('mAssigned').value,
    ingredients: document.getElementById('mIngredients').value.trim(),
    createdAt:   _modalEditId ? (S.meals[_modalEditId]?.createdAt || Date.now()) : Date.now(),
  };

  const id = _modalEditId || genId();
  S.meals[id] = data;
  fbSet(`meals/${id}`, data);
  renderMeals();
  showToast(_modalEditId ? 'تم التعديل' : 'تمت الإضافة', 'success');
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  MEMBERS TAB
// ═══════════════════════════════════════════════════════════════

function renderMembers() {
  const members = Object.entries(S.members);
  const grid = document.getElementById('memberGrid');

  // Calc items per member
  const itemCounts = {}, expCounts = {};
  Object.values(S.items).forEach(i => { if (i.assignedTo) itemCounts[i.assignedTo] = (itemCounts[i.assignedTo]||0)+1; });
  Object.values(S.expenses).forEach(e => { if (e.paidBy) expCounts[e.paidBy] = (expCounts[e.paidBy]||0)+(e.amount||0); });

  if (!members.length) {
    grid.innerHTML = '<p style="color:var(--t3);font-size:13px;text-align:center;padding:24px">أضف أعضاء للرحلة</p>';
  } else {
    grid.innerHTML = members.map(([id, m]) => `
      <div class="member-card">
        <button class="member-card-del" onclick="deleteMember('${id}')" title="حذف"><i class="ph ph-x"></i></button>
        ${renderAvatar(m.name,'xl')}
        <div class="member-name">${esc(m.name)}</div>
        <div class="member-stats">
          <div class="member-stat">
            <span class="member-stat-val">${itemCounts[id]||0}</span>
            <span class="member-stat-lbl">عناصر</span>
          </div>
          <div class="member-stat">
            <span class="member-stat-val">${formatCurrency(expCounts[id]||0)}</span>
            <span class="member-stat-lbl">مدفوع</span>
          </div>
        </div>
      </div>`).join('');
  }

  renderResponsibilities();
  renderStats();
}

function renderResponsibilities() {
  const members = Object.entries(S.members);
  const el = document.getElementById('respCards');
  if (!members.length) { el.innerHTML = ''; return; }

  const byMember = {};
  Object.values(S.items).forEach(item => {
    if (item.assignedTo && !item.purchased) {
      if (!byMember[item.assignedTo]) byMember[item.assignedTo] = [];
      byMember[item.assignedTo].push(item);
    }
  });
  Object.values(S.activities).forEach(act => {
    if (act.assignedTo && act.status !== 'done') {
      if (!byMember[act.assignedTo]) byMember[act.assignedTo] = [];
      byMember[act.assignedTo].push({ ...act, _type: 'activity' });
    }
  });

  const withResponsibilities = members.filter(([id]) => byMember[id]?.length);
  if (!withResponsibilities.length) {
    el.innerHTML = '<p style="color:var(--t3);font-size:13px">لا توجد مسؤوليات معلّقة</p>';
    return;
  }

  el.innerHTML = withResponsibilities.map(([id, m]) => `
    <div class="resp-card">
      <div class="resp-card-head">
        ${renderAvatar(m.name,'sm')}
        <span class="resp-card-name">${esc(m.name)}</span>
        <span style="font-size:11px;color:var(--t3);margin-right:auto">${byMember[id].length} مهمة</span>
      </div>
      <div class="resp-chips">
        ${byMember[id].map(task => {
          const cat = task._type === 'activity'
            ? CATEGORIES.other
            : (CATEGORIES[task.category] || CATEGORIES.other);
          return `<span class="resp-chip"><i class="ph ${cat.icon}"></i>${esc(task.title || task.name)}</span>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function addMember() {
  const input = document.getElementById('memberInput');
  const name  = input.value.trim();
  if (!name) { shakeEl(input); return; }
  if (name.length > 30) { showToast('الاسم طويل جداً', 'error'); return; }
  if (Object.values(S.members).some(m => m.name.toLowerCase() === name.toLowerCase())) {
    showToast('هذا العضو موجود مسبقاً', 'error'); return;
  }

  const id = genId();
  S.members[id] = { name };
  fbSet(`members/${id}`, { name });
  input.value = '';
  renderMembers();
  showToast(`تمت إضافة ${name}`, 'success');
}

function deleteMember(id) {
  const name = S.members[id]?.name || '';
  delete S.members[id];
  fbRemove(`members/${id}`);
  // Unassign items and activities
  Object.entries(S.items).forEach(([iid, item]) => {
    if (item.assignedTo === id) { S.items[iid].assignedTo = ''; fbSet(`items/${iid}/assignedTo`, ''); }
  });
  Object.entries(S.activities).forEach(([aid, act]) => {
    if (act.assignedTo === id) { S.activities[aid].assignedTo = ''; fbSet(`activities/${aid}/assignedTo`, ''); }
  });
  renderMembers();
  showToast(`تم حذف ${name}`, 'info');
}

function populateMembersSelect(selectId, selectedId = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">— غير محدد —</option>` +
    Object.entries(S.members).map(([id, m]) =>
      `<option value="${id}"${id === selectedId ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
}

document.getElementById('memberInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addMember(); }
});

// ═══════════════════════════════════════════════════════════════
//  MEMORIES TAB
// ═══════════════════════════════════════════════════════════════

function renderMemories() {
  const list  = Object.entries(S.memories).map(([id, d]) => ({ id, ...d }));
  const empty = document.getElementById('memEmpty');
  const grid  = document.getElementById('memGrid');

  if (list.length === 0) { empty.classList.remove('hidden'); grid.innerHTML = ''; return; }
  empty.classList.add('hidden');

  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  grid.innerHTML = list.map(mem => `
    <div class="memory-card">
      <div class="memory-img-wrap">
        <img class="memory-img" src="${esc(mem.url)}" alt="${esc(mem.caption||'ذكرى')}"
          onerror="this.parentNode.innerHTML='<div class=\\'memory-img-fallback\\'><i class=\\'ph ph-image-broken\\'></i><span>تعذّر تحميل الصورة</span></div>'">
      </div>
      <div class="memory-body">
        <div class="memory-caption">${esc(mem.caption || 'بدون عنوان')}</div>
        <div class="memory-date">${mem.createdAt ? new Date(mem.createdAt).toLocaleDateString('ar-EG') : ''}</div>
      </div>
      <button class="memory-del" onclick="deleteMemory('${mem.id}')" title="حذف"><i class="ph ph-x"></i></button>
    </div>`).join('');
}

function openMemoryModal() {
  _modalType   = 'memory';
  _modalEditId = null;
  document.getElementById('modalTitle').innerHTML = '<i class="ph ph-image-square"></i> إضافة ذكرى';
  document.getElementById('modalBody').innerHTML  = `
    <div class="field">
      <label class="field-label">رابط الصورة <span class="req">*</span></label>
      <input type="url" id="memUrl" class="field-input" placeholder="https://..." autocomplete="off">
    </div>
    <div class="field">
      <label class="field-label">العنوان / الوصف</label>
      <input type="text" id="memCaption" class="field-input" placeholder="مثال: لحظة الوصول" autocomplete="off">
    </div>
    <p style="font-size:11px;color:var(--t3)">يمكنك استخدام روابط من Google Photos أو Imgur أو أي رابط صورة مباشر</p>`;
  showOverlay('modalOverlay');
  setTimeout(() => document.getElementById('memUrl').focus(), 100);
}

function saveMemory() {
  const url = document.getElementById('memUrl').value.trim();
  if (!url) { shakeEl(document.getElementById('memUrl')); showToast('الرجاء إدخال رابط الصورة', 'error'); return false; }

  const data = {
    url,
    caption:   document.getElementById('memCaption').value.trim(),
    createdAt: Date.now(),
  };

  const id = genId();
  S.memories[id] = data;
  fbSet(`memories/${id}`, data);
  renderMemories();
  showToast('تمت إضافة الذكرى', 'success');
  return true;
}

function deleteMemory(id) {
  delete S.memories[id];
  fbRemove(`memories/${id}`);
  renderMemories();
  showToast('تم حذف الذكرى', 'info');
}

// ═══════════════════════════════════════════════════════════════
//  MODAL SYSTEM (generic)
// ═══════════════════════════════════════════════════════════════

function modalSave() {
  const savers = { item: saveItem, activity: saveActivity, expense: saveExpense, meal: saveMeal, memory: saveMemory };
  const fn = savers[_modalType];
  if (fn && fn()) closeModal();
}

function closeModal() { hideOverlay('modalOverlay'); _modalType = null; _modalEditId = null; }

// Trip edit modal
function openEditTripModal() {
  const info = S.info;
  document.getElementById('etName').value     = info.name     || '';
  document.getElementById('etType').value     = info.type     || 'farm';
  document.getElementById('etLocation').value = info.location || '';
  document.getElementById('etBudget').value   = info.budget   || '';
  document.getElementById('etStart').value    = info.startDate || '';
  document.getElementById('etEnd').value      = info.endDate   || '';
  document.getElementById('etDesc').value     = info.description || '';
  showOverlay('tripEditOverlay');
  setTimeout(() => document.getElementById('etName').focus(), 100);
}
function closeEditTripModal() { hideOverlay('tripEditOverlay'); }

function saveEditTrip() {
  const name = document.getElementById('etName').value.trim();
  if (!name) { shakeEl(document.getElementById('etName')); showToast('الرجاء إدخال الاسم', 'error'); return; }

  S.info = {
    ...S.info,
    name,
    type:        document.getElementById('etType').value,
    location:    document.getElementById('etLocation').value.trim(),
    budget:      parseFloat(document.getElementById('etBudget').value) || 0,
    startDate:   document.getElementById('etStart').value,
    endDate:     document.getElementById('etEnd').value,
    description: document.getElementById('etDesc').value.trim(),
  };
  fbSet('info', S.info);
  persist();
  closeEditTripModal();
  renderCover();
  showToast('تم تعديل الرحلة', 'success');
}

// ── CONFIRM DELETE ────────────────────────────────────────────
let _pendingDelete = null;

function confirmDelete(type, id, name) {
  _pendingDelete = { type, id };
  const labels = { item:'العنصر', activity:'النشاط', expense:'المصروف', meal:'الوجبة' };
  document.getElementById('confirmMsg').textContent = `هل تريد حذف ${labels[type]||''} "${name}"؟`;
  showOverlay('confirmOverlay');
}

function confirmDeleteTrip() {
  _pendingDelete = { type: 'trip' };
  document.getElementById('confirmMsg').textContent = 'سيتم حذف الرحلة وجميع بياناتها. هل أنت متأكد؟';
  showOverlay('confirmOverlay');
}

document.getElementById('confirmOk').addEventListener('click', () => {
  if (_pendingDelete) {
    const { type, id } = _pendingDelete;
    if (type === 'trip') {
      if (S.isLocalMode) lsDeleteTrip(S.tripId);
      else window.db.ref(`trips/${S.tripId}`).remove();
      window.location.href = 'app.html';
      return;
    }
    const maps = { item: S.items, activity: S.activities, expense: S.expenses, meal: S.meals };
    const paths = { item:'items', activity:'activities', expense:'expenses', meal:'meals' };
    delete maps[type][id];
    fbRemove(`${paths[type]}/${id}`);
    renderActiveTab();
    renderStats();
    showToast('تم الحذف', 'info');
    _pendingDelete = null;
  }
  hideOverlay('confirmOverlay');
});

document.getElementById('confirmCancel').addEventListener('click', () => {
  _pendingDelete = null;
  hideOverlay('confirmOverlay');
});

// ── TRIP HEADER MENU ──────────────────────────────────────────
document.getElementById('tripMenuBtn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('tripDropdown').classList.toggle('hidden');
});
document.addEventListener('click', () => document.getElementById('tripDropdown').classList.add('hidden'));

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

// ── SHAKE ─────────────────────────────────────────────────────
function shakeEl(el) {
  el?.animate([
    {transform:'translateX(0)'},{transform:'translateX(-7px)'},
    {transform:'translateX(7px)'},{transform:'translateX(-4px)'},
    {transform:'translateX(4px)'},{transform:'translateX(0)'}
  ], { duration:350, easing:'ease' });
}

// ── KEYBOARD ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeEditTripModal();
    hideOverlay('confirmOverlay');
  }
});

// ── INIT ──────────────────────────────────────────────────────
updateFab();
initData();
