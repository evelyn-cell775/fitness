/* 入口与全局交互 */
let currentTab = 'today';

function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + name).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  // 悬浮 ＋ 按钮：动作库与资料页显示，动作随所在页切换
  const fab = document.querySelector('.fab');
  if (name === 'library') { fab.style.display = ''; fab.dataset.action = 'add-ex'; }
  else if (name === 'materials') { fab.style.display = ''; fab.dataset.action = 'add-mat'; }
  else fab.style.display = 'none';
  if (name === 'today') renderToday();
  if (name === 'library') renderLibrary();
  if (name === 'materials') renderMaterials();
  if (name === 'stats') renderStats();
  window.scrollTo(0, 0);
}

function renderAll() {
  renderToday();
  renderLibrary();
  renderMaterials();
  renderStats();
}

// 点击事件（全局委托）
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (a) {
    const act = a.dataset.action;
    if (act === 'checkin') beginCheckin();
    else if (act === 'edit-today') openCheckinForm(todayStr(), Store.getCheckin(todayStr()));
    else if (act === 'open-ex') openExerciseDetail(a.dataset.id);
    else if (act === 'add-ex') openExerciseForm(null);
    else if (act === 'open-mat') openMaterialDetail(a.dataset.id);
    else if (act === 'add-mat') openMaterialForm(null);
    else if (act === 'export') exportData();
    else if (act === 'import') document.getElementById('import-file').click();
    else if (act === 'sync-setup') openSyncSetup();
    else if (act === 'sync-help') openSyncHelp();
    else if (act === 'sync-now') Sync.syncNow();
    else if (act === 'sync-off') Sync.turnOff();
    else if (act === 'sync-restore') {
      confirmDialog({
        title: '从云端恢复',
        message: '将用云端备份覆盖本机当前数据，确定吗？',
        danger: true,
        okText: '覆盖恢复',
        onOk: async () => {
          try {
            toast('正在读取云端…');
            const cloud = await Sync.pull();
            Sync.applySnapshot(cloud);
            renderAll();
            toast('已恢复云端数据 🎉');
          } catch (e) {
            toast('恢复失败：' + (e.message || '网络异常'));
          }
        },
      });
    }
    return;
  }
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) { switchTab(tabEl.dataset.tab); return; }
  const cell = e.target.closest('.cal-cell[data-date]');
  if (cell) { openDaySheet(cell.dataset.date); return; }
  if (e.target.closest('#cal-prev')) { calOffset--; renderToday(); return; }
  if (e.target.closest('#cal-next')) { calOffset++; renderToday(); return; }
  if (e.target.closest('.overlay-backdrop')) closeOverlay();
});

// 关闭弹层（data-close 在弹层内部按钮/背景上）
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c && c.closest('.overlay')) closeOverlay();
});

// 动作库分类筛选
document.addEventListener('click', e => {
  const chip = e.target.closest('#lib-chips .chip');
  if (chip) {
    libState.cat = chip.dataset.cat;
    renderLibrary();
  }
});

// 资料分类筛选
document.addEventListener('click', e => {
  const chip = e.target.closest('#mat-chips .chip');
  if (chip) {
    matState.cat = chip.dataset.cat;
    renderMaterials();
  }
});

// 主题颜色切换
document.addEventListener('click', e => {
  const dot = e.target.closest('.theme-dot');
  if (dot) {
    applyTheme(dot.dataset.theme);
    renderStats(); // 刷新圆点选中态与名称
    toast('主题已切换为' + themeName(dot.dataset.theme));
  }
});

// 库页/资料页搜索框输入（输入框在静态骨架中，重渲染不会丢焦点）
document.addEventListener('input', e => {
  if (e.target.id === 'lib-q') {
    libState.q = e.target.value;
    renderLibraryList();
  }
  if (e.target.id === 'mat-q') {
    matState.q = e.target.value;
    renderMaterialsList();
  }
});

// 导入文件选择
document.addEventListener('change', e => {
  if (e.target.id === 'import-file' && e.target.files[0]) {
    importData(e.target.files[0]);
    e.target.value = '';
  }
});

// 启动
Store.init();
applyTheme(Store.theme);
Sync.load();
renderAll();
switchTab(currentTab);

// 云同步自检：换手机 / 清过缓存时自动把数据拉回来
Sync.boot();
// 从后台切回前台、网络恢复时，补一次同步（不打断使用）
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Sync.on) Sync.boot();
});
window.addEventListener('online', () => { if (Sync.on) Sync.boot(); });

// Service Worker（仅 http/https 环境生效，file:// 下自动跳过）
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
