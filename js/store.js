/* 数据层：localStorage 读写、统计、导入导出 */

// 应用版本号：与 sw.js 里的 CACHE 保持同步（fitness- + APP_VERSION）
// 改代码后请把这里和 sw.js 的 CACHE 一起加 1，手机端才能自动识别到新版本
const APP_VERSION = 'v9';

// 动作分类（固定列表，emoji 用于分类标签展示）
const CATEGORIES = [
  { id: 'chest', name: '胸部', emoji: '💪' },
  { id: 'back', name: '背部', emoji: '🏋️' },
  { id: 'legs', name: '腿部', emoji: '🦵' },
  { id: 'shoulder', name: '肩部', emoji: '🦾' },
  { id: 'core', name: '核心', emoji: '🎯' },
  { id: 'cardio', name: '有氧', emoji: '🏃' },
  { id: 'neck', name: '肩颈康复', emoji: '🙆' },
  { id: 'waist', name: '腰背康复', emoji: '🌉' },
  { id: 'knee', name: '膝关节康复', emoji: '🦿' },
];

function catName(id) {
  const c = allCategories().find(x => x.id === id);
  return c ? c.name : '未分类';
}

// 全部分类 = 固定分类 + 用户自定义分类，并套用用户的改名/改图标
function allCategories() {
  const ov = (Store && Store.catOverrides) || {};
  return CATEGORIES.concat(Store ? Store.cats : [])
    .map(c => ov[c.id] ? { ...c, ...ov[c.id] } : c);
}

