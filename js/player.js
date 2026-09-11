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
    map: 'town',
    x: 7,
    y: 9,
    dir: 'down',
  };
}

function playerAtk(p) {
  const base = statsForLevel(p.level).baseAtk;
  const w = p.weapon ? EQUIPMENT[p.weapon] : null;
  const acc = p.accessory ? EQUIPMENT[p.accessory] : null;
  return base + (w && w.atk ? w.atk : 0) + (acc && acc.atk ? acc.atk : 0);
}

function playerDef(p) {
  const base = statsForLevel(p.level).baseDef;
  const s = p.shield ? EQUIPMENT[p.shield] : null;
  const a = p.armor ? EQUIPMENT[p.armor] : null;
  const acc = p.accessory ? EQUIPMENT[p.accessory] : null;
  return base + (s && s.def ? s.def : 0) + (a && a.def ? a.def : 0) + (acc && acc.def ? acc.def : 0);
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
    p.maxHp = st.maxHp;
    p.maxMp = st.maxMp;
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
  module.exports = { statsForLevel, expToReach, createNewPlayer, playerAtk, playerDef, gainExp, fullHeal, addItem, removeItem, refreshSpells, addOwnedEquipment, removeOwnedEquipment };
}
