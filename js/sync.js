/* 云同步：用 GitHub 私有 Gist 当免费云端备份
 * 设计原则：
 *   1. 网络失败绝不阻塞打卡 —— 本地永远先存下来，下次自动重试
 *   2. 任何数据变动后自动上传（防抖 5 秒），不需要手动点
 *   3. 换手机 / 清缓存后，打开应用自动从云端把数据拉回来
 */
const SYNC_FILE = 'fitness-backup.json';
const SYNC_API = 'https://api.github.com/gists';
const SYNC_KEY = 'fitness.sync';
const SYNC_AT = 'fitness.updatedAt';

// 同步不依赖界面层：界面函数缺失时静默降级，绝不让备份流程崩掉
function _toast(m) { try { if (typeof toast === 'function') toast(m); } catch (e) {} }
function _renderAll() { try { if (typeof renderAll === 'function') renderAll(); } catch (e) {} }
function _renderStats() { try { if (typeof renderStats === 'function') renderStats(); } catch (e) {} }
function _refreshSyncCard() { try { if (typeof refreshSyncCard === 'function') refreshSyncCard(); } catch (e) {} }

const Sync = {
  cfg: null,        // { token, gistId, lastSyncAt }
  _timer: null,
  _busy: false,
  state: 'off',     // off | idle | syncing | ok | error
  msg: '',

  // ---------- 配置 ----------
  load() {
    try {
      const raw = localStorage.getItem(SYNC_KEY);
      this.cfg = raw ? JSON.parse(raw) : null;
    } catch (e) { this.cfg = null; }
    if (this.cfg && this.cfg.token) this.state = 'idle';
    return this.cfg;
  },
  saveCfg(c) {
    this.cfg = c;
    if (c && c.token) this.state = 'idle'; else this.state = 'off';
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(c)); } catch (e) {}
  },
  get on() { return !!(this.cfg && this.cfg.token); },

  localAt() {
    const v = Number(localStorage.getItem(SYNC_AT) || 0);
    return isFinite(v) ? v : 0;
  },
  touch() {
    try { localStorage.setItem(SYNC_AT, String(Date.now())); } catch (e) {}
  },

  // ---------- 数据快照 ----------
  snapshot() {
    return {
      app: 'fitness-checkin',
      version: 3,
      updatedAt: this.localAt() || Date.now(),
      theme: Store.theme,
      exercises: Store.getExercises(),
      checkins: Store.checkins,
      materials: Store.materials,
    };
  },
  applySnapshot(data) {
    Store.replaceAll(data.exercises, data.checkins, data.materials || []);
    if (data.theme) applyTheme(data.theme);
    try { localStorage.setItem(SYNC_AT, String(data.updatedAt || Date.now())); } catch (e) {}
  },

  headers() {
    return {
      'Authorization': 'Bearer ' + this.cfg.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  },

  // ---------- 上传 ----------
  async push(silent) {
    if (!this.on || this._busy) return false;
    this._busy = true;
    this.state = 'syncing';
    if (!silent) { this.msg = '正在上传…'; _refreshSyncCard(); }
    try {
      const content = JSON.stringify(this.snapshot());
      let res;
      if (this.cfg.gistId) {
        res = await fetch(SYNC_API + '/' + this.cfg.gistId, {
          method: 'PATCH',
          headers: this.headers(),
          body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }),
        });
      } else {
        res = await fetch(SYNC_API, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            description: '健身打卡 · 自动备份（勿删）',
            public: false,
            files: { [SYNC_FILE]: { content } },
          }),
        });
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(res.status === 401 ? '密钥无效或已过期（401）' : ('上传失败 ' + res.status + ' ' + t.slice(0, 60)));
      }
      const j = await res.json();
      this.cfg.gistId = j.id;
      this.cfg.lastSyncAt = Date.now();
      this.saveCfg(this.cfg);
      this.state = 'ok';
      this.msg = '已备份 ' + this.timeAgo(this.cfg.lastSyncAt);
      if (!silent) _toast('已备份到云端 ☁️');
      return true;
    } catch (e) {
      this.state = 'error';
      this.msg = e.message || '网络异常';
      if (!silent) _toast('备份失败：' + this.msg);
      return false;
    } finally {
      this._busy = false;
      _refreshSyncCard();
    }
  },

  // ---------- 下载 ----------
  async pull() {
    if (!this.on || !this.cfg.gistId) return null;
    const res = await fetch(SYNC_API + '/' + this.cfg.gistId, { headers: this.headers() });
    if (!res.ok) {
      if (res.status === 404) throw new Error('云端备份不存在（404）');
      throw new Error(res.status === 401 ? '密钥无效或已过期（401）' : ('读取失败 ' + res.status));
    }
    const j = await res.json();
    const f = j.files && j.files[SYNC_FILE];
    if (!f) throw new Error('云端没有备份文件');
    let text = f.content;
    if (f.truncated && f.raw_url) {
      text = await (await fetch(f.raw_url)).text();
    }
    return JSON.parse(text);
  },

  // ---------- 自动上传（防抖） ----------
  schedule() {
    if (!this.on) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this.push(true); }, 5000);
  },

  // ---------- 手动：双向同步 ----------
  async syncNow() {
    if (!this.on) { openSyncSetup(); return; }
    this.msg = '正在同步…';
    this.state = 'syncing';
    _refreshSyncCard();
    let cloud = null;
    try {
      cloud = await this.pull();
    } catch (e) {
      // 云端读不到（首次 / 404），直接把本地传上去
      const ok = await this.push(false);
      if (ok) _toast('已备份到云端 ☁️');
      return;
    }
    const localAt = this.localAt();
    const cloudAt = cloud.updatedAt || 0;
    const localDays = Object.keys(Store.checkins || {}).length;
    if (localDays === 0 && Object.keys(cloud.checkins || {}).length > 0) {
      this.applySnapshot(cloud);
      _renderAll();
      _toast('已从云端恢复数据 🎉');
      this.state = 'ok'; this.msg = '已同步 ' + this.timeAgo(Date.now()); _refreshSyncCard();
      return;
    }
    if (cloudAt > localAt + 3000) {
      confirmDialog({
        title: '云端数据更新',
        message: '云端备份比本机新（' + this.fmtTime(cloudAt) + '），要把本机数据替换成云端的吗？',
        danger: true,
        okText: '用云端覆盖',
        onOk() {
          Sync.applySnapshot(cloud);
          _renderAll();
          _toast('已恢复云端数据');
          Sync.state = 'ok'; Sync.msg = '已同步 ' + Sync.timeAgo(Date.now()); _refreshSyncCard();
        },
      });
      return;
    }
    const ok = await this.push(false);
    if (ok) _toast('已是最新 ☁️');
  },

  // ---------- 启动自检 ----------
  async boot() {
    if (!this.on) return;
    this.state = 'syncing';
    let cloud = null;
    try {
      cloud = await this.pull();
    } catch (e) {
      this.state = 'error';
      this.msg = e.message || '暂时连不上云端';
      // 本地仍然可用，静默处理，不打扰
      return;
    }
    const localAt = this.localAt();
    const localDays = Object.keys(Store.checkins || {}).length;
    const cloudDays = Object.keys(cloud.checkins || {}).length;

    // 场景1：本机没数据（换手机 / 清过缓存），云端有 → 自动恢复
    if (localDays === 0 && cloudDays > 0) {
      this.applySnapshot(cloud);
      _renderAll();
      this.state = 'ok';
      this.msg = '已恢复 ' + this.timeAgo(Date.now());
      _toast('已从云端恢复 ' + cloudDays + ' 天打卡记录 🎉');
      return;
    }
    // 场景2：云端更新 → 询问
    if ((cloud.updatedAt || 0) > localAt + 3000 && cloudDays > 0) {
      this.state = 'idle';
      this.msg = '云端有更新数据';
      confirmDialog({
        title: '发现云端备份',
        message: '云端有一份更新的记录（' + this.fmtTime(cloud.updatedAt) + '，共 ' + cloudDays + ' 天）。\n要恢复吗？本机当前的 ' + localDays + ' 天记录会被替换。',
        danger: true,
        okText: '恢复云端',
        onOk() {
          Sync.applySnapshot(cloud);
          _renderAll();
          _toast('已恢复云端数据 🎉');
          Sync.state = 'ok'; Sync.msg = '已同步 ' + Sync.timeAgo(Date.now());
        },
      });
      return;
    }
    // 场景3：本地更新 → 传上去
    this.state = 'ok';
    if (localAt > (cloud.updatedAt || 0)) await this.push(true);
    else { this.msg = '已同步 ' + this.timeAgo(this.cfg.lastSyncAt || Date.now()); }
  },

  turnOff() {
    confirmDialog({
      title: '关闭云同步',
      message: '关闭后不再自动备份，数据只存在本机。确定吗？',
      danger: true,
      okText: '关闭',
      onOk() {
        try { localStorage.removeItem(SYNC_KEY); } catch (e) {}
        Sync.cfg = null; Sync.state = 'off'; Sync.msg = '';
        _toast('已关闭云同步');
        _renderStats();
      },
    });
  },

  // ---------- 时间显示 ----------
  fmtTime(ts) {
    if (!ts) return '未知';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
  timeAgo(ts) {
    if (!ts) return '未知时间';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
    return this.fmtTime(ts);
  },
};

