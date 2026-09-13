// ============================================================
// battle.js - 戦闘ロジック
// ============================================================

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const CRIT_CHANCE = 0.08;
const CRIT_MULT = 1.75;
function rollCrit() { return Math.random() < CRIT_CHANCE; }

function createBattle(monsterId, isBoss) {
  const src = MONSTERS[monsterId];
  return {
    monster: {
      id: src.id, name: src.name, glyph: src.glyph, color: src.color,
      hp: src.hp, maxHp: src.hp, atk: src.atk, def: src.def, exp: src.exp, gold: src.gold,
      boss: !!isBoss,
    },
    log: [],
    logRevealed: 0,
    turn: 'command', // command | resolving | won | lost | fled
    cursor: 0,
    menu: 'main', // main | spell | item
    shake: 0,
    flashEnemy: 0,
    flashPlayer: 0,
    popups: [], // { target:'enemy'|'player', amount, crit, heal, life }
    scripted: null, // 'guardian' | 'dragon' | 'superboss' | null(通常/ミミック戦)
    playerStatus: null, // { type: 'poison', turns }
    monsterStatus: null, // { type: 'poison'|'sleep', turns }
    defending: false,
    playerAtkBonus: 0,
  };
}

function pushPopup(battle, target, amount, opts) {
  opts = opts || {};
  battle.popups.push({ target, amount, crit: !!opts.crit, heal: !!opts.heal, life: 40 });
}

function pushLog(battle, msg) {
  battle.log.push(msg);
  battle.logRevealed = 0;
  if (battle.log.length > 4) battle.log.shift();
}

function physicalDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.7));
  const variance = rand(-Math.floor(base * 0.2), Math.floor(base * 0.2));
  return Math.max(1, base + variance);
}

function spellDamage(power) {
  return power + rand(-3, 4);
}

// プレイヤーの通常攻撃
function playerAttack(state, battle) {
  const p = state.player;
  const crit = rollCrit();
  let dmg = physicalDamage(playerAtk(p) + (battle.playerAtkBonus || 0), battle.monster.def);
  if (crit) dmg = Math.round(dmg * CRIT_MULT);
  battle.monster.hp = Math.max(0, battle.monster.hp - dmg);
  battle.flashEnemy = 6;
  battle.shake = crit ? 10 : 0;
  pushPopup(battle, 'enemy', dmg, { crit });
  pushLog(battle, `${p.name}のこうげき！${crit ? ' 会心の一撃！' : ''} ${battle.monster.name}に${dmg}のダメージ！`);
}

// なかまの支援攻撃(プレイヤーの行動後、自動で発生する)
function companionAttack(state, battle) {
  const comp = COMPANIONS[state.player.companion];
  if (!comp) return;
  const dmg = physicalDamage(comp.atk(state.player.level), battle.monster.def);
  battle.monster.hp = Math.max(0, battle.monster.hp - dmg);
  battle.flashEnemy = 6;
  pushPopup(battle, 'enemy', dmg, {});
  pushLog(battle, `${comp.name}のこうげき！ ${battle.monster.name}に${dmg}のダメージ！`);
}

function playerCastSpell(state, battle, spellId) {
  const p = state.player;
  const spell = SPELLS[spellId];
  if (p.mp < spell.mp) { pushLog(battle, 'MPが足りない！'); return false; }
  p.mp -= spell.mp;
  const monsterSrc = MONSTERS[battle.monster.id];
  const immune = !!monsterSrc.statusImmune;

  if (spell.kind === 'attack') {
    let dmg = spellDamage(spell.power);
    if (spell.element && monsterSrc.resist && monsterSrc.resist[spell.element]) {
      dmg = Math.max(1, Math.floor(dmg * monsterSrc.resist[spell.element]));
    }
    dmg = Math.max(1, dmg - Math.floor(battle.monster.def * 0.3));
    battle.monster.hp = Math.max(0, battle.monster.hp - dmg);
    battle.flashEnemy = 6;
    pushPopup(battle, 'enemy', dmg, {});
    const resisted = spell.element && monsterSrc.resist && monsterSrc.resist[spell.element];
    pushLog(battle, `${p.name}は${spell.name}を唱えた！ ${dmg}のダメージ！${resisted ? '(手ごたえが薄い……)' : ''}`);
  } else if (spell.kind === 'heal') {
    const heal = spellDamage(spell.power);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    pushPopup(battle, 'player', heal, { heal: true });
    pushLog(battle, `${p.name}は${spell.name}を唱えた！ HPが${heal}回復！`);
  } else if (spell.kind === 'poison') {
    if (immune) {
      pushLog(battle, `${p.name}は${spell.name}を唱えたが、${battle.monster.name}には効かなかった！`);
    } else if (battle.monsterStatus) {
      pushLog(battle, `${p.name}は${spell.name}を唱えたが、効果がなかった！`);
    } else {
      battle.monsterStatus = { type: 'poison', turns: 4 };
      pushLog(battle, `${battle.monster.name}は毒状態になった！`);
    }
  } else if (spell.kind === 'sleep') {
    if (immune) {
      pushLog(battle, `${p.name}は${spell.name}を唱えたが、${battle.monster.name}には効かなかった！`);
    } else if (!battle.monsterStatus && Math.random() < 0.7) {
      battle.monsterStatus = { type: 'sleep', turns: 3 };
      pushLog(battle, `${battle.monster.name}は眠ってしまった！`);
    } else {
      pushLog(battle, `${p.name}は${spell.name}を唱えたが、効果がなかった！`);
    }
  } else if (spell.kind === 'buff') {
    battle.playerAtkBonus = (battle.playerAtkBonus || 0) + spell.amount;
    pushLog(battle, `${p.name}は${spell.name}を唱えた！ こうげき力が上がった！`);
  }
  return true;
}

