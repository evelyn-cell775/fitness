/* 界面渲染：页面、弹层、打卡流程 */

// ---------- 基础工具 ----------
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;
function toast(msg) {
  const root = document.getElementById('toast-root');
  root.innerHTML = '';
  const t = el('<div class="toast">' + esc(msg) + '</div>');
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

// ---------- 弹层 ----------
function openOverlay({ type = 'sheet', title = '', content = '', footer = '', onMount = null }) {
  closeOverlay();
  const root = document.getElementById('overlay-root');
  const ov = el(`
    <div class="overlay overlay-${type}">
      ${type === 'sheet' ? '<div class="overlay-backdrop" data-close></div>' : ''}
      <div class="overlay-panel">
        <div class="overlay-head">
          <h2 class="overlay-title">${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="关闭">✕</button>
        </div>
        <div class="overlay-body">${content}</div>
        ${footer ? `<div class="overlay-foot${footer.indexOf('btn-block') >= 0 ? ' col' : ''}">${footer}</div>` : ''}
      </div>
    </div>`);
  root.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  if (onMount) onMount(ov);
  return ov;
}

function closeOverlay() {
  document.getElementById('overlay-root').innerHTML = '';
}

function confirmDialog({ title = '确认', message, danger = false, okText = '确定', onOk }) {
  openOverlay({
    type: 'sheet',
    title,
    content: `<p class="confirm-msg">${esc(message)}</p>`,
    footer: `
      <button class="btn" data-close>取消</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
    onMount(ov) {
      ov.querySelector('[data-ok]').addEventListener('click', () => {
        closeOverlay();
        onOk();
      });
    },
  });
}

// ---------- 日期显示 ----------
function dateLabel(dateStr) {
  const d = parseDate(dateStr);
  const now = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return m + '月' + day + '日';
  return d.getFullYear() + '年' + m + '月' + day + '日';
}

// ---------- 主题 ----------
// 彩色主题只换强调色；深夜黑额外覆盖中性色（背景/卡片/文字等）
const THEMES = [
  { id: 'green', name: '活力绿', swatch: '#10b981', colors: { primary: '#10b981', primaryDark: '#059669', primaryLight: '#d1fae5' } },
  { id: 'purple', name: '梦幻紫', swatch: '#8b5cf6', colors: { primary: '#8b5cf6', primaryDark: '#7c3aed', primaryLight: '#ede9fe' } },
  { id: 'blue', name: '清新蓝', swatch: '#3b82f6', colors: { primary: '#3b82f6', primaryDark: '#2563eb', primaryLight: '#dbeafe' } },
  { id: 'orange', name: '活力橙', swatch: '#f97316', colors: { primary: '#f97316', primaryDark: '#ea580c', primaryLight: '#ffedd5' } },
  { id: 'pink', name: '樱花粉', swatch: '#ec4899', colors: { primary: '#ec4899', primaryDark: '#db2777', primaryLight: '#fce7f3' } },
  {
    id: 'dark', name: '深夜黑', swatch: '#111827',
    colors: {
      primary: '#10b981', primaryDark: '#34d399', primaryLight: '#064e3b',
      bg: '#111827', card: '#1f2937', text: '#f3f4f6', muted: '#9ca3af', border: '#374151',
      bodyBg: '#0b0f17', inputBg: '#111827', inputBg2: '#243044',
      toastBg: 'rgba(243,244,246,.95)', toastFg: '#111827',
    },
  },
];

function applyTheme(id) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary', t.colors.primary);
  root.style.setProperty('--primary-dark', t.colors.primaryDark);
  root.style.setProperty('--primary-light', t.colors.primaryLight);
  // 中性色：深夜黑覆盖，其余主题还原为样式表默认值
  const neutral = ['--bg', '--card', '--text', '--muted', '--border', '--body-bg', '--input-bg', '--input-bg-2', '--toast-bg', '--toast-fg'];
  neutral.forEach(v => {
    if (t.colors.bg) {
      const map = { '--bg': 'bg', '--card': 'card', '--text': 'text', '--muted': 'muted', '--border': 'border', '--body-bg': 'bodyBg', '--input-bg': 'inputBg', '--input-bg-2': 'inputBg2', '--toast-bg': 'toastBg', '--toast-fg': 'toastFg' };
      const key = map[v];
      if (t.colors[key]) root.style.setProperty(v, t.colors[key]);
      else root.style.removeProperty(v);
    } else {
      root.style.removeProperty(v);
    }
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.colors.primary);
  Store.theme = id;
}

function themeName(id) {
  const t = THEMES.find(x => x.id === id);
  return t ? t.name : THEMES[0].name;
}

// ---------- Tab 1：今日打卡 ----------
let calOffset = 0;

function calMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
}

function calendarCellsHtml() {
  const base = calMonthDate();
  const y = base.getFullYear(), m = base.getMonth();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7; // 周一开头
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const t = todayStr();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmtDate(new Date(y, m, d));
    const checked = !!Store.getCheckin(ds);
    const isToday = ds === t;
    const isFuture = ds > t;
    cells += `<button class="cal-cell${checked ? ' done' : ''}${isToday ? ' today' : ''}" data-date="${ds}"${isFuture ? ' disabled' : ''}>${d}</button>`;
  }
  return cells;
}

function dayRecordHtml(r) {
  return `
    <div class="day-record">
      <span class="ex-emoji">${r.emoji || '💪'}</span>
      <div class="day-record-main">
        <div class="day-record-name">${esc(r.exName)}</div>
        <div class="day-record-detail">${recordSummary(r)}</div>
      </div>
    </div>`;
}

function recordSummary(r) {
  const parts = [];
  if (r.sets && r.sets.length) {
    const setStr = r.sets.map(s => {
      const reps = (s.reps || '').trim();
      const w = (s.weight || '').trim();
      if (reps && w) return reps + '次×' + w + 'kg';
      if (reps) return reps + '次';
      if (w) return w + 'kg';
      return '';
    }).filter(Boolean).join(' · ');
    if (setStr) parts.push(r.sets.length + '组：' + setStr);
  }
  if (r.note) parts.push(esc(r.note));
  return parts.length ? parts.join('｜') : '简单打卡';
}

function todayCardHtml() {
  const recs = Store.getCheckin(todayStr());
  if (recs && recs.length) {
    return `
      <div class="today-title">今日已完成 ✅</div>
      <div class="day-records">${recs.map(dayRecordHtml).join('')}</div>
      <button class="btn btn-primary btn-block" data-action="edit-today">编辑今日打卡</button>`;
  }
  return `
    <div class="today-title">今天练了吗？</div>
    <p class="today-sub">从动作库选择动作卡片，一键打卡</p>
    <button class="btn btn-primary btn-block" data-action="checkin">💪 去打卡</button>`;
}

function renderToday() {
  const s = Store.stats();
  const base = calMonthDate();
  const page = document.getElementById('page-today');
  page.innerHTML = `
    <section class="hero">
      <div>
        <div class="hero-num">${s.currentStreak}<span class="hero-unit">天</span></div>
        <div class="hero-sub">🔥 连续打卡</div>
      </div>
      <div class="hero-side">
        <div>累计 <b>${s.totalDays}</b> 天</div>
        <div>本月 <b>${s.monthDays}</b> 天</div>
      </div>
    </section>
    <section class="card">
      <div class="cal-head">
        <button class="icon-btn" id="cal-prev" aria-label="上个月">‹</button>
        <span>${base.getFullYear()}年${base.getMonth() + 1}月</span>
        <button class="icon-btn" id="cal-next" aria-label="下个月">›</button>
      </div>
      <div class="cal-week">${['一', '二', '三', '四', '五', '六', '日'].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${calendarCellsHtml()}</div>
    </section>
    <section class="card">${todayCardHtml()}</section>
  `;
}

// 日历某天的详情弹层
function openDaySheet(dateStr) {
  const recs = Store.getCheckin(dateStr) || [];
  const isFuture = dateStr > todayStr();
  const isPast = dateStr < todayStr();
  openOverlay({
    type: 'sheet',
    title: dateLabel(dateStr) + ' 打卡记录',
    content: recs.length
      ? `<div class="day-records">${recs.map(dayRecordHtml).join('')}</div>`
      : `<div class="empty"><span class="big">😴</span>这天没有打卡记录</div>`,
    footer: isFuture ? `<button class="btn btn-block" data-close>关闭</button>` : `
      <button class="btn" data-close>关闭</button>
      ${isPast && recs.length ? '<button class="btn" id="day-copy">📋 复制到今日</button>' : ''}
      <button class="btn btn-primary" id="day-edit">${recs.length ? '编辑' : '补打卡'}</button>`,
    onMount(ov) {
      const editBtn = ov.querySelector('#day-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          openCheckinForm(dateStr, Store.getCheckin(dateStr));
        });
      }
      const copyBtn = ov.querySelector('#day-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => copyPlanToToday(dateStr));
      }
    },
  });
}

// 把任意过去一天的打卡计划复制到今日（今日已有的动作不重复添加）
function copyPlanToToday(dateStr) {
  const src = Store.getCheckin(dateStr);
  if (!src || !src.length) { toast('该天没有打卡记录'); return; }
  const cur = Store.getCheckin(todayStr()) || [];
  const existingIds = new Set(cur.map(r => r.exId));
  const added = [];
  for (const r of src) {
    if (existingIds.has(r.exId)) continue; // 今日已有该动作
    if (!Store.getExercises().some(e => e.id === r.exId)) continue; // 动作已从库中删除
    added.push({
      exId: r.exId, exName: r.exName, emoji: r.emoji || '💪',
      sets: (r.sets || []).map(s => ({ reps: s.reps || '', weight: s.weight || '' })),
      note: r.note || '',
      doneAt: null,
    });
    existingIds.add(r.exId);
  }
  if (!added.length) { toast('没有可复制的动作（今日已有或已删除）'); return; }
  closeOverlay();
  openCheckinForm(todayStr(), cur.concat(added));
  toast('已复制 ' + dateLabel(dateStr) + ' 的计划');
}

// ---------- Tab 2：动作库 ----------
let libState = { cat: 'all', q: '' };

function libChipsHtml(cat) {
  const cur = cat || libState.cat;
  return `<button class="chip${cur === 'all' ? ' active' : ''}" data-cat="all">全部</button>` +
    CATEGORIES.map(c => `<button class="chip${cur === c.id ? ' active' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
}

function renderLibrary() {
  document.getElementById('lib-count').textContent = '共 ' + Store.getExercises().length + ' 个动作，点击卡片查看详情';
  document.getElementById('lib-chips').innerHTML = libChipsHtml();
  renderLibraryList();
}

function renderLibraryList() {
  const q = libState.q.trim();
  const list = Store.getExercises().filter(e =>
    (libState.cat === 'all' || e.category === libState.cat) &&
    (!q || e.name.includes(q))
  );
  document.getElementById('lib-list').innerHTML = list.length
    ? `<div class="ex-grid">${list.map(e => `
        <button class="ex-card" data-action="open-ex" data-id="${e.id}">
          <span class="ex-emoji">${e.emoji}</span>
          <span class="ex-name">${esc(e.name)}</span>
          <span class="ex-cat">${esc(catName(e.category))}</span>
        </button>`).join('')}</div>`
    : `<div class="empty"><span class="big">🔍</span>没有找到动作</div>`;
}

function openExerciseDetail(id) {
  const e = Store.getExercises().find(x => x.id === id);
  if (!e) return;
  openOverlay({
    type: 'sheet',
    title: e.name,
    content: `
      <div class="ex-detail">
        <div class="ex-detail-emoji">${e.emoji}</div>
        <div class="ex-detail-meta"><span class="tag">${esc(catName(e.category))}</span></div>
        ${e.desc ? `<p class="ex-detail-desc">${esc(e.desc)}</p>` : ''}
        <p class="ex-detail-created">创建于 ${e.createdAt ? e.createdAt.slice(0, 10) : '—'}</p>
      </div>`,
    footer: `
      <button class="btn btn-primary" id="ex-edit">编辑</button>
      <button class="btn btn-danger" id="ex-del">删除</button>`,
    onMount(ov) {
      ov.querySelector('#ex-edit').addEventListener('click', () => openExerciseForm(e));
      ov.querySelector('#ex-del').addEventListener('click', () => {
        confirmDialog({
          title: '删除动作',
          message: '确定删除「' + e.name + '」吗？历史打卡记录不受影响。',
          danger: true,
          okText: '删除',
          onOk() {
            Store.deleteExercise(id);
            closeOverlay();
            renderLibrary();
            toast('已删除');
          },
        });
      });
    },
  });
}

const EMOJI_OPTIONS = ['💪', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🏃', '🚶', '🚴', '🧘', '🤸', '🤾', '🏊', '🦵', '🦶', '🫁', '🔥', '⚡', '🧱', '🪵', '🐱', '🦋', '🕊️', '🌀', '💫', '🎗️', '🌉', '🪢', '⭐', '🙆', '🙋', '👐'];

function openExerciseForm(ex) {
  const isEdit = !!ex;
  openOverlay({
    type: 'full',
    title: isEdit ? '编辑动作' : '新增动作',
    content: `
      <div class="form">
        <label class="form-label">动作名称 *</label>
        <input id="exf-name" class="input" placeholder="例如：俯卧撑" value="${esc(ex ? ex.name : '')}">
        <label class="form-label">分类</label>
        <div class="chips" id="exf-cats">${CATEGORIES.map(c =>
          `<button class="chip${(ex ? ex.category : 'chest') === c.id ? ' active' : ''}" data-cat="${c.id}">${c.name}</button>`
        ).join('')}</div>
        <label class="form-label">图标</label>
        <div class="emoji-grid" id="exf-emojis">${EMOJI_OPTIONS.map(em =>
          `<button class="emoji-opt${(ex ? ex.emoji : '💪') === em ? ' active' : ''}" data-emoji="${em}">${em}</button>`
        ).join('')}</div>
        <label class="form-label">描述（可选）</label>
        <textarea id="exf-desc" class="input" rows="3" placeholder="动作要领、注意事项…">${esc(ex ? ex.desc : '')}</textarea>
      </div>`,
    footer: `
      <button class="btn" data-close>取消</button>
      <button class="btn btn-primary" id="exf-save">保存</button>`,
    onMount(ov) {
      let cat = ex ? ex.category : 'chest';
      let emoji = ex ? ex.emoji : '💪';
      ov.querySelector('#exf-cats').addEventListener('click', e2 => {
        const b = e2.target.closest('.chip');
        if (!b) return;
        cat = b.dataset.cat;
        ov.querySelectorAll('#exf-cats .chip').forEach(c => c.classList.toggle('active', c === b));
      });
      ov.querySelector('#exf-emojis').addEventListener('click', e2 => {
        const b = e2.target.closest('.emoji-opt');
        if (!b) return;
        emoji = b.dataset.emoji;
        ov.querySelectorAll('#exf-emojis .emoji-opt').forEach(c => c.classList.toggle('active', c === b));
      });
      ov.querySelector('#exf-save').addEventListener('click', () => {
        const name = ov.querySelector('#exf-name').value.trim();
        if (!name) { toast('请填写动作名称'); return; }
        Store.saveExercise({
          id: ex ? ex.id : null,
          name,
          category: cat,
          emoji,
          desc: ov.querySelector('#exf-desc').value.trim(),
        });
        closeOverlay();
        renderLibrary();
        toast(isEdit ? '已保存' : '已添加 🎉');
      });
    },
  });
}

// ---------- 打卡流程：选择动作弹层 ----------
let pickerState = null;

function openPicker({ preselected = [], onConfirm, onCancel = null }) {
  pickerState = { selected: new Set(preselected), cat: 'all', q: '', copied: null, histOpen: false };
  return openOverlay({
    type: 'sheet',
    title: '选择动作',
    content: `
      <div class="picker-history">
        <button class="ph-toggle" id="ph-toggle">📋 复制历史计划<span class="ph-arrow">▾</span></button>
        <div class="ph-list hidden" id="ph-list"></div>
      </div>
      <div class="picker-search"><input id="picker-q" class="input" placeholder="搜索动作名称…"></div>
      <div class="chips" id="picker-chips"></div>
      <div class="picker-list" id="picker-list"></div>`,
    footer: `
      <button class="btn" data-close>取消</button>
      <button class="btn btn-primary" id="picker-confirm">确定</button>`,
    onMount(o) {
      // 取消/关闭时若提供了回调（如从打卡表单进入），恢复表单
      if (onCancel) {
        o.querySelectorAll('[data-close]').forEach(x => {
          x.addEventListener('click', () => { closeOverlay(); onCancel(); });
        });
      }
      renderPickerList();
      const q = o.querySelector('#picker-q');
      q.addEventListener('input', () => { pickerState.q = q.value; renderPickerList(); });
      o.querySelector('#picker-chips').addEventListener('click', e => {
        const b = e.target.closest('.chip');
        if (!b) return;
        pickerState.cat = b.dataset.cat;
        o.querySelectorAll('#picker-chips .chip').forEach(c => c.classList.toggle('active', c === b));
        renderPickerList();
      });
      // 复制历史计划：展开/收起与选择
      o.querySelector('#ph-toggle').addEventListener('click', () => {
        pickerState.histOpen = !pickerState.histOpen;
        o.querySelector('#ph-list').classList.toggle('hidden', !pickerState.histOpen);
        o.querySelector('.ph-arrow').classList.toggle('open', pickerState.histOpen);
      });
      o.querySelector('#ph-list').addEventListener('click', e => {
        const item = e.target.closest('.ph-item');
        if (!item) return;
        applyHistoryCopy(item.dataset.date);
      });
      o.querySelector('#picker-list').addEventListener('click', e => {
        const card = e.target.closest('.ex-card');
        if (!card) return;
        const id = card.dataset.id;
        if (pickerState.selected.has(id)) pickerState.selected.delete(id);
        else pickerState.selected.add(id);
        const on = pickerState.selected.has(id);
        card.classList.toggle('selected', on);
        card.querySelector('.ex-check').textContent = on ? '✓' : '';
        o.querySelector('#picker-confirm').textContent = '确定（' + pickerState.selected.size + '）';
      });
      o.querySelector('#picker-confirm').addEventListener('click', () => {
        onConfirm([...pickerState.selected], pickerState.copied ? pickerState.copied.map : null);
      });
    },
  });
}

// 一键复制某天的打卡计划（动作 + 组数/次数/备注）；再次点击同一天则取消
function applyHistoryCopy(dateStr) {
  const recs = Store.getCheckin(dateStr) || [];
  if (pickerState.copied && pickerState.copied.dateStr === dateStr) {
    pickerState.copied = null;
    pickerState.selected = new Set();
    toast('已取消复制');
    renderPickerList();
    return;
  }
  const map = {};
  const selected = new Set();
  for (const r of recs) {
    if (!Store.getExercises().some(e => e.id === r.exId)) continue; // 动作已从库中删除则跳过
    selected.add(r.exId);
    map[r.exId] = { sets: r.sets || [], note: r.note || '' };
  }
  if (!selected.size) { toast('该天的动作已全部被删除'); return; }
  pickerState.selected = selected;
  pickerState.copied = { dateStr, map };
  toast('已复制 ' + dateLabel(dateStr) + ' 的计划');
  renderPickerList();
}

// 最近有记录的日子（最新在前，最多 15 天）
function renderPhList() {
  const phEl = document.getElementById('ph-list');
  if (!phEl) return;
  const dates = Object.keys(Store.checkins)
    .filter(d => Array.isArray(Store.checkins[d]) && Store.checkins[d].length > 0)
    .sort().reverse().slice(0, 15);
  if (!dates.length) {
    phEl.innerHTML = '<div class="ph-empty">还没有历史打卡记录</div>';
    return;
  }
  const yesterday = addDays(todayStr(), -1);
  phEl.innerHTML = dates.map(ds => {
    const recs = Store.checkins[ds];
    const emojis = recs.slice(0, 4).map(r => r.emoji || '💪').join('');
    const active = pickerState.copied && pickerState.copied.dateStr === ds;
    return `
    <button class="ph-item${active ? ' active' : ''}" data-date="${ds}">
      <span class="ph-emoji">${emojis}</span>
      <span class="ph-label">${esc(dateLabel(ds))}${ds === yesterday ? '（昨天）' : ''} · ${recs.length} 个动作</span>
      <span class="ph-badge">${active ? '✓ 已复制' : '复制'}</span>
    </button>`;
  }).join('');
}

function renderPickerList() {
  const chipsEl = document.getElementById('picker-chips');
  const listEl = document.getElementById('picker-list');
  if (!chipsEl || !listEl) return;
  renderPhList();
  chipsEl.innerHTML = libChipsHtml(pickerState.cat);
  const conf = document.getElementById('picker-confirm');
  if (conf) conf.textContent = '确定（' + pickerState.selected.size + '）';
  const q = pickerState.q.trim();
  const list = Store.getExercises().filter(e =>
    (pickerState.cat === 'all' || e.category === pickerState.cat) &&
    (!q || e.name.includes(q))
  );
  listEl.innerHTML = list.length
    ? `<div class="ex-grid">${list.map(e => {
        const on = pickerState.selected.has(e.id);
        return `
        <button class="ex-card pick${on ? ' selected' : ''}" data-id="${e.id}">
          <span class="ex-check">${on ? '✓' : ''}</span>
          <span class="ex-emoji">${e.emoji}</span>
          <span class="ex-name">${esc(e.name)}</span>
          <span class="ex-cat">${esc(catName(e.category))}</span>
        </button>`;
      }).join('')}</div>`
    : `<div class="empty"><span class="big">🔍</span>没有找到动作，可先在动作库中添加</div>`;
}

function beginCheckin() {
  openPicker({
    preselected: [],
    onConfirm(ids, copyData) {
      if (!ids.length) { toast('请选择至少一个动作'); return; }
      const exs = Store.getExercises();
      const records = ids.map(id => {
        const e = exs.find(x => x.id === id);
        if (!e) return null;
        const c = copyData ? copyData[id] : null;
        return {
          exId: e.id, exName: e.name, emoji: e.emoji,
          sets: c ? c.sets.map(s => ({ reps: s.reps || '', weight: s.weight || '' })) : [],
          note: c ? c.note : '',
          doneAt: null,
        };
      }).filter(Boolean);
      openCheckinForm(todayStr(), records);
    },
  });
}

// ---------- 打卡流程：填写表单（全屏） ----------
let cfState = null;

function openCheckinForm(dateStr, records) {
  cfState = {
    dateStr,
    items: (records || []).map(r => ({
      exId: r.exId,
      exName: r.exName,
      emoji: r.emoji || '💪',
      sets: (r.sets || []).map(s => ({ reps: s.reps || '', weight: s.weight || '' })),
      note: r.note || '',
      doneAt: r.doneAt || null,
    })),
  };
  renderCheckinForm();
}

function setRowHtml(j, s) {
  return `
    <div class="set-row">
      <span class="set-no">${j + 1}</span>
      <input class="input set-reps" type="text" inputmode="numeric" placeholder="次数" value="${esc(s.reps)}">
      <input class="input set-weight" type="text" inputmode="decimal" placeholder="重量kg" value="${esc(s.weight)}">
      <button class="icon-btn set-del" title="删除这组">✕</button>
    </div>`;
}

function setSummary(it) {
  const n = it.sets.filter(s => (s.reps || '').trim() || (s.weight || '').trim()).length;
  if (!n && !it.note.trim()) return '未填详情';
  let s = n ? n + '组' : '';
  if (it.note.trim()) s += s ? ' · 有备注' : '有备注';
  return s;
}

function itemCardHtml(it, i) {
  const hasDetail = it.sets.length > 0 || !!it.note;
  const rows = it.sets.length
    ? it.sets.map((s, j) => setRowHtml(j, s)).join('')
    : setRowHtml(0, { reps: '', weight: '' });
  return `
  <div class="cf-item" data-i="${i}">
    <div class="cf-item-head" data-toggle>
      <span class="ex-emoji" style="font-size:22px">${it.emoji}</span>
      <span class="cf-item-name">${esc(it.exName)}</span>
      <span class="cf-item-sum">${setSummary(it)}</span>
      <button class="icon-btn" data-remove title="移除">✕</button>
      <span class="cf-item-arrow${hasDetail ? ' open' : ''}">▾</span>
    </div>
    <div class="cf-item-body${hasDetail ? '' : ' hidden'}">
      <div class="set-row-head"><span>组</span><span>次数</span><span>重量(kg)</span><span></span></div>
      <div class="set-rows">${rows}</div>
      <button class="btn btn-sm" data-addset>＋ 添加一组</button>
      <input class="input cf-note" placeholder="备注（可选）…" value="${esc(it.note)}">
    </div>
  </div>`;
}

function collectForm() {
  const items = [];
  document.querySelectorAll('.cf-item').forEach(itemEl => {
    const i = +itemEl.dataset.i;
    const it = cfState.items[i];
    if (!it) return;
    const sets = [];
    itemEl.querySelectorAll('.set-row').forEach(rowEl => {
      const reps = rowEl.querySelector('.set-reps').value.trim();
      const weight = rowEl.querySelector('.set-weight').value.trim();
      if (reps || weight) sets.push({ reps, weight });
    });
    items.push({ ...it, sets, note: itemEl.querySelector('.cf-note').value.trim() });
  });
  return items;
}

function renderCheckinForm() {
  const isEdit = Store.getCheckin(cfState.dateStr) !== null;
  openOverlay({
    type: 'full',
    title: dateLabel(cfState.dateStr) + ' 打卡',
    content: `
      ${cfState.items.length
        ? cfState.items.map((it, i) => itemCardHtml(it, i)).join('')
        : '<div class="empty"><span class="big">🤔</span>还没有选择动作</div>'}
      <button class="btn btn-block" id="cf-add">＋ 添加动作</button>`,
    footer: `
      <button class="btn btn-primary btn-block" id="cf-save">完成打卡 ✓</button>
      ${isEdit ? '<button class="btn btn-danger-ghost btn-block" id="cf-delete">删除本次打卡</button>' : ''}`,
    onMount(ov) {
      ov.querySelector('#cf-add').addEventListener('click', onAddExercise);
      ov.querySelector('#cf-save').addEventListener('click', onSaveCheckin);
      const del = ov.querySelector('#cf-delete');
      if (del) del.addEventListener('click', onDeleteCheckin);
      ov.querySelector('.overlay-body').addEventListener('click', e => {
        const rm = e.target.closest('[data-remove]');
        if (rm) { removeFormItem(+rm.closest('.cf-item').dataset.i); return; }
        const sd = e.target.closest('.set-del');
        if (sd) { sd.closest('.set-row').remove(); return; }
        const addset = e.target.closest('[data-addset]');
        if (addset) {
          const rows = addset.closest('.cf-item').querySelector('.set-rows');
          rows.insertAdjacentHTML('beforeend', setRowHtml(rows.querySelectorAll('.set-row').length, { reps: '', weight: '' }));
          return;
        }
        const head = e.target.closest('.cf-item-head');
        if (head) {
          const itemEl = head.closest('.cf-item');
          itemEl.querySelector('.cf-item-body').classList.toggle('hidden');
          head.querySelector('.cf-item-arrow').classList.toggle('open');
        }
      });
    },
  });
}

function removeFormItem(i) {
  const items = collectForm();
  items.splice(i, 1);
  cfState.items = items;
  renderCheckinForm();
}

function onAddExercise() {
  cfState.items = collectForm(); // 先收集未保存的填写内容
  openPicker({
    preselected: cfState.items.map(it => it.exId),
    onCancel() { renderCheckinForm(); },
    onConfirm(ids, copyData) {
      const exs = Store.getExercises();
      const existing = new Set(cfState.items.map(it => it.exId));
      for (const id of ids) {
        if (existing.has(id)) continue;
        const e = exs.find(x => x.id === id);
        if (e) {
          const c = copyData ? copyData[id] : null;
          cfState.items.push({
            exId: e.id, exName: e.name, emoji: e.emoji,
            sets: c ? c.sets.map(s => ({ reps: s.reps || '', weight: s.weight || '' })) : [],
            note: c ? c.note : '',
            doneAt: null,
          });
        }
      }
      renderCheckinForm();
    },
  });
}

function onSaveCheckin() {
  const items = collectForm();
  if (!items.length) { toast('请先选择至少一个动作'); return; }
  const records = items.map(it => ({
    exId: it.exId,
    exName: it.exName,
    emoji: it.emoji,
    sets: it.sets,
    note: it.note,
    doneAt: it.doneAt || new Date().toISOString(),
  }));
  Store.saveCheckin(cfState.dateStr, records);
  closeOverlay();
  renderToday();
  toast('打卡成功 🎉');
}

function onDeleteCheckin() {
  confirmDialog({
    title: '删除打卡',
    message: '确定删除 ' + dateLabel(cfState.dateStr) + ' 的打卡记录吗？',
    danger: true,
    okText: '删除',
    onOk() {
      Store.deleteCheckin(cfState.dateStr);
      closeOverlay();
      renderToday();
      toast('已删除');
    },
  });
}

// ---------- Tab 3：资料（网络收集的相关资料） ----------
const MAT_CATEGORIES = [
  { id: 'training', name: '训练知识' },
  { id: 'nutrition', name: '饮食营养' },
  { id: 'rehab', name: '康复指南' },
  { id: 'stretch', name: '拉伸放松' },
  { id: 'other', name: '其他' },
];

function matCatName(id) {
  const c = MAT_CATEGORIES.find(x => x.id === id);
  return c ? c.name : '其他';
}

let matState = { cat: 'all', q: '' };

function matChipsHtml() {
  const cur = matState.cat;
  return `<button class="chip${cur === 'all' ? ' active' : ''}" data-cat="all">全部</button>` +
    MAT_CATEGORIES.map(c => `<button class="chip${cur === c.id ? ' active' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
}

function renderMaterials() {
  document.getElementById('mat-count').textContent = '共 ' + Store.materials.length + ' 条资料，点击卡片查看详情';
  document.getElementById('mat-chips').innerHTML = matChipsHtml();
  renderMaterialsList();
}

function renderMaterialsList() {
  const q = matState.q.trim();
  const list = Store.materials.filter(m =>
    (matState.cat === 'all' || m.category === matState.cat) &&
    (!q || m.title.includes(q) || (m.note || '').includes(q))
  );
  document.getElementById('mat-list').innerHTML = list.length
    ? `<div class="mat-list">${list.map(m => `
        <button class="mat-card" data-action="open-mat" data-id="${m.id}">
          <div class="mat-head">
            <span class="mat-title">${esc(m.title)}</span>
            <span class="tag">${esc(matCatName(m.category))}</span>
          </div>
          ${m.note ? `<div class="mat-preview">${esc(m.note)}</div>` : ''}
          <div class="mat-meta">${m.url ? '🔗 含链接 · ' : ''}${m.createdAt ? m.createdAt.slice(0, 10) : ''}</div>
        </button>`).join('')}</div>`
    : `<div class="empty"><span class="big">📁</span>还没有资料<br>点右下角 ＋ 把网上收集的内容存进来</div>`;
}

function openMaterialDetail(id) {
  const m = Store.materials.find(x => x.id === id);
  if (!m) return;
  openOverlay({
    type: 'sheet',
    title: m.title,
    content: `
      <div class="ex-detail">
        <div class="ex-detail-meta"><span class="tag">${esc(matCatName(m.category))}</span></div>
        ${m.note ? `<p class="ex-detail-desc" style="white-space:pre-wrap">${esc(m.note)}</p>` : ''}
        ${m.url ? `<a class="btn btn-primary btn-block mat-link" href="${esc(m.url)}" target="_blank" rel="noopener">🔗 打开原文链接</a>` : ''}
        <p class="ex-detail-created">创建于 ${m.createdAt ? m.createdAt.slice(0, 10) : '—'}</p>
      </div>`,
    footer: `
      <button class="btn btn-primary" id="mat-edit">编辑</button>
      <button class="btn btn-danger" id="mat-del">删除</button>`,
    onMount(ov) {
      ov.querySelector('#mat-edit').addEventListener('click', () => openMaterialForm(m));
      ov.querySelector('#mat-del').addEventListener('click', () => {
        confirmDialog({
          title: '删除资料',
          message: '确定删除「' + m.title + '」吗？',
          danger: true,
          okText: '删除',
          onOk() {
            Store.deleteMaterial(id);
            closeOverlay();
            renderMaterials();
            toast('已删除');
          },
        });
      });
    },
  });
}

function openMaterialForm(m) {
  const isEdit = !!m;
  openOverlay({
    type: 'full',
    title: isEdit ? '编辑资料' : '新增资料',
    content: `
      <div class="form">
        <label class="form-label">标题 *</label>
        <input id="matf-title" class="input" placeholder="例如：深蹲动作要领详解" value="${esc(m ? m.title : '')}">
        <label class="form-label">分类</label>
        <div class="chips" id="matf-cats">${MAT_CATEGORIES.map(c =>
          `<button class="chip${(m ? m.category : 'training') === c.id ? ' active' : ''}" data-cat="${c.id}">${c.name}</button>`
        ).join('')}</div>
        <label class="form-label">原文链接（可选）</label>
        <input id="matf-url" class="input" type="url" placeholder="https://…" value="${esc(m ? m.url : '')}">
        <label class="form-label">内容 / 笔记（可选）</label>
        <textarea id="matf-note" class="input" rows="6" placeholder="粘贴要点、摘抄或自己的笔记…">${esc(m ? m.note : '')}</textarea>
      </div>`,
    footer: `
      <button class="btn" data-close>取消</button>
      <button class="btn btn-primary" id="matf-save">保存</button>`,
    onMount(ov) {
      let cat = m ? m.category : 'training';
      ov.querySelector('#matf-cats').addEventListener('click', e2 => {
        const b = e2.target.closest('.chip');
        if (!b) return;
        cat = b.dataset.cat;
        ov.querySelectorAll('#matf-cats .chip').forEach(c => c.classList.toggle('active', c === b));
      });
      ov.querySelector('#matf-save').addEventListener('click', () => {
        const title = ov.querySelector('#matf-title').value.trim();
        if (!title) { toast('请填写标题'); return; }
        Store.saveMaterial({
          id: m ? m.id : null,
          title,
          category: cat,
          url: ov.querySelector('#matf-url').value.trim(),
          note: ov.querySelector('#matf-note').value.trim(),
        });
        closeOverlay();
        renderMaterials();
        toast(isEdit ? '已保存' : '已添加 🎉');
      });
    },
  });
}

// ---------- Tab 4：统计与备份 ----------
function renderStats() {
  const s = Store.stats();
  const page = document.getElementById('page-stats');
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const ds = addDays(todayStr(), -i);
    weekDays.push({
      label: '周' + '一二三四五六日'[parseDate(ds).getDay()],
      ds,
      done: !!Store.getCheckin(ds),
    });
  }
  const top = s.top.map(([name, count]) => {
    const e = Store.getExercises().find(x => x.name === name);
    return { name, count, emoji: e ? e.emoji : '💪' };
  });
  page.innerHTML = `
    <header class="page-head"><h1>统计</h1></header>
    <section class="stats-grid">
      <div class="stat-card"><div class="stat-num">${s.totalDays}</div><div class="stat-lbl">累计打卡天数</div></div>
      <div class="stat-card"><div class="stat-num">${s.longestStreak}</div><div class="stat-lbl">最长连续天数</div></div>
      <div class="stat-card"><div class="stat-num">${s.monthDays}</div><div class="stat-lbl">本月打卡天数</div></div>
      <div class="stat-card"><div class="stat-num">${s.totalRecords}</div><div class="stat-lbl">累计训练次数</div></div>
    </section>
    <section class="card">
      <h3>最近 7 天</h3>
      <div class="week-strip">
        ${weekDays.map(w => `
          <div class="ws-day">
            <div class="ws-dot${w.done ? ' done' : ''}">${w.done ? '✓' : ''}</div>
            <span>${w.label}</span>
          </div>`).join('')}
      </div>
    </section>
    <section class="card">
      <h3>最常练动作</h3>
      ${top.length
        ? `<ul class="top-list">${top.map(t => `
            <li><span class="ex-emoji" style="font-size:22px">${t.emoji}</span>
            <span class="top-name">${esc(t.name)}</span>
            <span class="top-count">${t.count} 次</span></li>`).join('')}</ul>`
        : `<div class="empty"><span class="big">🏋️</span>还没有训练记录，快去打卡吧</div>`}
    </section>
    <section class="card">
      <h3>主题颜色</h3>
      <div class="theme-row">
        ${THEMES.map(t => `
          <button class="theme-dot${Store.theme === t.id ? ' active' : ''}" data-theme="${t.id}" title="${t.name}" style="background:${t.swatch}"></button>`).join('')}
      </div>
      <p class="theme-name">当前：${esc(themeName(Store.theme))}（点击圆点立即切换）</p>
    </section>
    ${syncCardHtml()}
    <section class="card">
      <h3>数据备份</h3>
      <p class="backup-note">数据存在本机浏览器中；开启云同步后会自动备份一份到云端。换设备或清理浏览器前，建议再手动导出一份留底。</p>
      <button class="btn btn-block" data-action="export">⬇️ 导出数据备份</button>
      <button class="btn btn-block" data-action="import">⬆️ 导入数据备份</button>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h3>手机安装说明</h3>
      <ol class="howto">
        <li>把整个「健身打卡」文件夹部署到免费静态托管（如 GitHub Pages）。</li>
        <li>手机浏览器打开网址：iOS 用 Safari「添加到主屏幕」；Android 用 Chrome「安装应用」。</li>
        <li>之后像 App 一样从主屏幕打开，断网也能用。</li>
      </ol>
    </section>
  `;
}

function exportData() {
  const payload = {
    app: 'fitness-checkin',
    version: 3,
    exportedAt: new Date().toISOString(),
    exercises: Store.getExercises(),
    checkins: Store.checkins,
    materials: Store.materials,
    sync: Sync.cfg || null,   // 带上云同步配置，换手机导入后自动接上
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '健身打卡备份-' + todayStr() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('已导出备份文件');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      toast('导入失败：不是有效的 JSON 文件');
      return;
    }
    if (!data || !Array.isArray(data.exercises) || !data.checkins || typeof data.checkins !== 'object') {
      toast('导入失败：文件格式不正确');
      return;
    }
    confirmDialog({
      title: '导入数据',
      message: '将用备份文件覆盖当前数据（当前共有 ' + Store.stats().totalDays + ' 天打卡记录）。确定继续吗？',
      danger: true,
      okText: '覆盖导入',
      onOk() {
        Store.replaceAll(data.exercises, data.checkins, data.materials || []);
        if (data.sync && data.sync.token) Sync.saveCfg(data.sync);
        renderAll();
        toast('导入成功 🎉');
        if (Sync.on) Sync.boot();   // 配置一并恢复，立即和云端对齐
      },
    });
  };
  reader.readAsText(file);
}