// ---------- 拦截所有数据写入：记时间戳 + 排队自动上传 ----------
(function hookStore() {
  const orig = Store._save.bind(Store);
  Store._save = function (key, value) {
    orig(key, value);
    if (key === SYNC_KEY || key === SYNC_AT) return;
    Sync.touch();
    Sync.schedule();
  };
})();

// ---------- 同步设置弹窗 ----------
function openSyncSetup() {
  const c = Sync.cfg || {};
  openOverlay({
    type: 'sheet',
    title: '开启云同步',
    content: `
      <label class="form-label">GitHub 密钥（ghp_ 开头那一串）</label>
      <input class="input" id="sync-token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
             value="${esc(c.token || '')}" autocomplete="off" autocapitalize="off"
             autocorrect="off" spellcheck="false">
      <p class="backup-note">不会填？点下面的按钮，里面有图文步骤（约 3 分钟）。</p>
      <button class="btn btn-block" data-action="sync-help">📖 密钥怎么拿？</button>
    `,
    footer: `<button class="btn btn-primary btn-block" data-ok>保存并开启</button>`,
    onMount(ov) {
      ov.querySelector('[data-ok]').addEventListener('click', async () => {
        const token = ov.querySelector('#sync-token').value.trim();
        if (!token) { _toast('请填写密钥'); return; }
        closeOverlay();
        Sync.saveCfg({ token, gistId: c.gistId || '', lastSyncAt: c.lastSyncAt || 0 });
        _toast('正在连接云端…');
        const ok = await Sync.push(false);
        if (ok) {
          if (typeof renderStats === 'function') _renderStats();
          confirmDialog({
            title: '云同步已开启 🎉',
            message: '以后每次打卡会自动备份。换手机时，在新手机打开应用、填入同一个密钥，数据就会自动回来。\n建议现在点一次「立即同步」确认无误。',
            okText: '知道了',
          });
        }
      });
    },
  });
}