function playerUseItem(state, battle, itemId) {
  const p = state.player;
  const item = ITEMS[itemId];
  if (!item || !p.inventory[itemId]) return false;
  removeItem(p, itemId);
  let msg;
  if (item.curesPoison) {
    if (battle.playerStatus && battle.playerStatus.type === 'poison') {
      battle.playerStatus = null;
      msg = `${p.name}の毒が治った！`;
    } else {
      msg = `${p.name}に変化はなかった。`;
    }
  } else if (item.targetsEnemy) {
    msg = item.effect(battle.monster);
    battle.flashEnemy = 6;
  } else {
    msg = item.effect(p);
  }
  pushLog(battle, msg);
  return true;
}

// モンスターの通常攻撃(毒付与つき)
function monsterAttack(state, battle) {
  const p = state.player;
  const crit = rollCrit();
  let dmg = physicalDamage(battle.monster.atk, playerDef(p));
  if (crit) dmg = Math.round(dmg * CRIT_MULT);
  if (battle.defending) dmg = Math.max(1, Math.ceil(dmg / 2));
  p.hp = Math.max(0, p.hp - dmg);
  battle.flashPlayer = 6;
  if (crit) battle.shake = 10;
  pushPopup(battle, 'player', dmg, { crit });
  pushLog(battle, `${battle.monster.name}のこうげき！${crit ? ' 会心の一撃！' : ''} ${dmg}のダメージを受けた！`);
  const src = MONSTERS[battle.monster.id];
  if (src.poisonChance && !battle.playerStatus && Math.random() < src.poisonChance) {
    battle.playerStatus = { type: 'poison', turns: 3 };
    pushLog(battle, `${p.name}は毒を受けてしまった！`);
  }
}

// モンスターの行動(睡眠判定つき)
function monsterTakeTurn(state, battle) {
  const m = battle.monster;
  if (battle.monsterStatus && battle.monsterStatus.type === 'sleep') {
    if (Math.random() < 0.4) {
      battle.monsterStatus = null;
      pushLog(battle, `${m.name}は目を覚ました！`);
      monsterAttack(state, battle);
    } else {
      pushLog(battle, `${m.name}は眠っている……`);
    }
    return;
  }
  monsterAttack(state, battle);
}

// ラウンド終了時の状態異常ダメージ処理
function applyStatusTicks(state, battle) {
  const p = state.player, m = battle.monster;
  if (battle.monsterStatus && battle.monsterStatus.type === 'poison' && m.hp > 0) {
    const dmg = Math.max(1, Math.floor(m.maxHp / 10));
    m.hp = Math.max(0, m.hp - dmg);
    pushPopup(battle, 'enemy', dmg, {});
    pushLog(battle, `${m.name}は毒でさらに${dmg}のダメージ！`);
    battle.monsterStatus.turns--;
    if (battle.monsterStatus.turns <= 0) battle.monsterStatus = null;
  }
  if (battle.playerStatus && battle.playerStatus.type === 'poison' && p.hp > 0) {
    const dmg = Math.max(1, Math.floor(p.maxHp / 12));
    p.hp = Math.max(0, p.hp - dmg);
    pushPopup(battle, 'player', dmg, {});
    pushLog(battle, `${p.name}は毒で${dmg}のダメージを受けた！`);
    battle.playerStatus.turns--;
    if (battle.playerStatus.turns <= 0) battle.playerStatus = null;
  }
}

function tryFlee(battle) {
  if (battle.monster.boss) return false;
  return Math.random() < 0.65;
}

if (typeof module !== 'undefined') {
  module.exports = {
    rand, createBattle, pushLog, pushPopup, physicalDamage, spellDamage, rollCrit,
    playerAttack, playerCastSpell, playerUseItem, companionAttack,
    monsterAttack, monsterTakeTurn, applyStatusTicks, tryFlee,
  };
}
