// ============================================================
// player.js - プレイヤーの状態と成長
// ============================================================

function statsForLevel(lv) {
  return {
    maxHp: 18 + lv * 7,
    maxMp: lv < 3 ? 0 : 4 + (lv - 3) * 3,
    baseAtk: 5 + lv * 3,
    baseDef: 3 + lv * 2,
  };
}

function expToReach(lv) {
  // lv1到達に必要な累積EXPは0。以降、なめらかに増加。
  if (lv <= 1) return 0;
  return Math.floor(Math.pow(lv, 2.4) * 8);
}

function createNewPlayer(name) {
  const base = statsForLevel(1);
  return {
    name: name || '勇者',
    level: 1,
    exp: 0,
    gold: 60,
    hp: base.maxHp,
    mp: base.maxMp,
    maxHp: base.maxHp,
    maxMp: base.maxMp,
    weapon: 'sword_bronze',
    shield: null,
    armor: null,
    accessory: null,
    ownedEquipment: ['sword_bronze'],
    inventory: { item_herb: 2, item_water: 1 },
    spells: [],
    companion: null,
    job: 'warrior',
    jobLevels: Object.keys(JOBS).reduce((acc, id) => { acc[id] = { level: 1, exp: 0 }; return acc; }, {}),
    masteredJobs: [],
    enhancements: {},
    map: 'town',
    x: 7,
    y: 9,
    dir: 'down',
  };
}

// そうび強化: 装備ごとに+1〜+3の強化段階を持ち、基礎ステータスに応じたボーナスが乗る
const ENHANCE_MAX_LEVEL = 3;
function enhancementBonus(p, equipId, stat) {
  if (!equipId) return 0;
  const level = (p.enhancements && p.enhancements[equipId]) || 0;
  if (!level) return 0;
  const base = (EQUIPMENT[equipId] && EQUIPMENT[equipId][stat]) || 0;
  return Math.round(base * 0.15 * level);
}
function enhanceCost(equipId, nextLevel) {
  const eq = EQUIPMENT[equipId];
  return Math.max(20, Math.round((eq.price || 60) * 0.4 * nextLevel));
}
function enhanceEquipment(p, equipId) {
  p.enhancements = p.enhancements || {};
  const level = p.enhancements[equipId] || 0;
  if (level >= ENHANCE_MAX_LEVEL) return { ok: false, reason: 'max' };
  const cost = enhanceCost(equipId, level + 1);
  if (p.gold < cost) return { ok: false, reason: 'gold', cost };
  p.gold -= cost;
  p.enhancements[equipId] = level + 1;
  return { ok: true, cost, level: level + 1 };
}

function playerAtk(p) {
  const base = statsForLevel(p.level).baseAtk;
  const w = p.weapon ? EQUIPMENT[p.weapon] : null;
  const acc = p.accessory ? EQUIPMENT[p.accessory] : null;
  const jobMod = p.job && JOBS[p.job] ? JOBS[p.job].atkMod : 1;
  const masteryBonus = (p.masteredJobs || []).length * 2;
  const enh = enhancementBonus(p, p.weapon, 'atk') + enhancementBonus(p, p.accessory, 'atk');
  return Math.round(base * jobMod) + (w && w.atk ? w.atk : 0) + (acc && acc.atk ? acc.atk : 0) + masteryBonus + enh;
}

function playerDef(p) {
  const base = statsForLevel(p.level).baseDef;
  const s = p.shield ? EQUIPMENT[p.shield] : null;
  const a = p.armor ? EQUIPMENT[p.armor] : null;
  const acc = p.accessory ? EQUIPMENT[p.accessory] : null;
  const jobMod = p.job && JOBS[p.job] ? JOBS[p.job].defMod : 1;
  const masteryBonus = (p.masteredJobs || []).length * 2;
  const enh = enhancementBonus(p, p.shield, 'def') + enhancementBonus(p, p.armor, 'def') + enhancementBonus(p, p.accessory, 'def');
  return Math.round(base * jobMod) + (s && s.def ? s.def : 0) + (a && a.def ? a.def : 0) + (acc && acc.def ? acc.def : 0) + masteryBonus + enh;
}