function openSyncHelp() {
  openOverlay({
    type: 'sheet',
    title: '获取 GitHub 密钥',
    content: `
      <ol class="howto">
        <li>手机/电脑浏览器打开 <b>github.com</b> 并登录（没有就注册，免费）。</li>
        <li>点右上角<b>头像</b> → <b>Settings</b>。</li>
        <li>左侧最下面点 <b>Developer settings</b>。</li>
        <li>点 <b>Personal access tokens</b> → <b>Tokens (classic)</b>。</li>
        <li>点 <b>Generate new token (classic)</b>。</li>
        <li>Note 随便填，比如 <b>健身打卡</b>。</li>
        <li>Expiration 选 <b>No expiration</b>（永不过期）。</li>
        <li>勾选 <b>gist</b>（只勾这一个就够）。</li>
        <li>拉到最下面点绿色 <b>Generate token</b>。</li>
        <li>立刻<b>复制</b>那串 ghp_ 开头的字符（只显示这一次），粘贴回上面的框里。</li>
      </ol>
      <p class="backup-note">这串密钥只保存在你自己的手机里，用来读写你自己账号下的私密备份片段，不会发给任何人。</p>
      <p class="backup-note">打不开下面的按钮？长按复制这个网址，粘到 Safari：<br><b>github.com/settings/tokens</b></p>
      <a href="https://github.com/settings/tokens" target="_blank" rel="noopener"
         class="btn btn-block btn-primary" style="display:block;text-align:center;text-decoration:none">🌐 打开 GitHub 密钥页面</a>
    `,
  });
}

// 只重绘「云同步」卡片，避免整页刷新打断输入
function refreshSyncCard() {
  const box = document.getElementById('sync-box');
  if (box) box.outerHTML = syncCardHtml();
}

function syncCardHtml() {
  if (!Sync.on) {
    return `
    <section class="card" id="sync-box">
      <h3>☁️ 云同步</h3>
      <p class="backup-note">开启后，每次打卡会自动备份到云端。换手机、清缓存、甚至手机丢了，数据都能一键回来。</p>
      <button class="btn btn-block btn-primary" data-action="sync-setup">🚀 开启云同步</button>
    </section>`;
  }
  const dot = Sync.state === 'ok' ? '🟢' : Sync.state === 'error' ? '🔴' : Sync.state === 'syncing' ? '🟡' : '⚪️';
  const text = Sync.state === 'off' ? '未开启'
    : Sync.state === 'syncing' ? '同步中…'
    : (Sync.msg || '等待第一次备份');
  return `
  <section class="card" id="sync-box">
    <h3>☁️ 云同步</h3>
    <p class="backup-note">${dot} ${esc(text)}</p>
    <button class="btn btn-block" data-action="sync-now">🔄 立即同步</button>
    <button class="btn btn-block" data-action="sync-restore">⬇️ 从云端恢复</button>
    <button class="btn btn-block" data-action="sync-setup">⚙️ 修改密钥</button>
    <button class="btn btn-block btn-danger-ghost" data-action="sync-off">关闭云同步</button>
  </section>`;
}
