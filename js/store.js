/* 数据层：localStorage 读写、统计、导入导出 */

// 动作分类（固定列表）
const CATEGORIES = [
  { id: 'chest', name: '胸部' },
  { id: 'back', name: '背部' },
  { id: 'legs', name: '腿部' },
  { id: 'shoulder', name: '肩部' },
  { id: 'core', name: '核心' },
  { id: 'cardio', name: '有氧' },
  { id: 'neck', name: '肩颈康复' },
  { id: 'waist', name: '腰背康复' },
  { id: 'knee', name: '膝关节康复' },
];

function catName(id) {
  const c = CATEGORIES.find(x => x.id === id);
  return c ? c.name : '未分类';
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