// 転職: 現在の職業を切り替え、MPの最大値を新しい職業の倍率で再計算する
function switchJob(p, jobId) {
  const job = JOBS[jobId];
  if (!job || p.job === jobId) return;
  p.job = jobId;
  const base = statsForLevel(p.level);
  p.maxMp = Math.round(base.maxMp * job.mpMod);
  p.mp = Math.min(p.mp, p.maxMp);
}

// 職業経験値を加算し、職業レベルが上がったらそのぶんを返す。マスター時はmasteredを返す
function gainJobExp(p, amount) {
  if (!p.job) return null;
  const jd = p.jobLevels[p.job];
  if (!jd || jd.level >= JOB_MAX_LEVEL) return null;
  jd.exp += amount;
  let leveled = false;
  while (jd.level < JOB_MAX_LEVEL && jd.exp >= jobExpToReach(jd.level + 1)) {
    jd.level += 1;
    leveled = true;
  }
  if (jd.level >= JOB_MAX_LEVEL && !p.masteredJobs.includes(p.job)) {
    p.masteredJobs.push(p.job);
    return { leveled, mastered: true };
  }
  return leveled ? { leveled, mastered: false } : null;
}

function refreshSpells(p) {
  p.spells = Object.values(SPELLS).filter((s) => p.level >= s.learnLv).map((s) => s.id);
}

// EXPを加算し、レベルアップした回数と習得呪文を返す
function gainExp(p, amount) {
  p.exp += amount;
  const gained = { levels: 0, newSpells: [] };
  while (p.exp >= expToReach(p.level + 1)) {
    p.level += 1;
    gained.levels += 1;
    const st = statsForLevel(p.level);
    const prevMax = p.maxHp;
    const prevMaxMp = p.maxMp;
    const jobMod = p.job && JOBS[p.job] ? JOBS[p.job].mpMod : 1;
    p.maxHp = st.maxHp;
    p.maxMp = Math.round(st.maxMp * jobMod);
    p.hp += (p.maxHp - prevMax);
    p.mp += (p.maxMp - prevMaxMp);
    const before = new Set(p.spells);
    refreshSpells(p);
    p.spells.forEach((sid) => { if (!before.has(sid)) gained.newSpells.push(sid); });
  }
  return gained;
}

function fullHeal(p) {
  p.hp = p.maxHp;
  p.mp = p.maxMp;
}

function addItem(p, itemId, qty) {
  p.inventory[itemId] = (p.inventory[itemId] || 0) + (qty === undefined ? 1 : qty);
}

function removeItem(p, itemId, qty) {
  if (!p.inventory[itemId]) return false;
  p.inventory[itemId] -= (qty === undefined ? 1 : qty);
  if (p.inventory[itemId] <= 0) delete p.inventory[itemId];
  return true;
}

function addOwnedEquipment(p, equipId) {
  if (!p.ownedEquipment.includes(equipId)) p.ownedEquipment.push(equipId);
}

function removeOwnedEquipment(p, equipId) {
  const idx = p.ownedEquipment.indexOf(equipId);
  if (idx === -1) return false;
  p.ownedEquipment.splice(idx, 1);
  if (p.weapon === equipId) p.weapon = null;
  if (p.shield === equipId) p.shield = null;
  if (p.armor === equipId) p.armor = null;
  if (p.accessory === equipId) p.accessory = null;
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = {
    statsForLevel, expToReach, createNewPlayer, playerAtk, playerDef, gainExp, fullHeal, addItem, removeItem,
    refreshSpells, addOwnedEquipment, removeOwnedEquipment, switchJob, gainJobExp,
    ENHANCE_MAX_LEVEL, enhanceCost, enhanceEquipment,
  };
}