// ---------- 日期工具（本地时区） ----------
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function todayStr() { return fmtDate(new Date()); }
function parseDate(s) { return new Date(s + 'T00:00:00'); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- 连续天数 ----------
function currentStreak(datesSet) {
  let streak = 0;
  const d = new Date();
  // 今天还没打卡时，从昨天起算（不打断连续）
  if (!datesSet.has(fmtDate(d))) d.setDate(d.getDate() - 1);
  while (datesSet.has(fmtDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function longestStreak(datesSorted) {
  let best = 0, run = 0, prev = null;
  for (const s of datesSorted) {
    if (prev) {
      const diff = Math.round((parseDate(s) - parseDate(prev)) / 86400000);
      if (diff === 1) run++;
      else { best = Math.max(best, run); run = 1; }
    } else {
      run = 1;
    }
    prev = s;
  }
  return Math.max(best, run);
}

// ---------- 存储 ----------
const Store = {
  _load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  _save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  get exercises() {
    const v = this._load('fitness.exercises');
    return Array.isArray(v) ? v : [];
  },
  set exercises(v) { this._save('fitness.exercises', v); },

  get checkins() {
    const v = this._load('fitness.checkins');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  },
  set checkins(v) { this._save('fitness.checkins', v); },

  // 首次使用时写入预置动作库
  init() {
    if (!this._load('fitness.exercises')) {
      this.exercises = SEED_EXERCISES.map(s => ({
        ...s,
        id: uid(),
        createdAt: new Date().toISOString(),
      }));
    }
    if (!this._load('fitness.checkins')) {
      this.checkins = {};
    }
  },

  getExercises() { return this.exercises; },

  saveExercise(ex) {
    const arr = this.exercises;
    const i = ex.id ? arr.findIndex(x => x.id === ex.id) : -1;
    if (i >= 0) {
      arr[i] = { ...arr[i], ...ex, createdAt: arr[i].createdAt };
    } else {
      arr.push({
        ...ex,
        id: uid(),
        createdAt: new Date().toISOString(),
      });
    }
    this.exercises = arr;
  },

  deleteExercise(id) {
    this.exercises = this.exercises.filter(x => x.id !== id);
  },

  // 界面主题（用户设置，默认绿色）
  get theme() { return this._load('fitness.theme') || 'green'; },
  set theme(v) { this._save('fitness.theme', v); },

  // 收集的资料（网络收集的健身相关知识）
  get materials() {
    const v = this._load('fitness.materials');
    return Array.isArray(v) ? v : [];
  },
  set materials(v) { this._save('fitness.materials', v); },

  saveMaterial(m) {
    const arr = this.materials;
    const i = m.id ? arr.findIndex(x => x.id === m.id) : -1;
    if (i >= 0) {
      arr[i] = { ...arr[i], ...m, createdAt: arr[i].createdAt };
    } else {
      arr.push({ ...m, id: uid(), createdAt: new Date().toISOString() });
    }
    this.materials = arr;
  },

  deleteMaterial(id) {
    this.materials = this.materials.filter(x => x.id !== id);
  },

  // ---------- 自定义分类 ----------
  get cats() {
    const v = this._load('fitness.cats');
    return Array.isArray(v) ? v : [];
  },
  set cats(v) { this._save('fitness.cats', v); },

  addCat(name, emoji) {
    name = (name || '').trim();
    if (!name) return null;
    if (CATEGORIES.some(c => c.name === name) || this.cats.some(c => c.name === name)) {
      return null; // 与现有分类重名
    }
    const arr = this.cats;
    const c = { id: 'c_' + uid(), name, emoji: emoji || '✨', custom: true };
    arr.push(c);
    this.cats = arr;
    return c;
  },

  removeCat(id) {
    this.cats = this.cats.filter(c => c.id !== id);
    // 该分类下的动作保留，界面显示为「未分类」，历史记录不受影响
  },

  // 修改任意分类（内置/自定义通用）：名称与图标。内置分类的修改存为覆盖项
  get catOverrides() {
    const v = this._load('fitness.catOverrides');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  },
  set catOverrides(v) { this._save('fitness.catOverrides', v); },

  updateCat(id, patch) {
    const ov = this.catOverrides;
    ov[id] = { ...(ov[id] || {}), ...patch };
    this.catOverrides = ov;
  },

  // 某天的打卡记录（无记录返回 null）
  getCheckin(dateStr) {
    const v = this.checkins[dateStr];
    return Array.isArray(v) ? v : null;
  },

  // 空记录则删除该日期键
  saveCheckin(dateStr, records) {
    const ck = this.checkins;
    if (!records.length) delete ck[dateStr];
    else ck[dateStr] = records;
    this.checkins = ck;
  },

  deleteCheckin(dateStr) { this.saveCheckin(dateStr, []); },

  stats() {
    const ck = this.checkins;
    const dates = Object.keys(ck)
      .filter(d => Array.isArray(ck[d]) && ck[d].length > 0)
      .sort();
    const totalDays = dates.length;
    const totalRecords = dates.reduce((n, d) => n + ck[d].length, 0);
    const monthPrefix = todayStr().slice(0, 7);
    const monthDays = dates.filter(d => d.startsWith(monthPrefix)).length;

    // 最常练动作（按动作名统计）
    const counts = {};
    for (const d of dates) {
      for (const r of ck[d]) {
        counts[r.exName] = (counts[r.exName] || 0) + 1;
      }
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalDays,
      monthDays,
      totalRecords,
      currentStreak: currentStreak(new Set(dates)),
      longestStreak: longestStreak(dates),
      top,
    };
  },

  // 导入备份（做基本校验与清洗）
  replaceAll(exercises, checkins, materials) {
    const cleanEx = Array.isArray(exercises)
      ? exercises.filter(e => e && e.id && e.name)
      : [];
    const cleanCk = {};
    if (checkins && typeof checkins === 'object' && !Array.isArray(checkins)) {
      for (const k of Object.keys(checkins)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(checkins[k])) {
          cleanCk[k] = checkins[k];
        }
      }
    }
    const cleanMat = Array.isArray(materials)
      ? materials.filter(m => m && m.id && m.title)
      : [];
    this.exercises = cleanEx;
    this.checkins = cleanCk;
    this.materials = cleanMat;
  },
};
