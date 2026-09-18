// ============================================================
// game.js - ゲーム全体の状態管理・入力・描画
// ============================================================

const SAVE_KEY_V1 = 'yuusha_no_akashi_save_v1'; // 旧・単一スロット形式(移行元)
const SAVE_KEY_PREFIX = 'yuusha_no_akashi_save_v2_slot';
const SLOT_COUNT = 3;

const state = {
  screen: 'TITLE',
  titleCursor: 0,
  hasSave: false,
  player: null,
  currentSlot: 0,
  flags: {
    questAccepted: false, bossDefeated: false, chestsOpened: [],
    hasHolySword: false, guardianDefeated: false,
    dogQuestActive: false, dogFound: false, dogQuestDone: false,
    storyEnded: false, superbossDefeated: false,
    wolfQuestActive: false, wolfQuestDone: false,
    locketQuestActive: false, locketFound: false, locketQuestDone: false,
    cargoQuestActive: false, cargoFound: false, cargoQuestDone: false,
    crabKingDefeated: false, voidDefeated: false,
    iceSealObtained: false, sealBroken: false,
    kainQuestActive: false, swordFound: false, kainQuestDone: false, kainTalkCount: 0,
    lisaQuestActive: false, lisaQuestDone: false, lisaTalkCount: 0,
    bestiaryRewardGiven: false,
    loreStonesStarted: false, loreStonesComplete: false, loreStones: {},
    townReputation: 0, reputationRankSeen: 0, grottoClearsCounted: 0,
    arenaBestWave: 0, achievementsSeen: {},
    killCounts: {}, bestiary: {}, visitedMaps: {},
  },
  dialogue: null,
  confirm: null,
  menu: null,
  shop: null,
  slotSelect: null,
  battle: null,
  frame: 0,
  lastMoveAt: 0,
  endingExtraLines: [],
  randomDungeon: null,
  arena: null,
};

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------
function tileWalkable(map, x, y) {
  const g = map.grid;
  if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return false;
  return WALKABLE.has(g[y][x]);
}
function npcAt(mapId, x, y) {
  return NPCS.find((n) => n.map === mapId && n.x === x && n.y === y && !(n.hidden && n.hidden(state)));
}
function chestAt(mapId, x, y) { return CHESTS.find((c) => c.map === mapId && c.x === x && c.y === y); }

function showDialogue(rawLines, onDone) {
  const wrapped = [];
  rawLines.forEach((line) => wrapJapanese(line, 20).forEach((w) => wrapped.push(w)));
  const pages = [];
  for (let i = 0; i < wrapped.length; i += 3) pages.push(wrapped.slice(i, i + 3));
  if (pages.length === 0) pages.push(['...']);
  state.dialogue = { pages, index: 0, revealed: 0, onDone: onDone || (() => { state.screen = 'FIELD'; }) };
  state.screen = 'DIALOGUE';
}

function showConfirm(rawLines, onDone) {
  const wrapped = [];
  rawLines.forEach((line) => wrapJapanese(line, 20).forEach((w) => wrapped.push(w)));
  state.confirm = { lines: wrapped, cursor: 0, onDone };
  state.screen = 'CONFIRM';
}

// なかまを仲間リストに加える。まだ誰も連れていない場合は、そのまま同行させる
function recruitCompanion(state, id) {
  const p = state.player;
  p.recruitedCompanions = p.recruitedCompanions || [];
  if (!p.recruitedCompanions.includes(id)) p.recruitedCompanions.push(id);
  if (!p.companion) p.companion = id;
}

// 村の評判ポイントを加算する。ランクが上がったら、そのお祝いメッセージの
// 行配列を返す(呼び出し側が自分の表示中のダイアログ/ログに追加できるように)
function addReputation(points) {
  state.flags.townReputation = (state.flags.townReputation || 0) + points;
  const idx = reputationRankIndex(state.flags.townReputation);
  if (idx <= (state.flags.reputationRankSeen || 0)) return [];
  state.flags.reputationRankSeen = idx;
  const rank = REPUTATION_RANKS[idx];
  const lines = [`村の評判が「${rank.name}」に上がった！`];
  if (rank.reward) {
    if (rank.reward.gold) {
      state.player.gold += rank.reward.gold;
      lines.push(`ごほうびとして${rank.reward.gold}ゴールドを受け取った！`);
    }
    if (rank.reward.equip) {
      addOwnedEquipment(state.player, rank.reward.equip);
      lines.push(`「${EQUIPMENT[rank.reward.equip].name}」を手に入れた！`);
    }
  }
  return lines;
}

// 実績の達成判定。新たに達成したものがあれば、その通知行を返す
function checkAchievements() {
  state.flags.achievementsSeen = state.flags.achievementsSeen || {};
  const lines = [];
  ACHIEVEMENTS.forEach((a) => {
    if (state.flags.achievementsSeen[a.id]) return;
    if (!a.check(state)) return;
    state.flags.achievementsSeen[a.id] = true;
    lines.push(`実績「${a.name}」を達成した！`);
    if (a.reward) {
      if (a.reward.gold) {
        state.player.gold += a.reward.gold;
        lines.push(`ごほうびとして${a.reward.gold}ゴールドを受け取った！`);
      }
      if (a.reward.equip) {
        addOwnedEquipment(state.player, a.reward.equip);
        lines.push(`「${EQUIPMENT[a.reward.equip].name}」を手に入れた！`);
      }
    }
  });
  return lines;
}

// ------------------------------------------------------------
// フィールド移動
// ------------------------------------------------------------
function movePlayer(dx, dy) {
  const p = state.player;
  p.dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : dy === -1 ? 'up' : p.dir;
  const nx = p.x + dx, ny = p.y + dy;
  const map = MAPS[p.map];

  const npc = npcAt(p.map, nx, ny);
  if (npc) { interactNpc(npc); return; }

  if (!tileWalkable(map, nx, ny)) return;
  p.x = nx; p.y = ny;

  const scripted = SCRIPTED_ENCOUNTERS.find((s) => s.map === p.map && s.x === nx && s.y === ny && !state.flags[s.flag]);
  if (scripted) { startScriptedBattle(scripted); return; }

  const chest = chestAt(p.map, nx, ny);
  if (chest && !state.flags.chestsOpened.includes(chest.id)) { openChest(chest); return; }

  const key = `${p.map}:${nx}:${ny}`;
  if (WARPS[key]) {
    const dest = WARPS[key];
    if (dest.map === BARRIER_MAP && !state.flags[BARRIER_FLAG]) {
      showDialogue(['行く手に眩い光の結界が張られている。', 'すべての封印を解かなければ、この先には進めないようだ。']);
      return;
    }
    doWarp(dest);
    return;
  }

  if (map.encounter && ENCOUNTER_TILES.has(map.grid[ny][nx]) && Math.random() < map.encounter.rate) {
    triggerRandomEncounter(map.encounter.table);
  }
}

function doWarp(dest) {
  state.player.map = dest.map;
  state.player.x = dest.x;
  state.player.y = dest.y;
  state.player.dir = dest.dir;
  maybeShowFirstVisitHint(dest.map);
}

// マップに初めて足を踏み入れたときだけ、一言ナビを表示する
function maybeShowFirstVisitHint(mapId) {
  if (state.flags.visitedMaps[mapId]) return;
  state.flags.visitedMaps[mapId] = true;
  const hint = MAP_FIRST_VISIT_HINTS[mapId];
  if (!hint) return;
  showDialogue(hint, () => { state.screen = 'FIELD'; });
}

function openChest(chest) {
  state.flags.chestsOpened.push(chest.id);
  if (chest.mimic) {
    showDialogue(['宝箱を開けようとした瞬間……', 'ミミックだ！ 気をつけろ！'], () => {
      state.battle = createBattle('mimic', false);
      state.flags.bestiary.mimic = true;
      state.battle.log.push('ミミックが襲いかかってきた！');
      state.battleMenu = { mode: 'main', cursor: 0 };
      state.screen = 'BATTLE';
    });
    return;
  }
  let msg;
  if (chest.item && EQUIPMENT[chest.item]) {
    addOwnedEquipment(state.player, chest.item);
    msg = `宝箱を開けた！\n${EQUIPMENT[chest.item].name}を手に入れた！`;
  } else if (chest.item && ITEMS[chest.item]) {
    addItem(state.player, chest.item);
    msg = `宝箱を開けた！\n${ITEMS[chest.item].name}を手に入れた！`;
  } else if (chest.gold) {
    state.player.gold += chest.gold;
    msg = `宝箱を開けた！\n${chest.gold}ゴールドを手に入れた！`;
  } else {
    msg = '宝箱を開けたが、\n何も入っていなかった。';
  }
  showDialogue([msg], () => { state.screen = 'FIELD'; });
}

// ------------------------------------------------------------
// 不思議な地図から生成するランダムダンジョン
// ------------------------------------------------------------
function enterRandomDungeon(itemId) {
  const item = ITEMS[itemId];
  const rank = item && GROTTO_RANKS.find((r) => r.mapItem === itemId);
  if (!rank) return;
  const dungeon = generateGrottoGrid(rank.id);
  state.randomDungeon = dungeon;

  // 前回この地図で生成したチェスト/ボスを消してから、新しいものを配置する
  for (let i = CHESTS.length - 1; i >= 0; i--) { if (CHESTS[i].id.startsWith('grotto_')) CHESTS.splice(i, 1); }
  for (let i = SCRIPTED_ENCOUNTERS.length - 1; i >= 0; i--) { if (SCRIPTED_ENCOUNTERS[i].id.startsWith('grotto_')) SCRIPTED_ENCOUNTERS.splice(i, 1); }

  const instanceId = Date.now();
  const bossSrc = MONSTERS[rank.boss];
  const bossOverrides = {
    hp: Math.round(bossSrc.hp * rank.bossMult),
    atk: Math.round(bossSrc.atk * rank.bossMult),
    def: Math.round(bossSrc.def * rank.bossMult),
    exp: Math.round(bossSrc.exp * rank.bossMult),
    gold: Math.round(bossSrc.gold * rank.bossMult),
  };
  SCRIPTED_ENCOUNTERS.push({
    id: `grotto_boss_${instanceId}`, map: 'grotto', x: dungeon.bossPos.x, y: dungeon.bossPos.y,
    monster: rank.boss, flag: `grottoBossDefeated_${instanceId}`, overrides: bossOverrides,
    introLines: ['地図に描かれた、最も深い場所にたどり着いた……', '何かが潜んでいる気配がする！'],
  });
  CHESTS.push({
    id: `grotto_chest_${instanceId}`, map: 'grotto', x: dungeon.chestPos.x, y: dungeon.chestPos.y,
    item: null, gold: Math.round(60 * rank.goldMult),
  });
  WARPS[`grotto:${dungeon.entrance.x}:${dungeon.entrance.y}`] = { map: 'town', x: 7, y: 9, dir: 'up' };

  state.player.map = 'grotto';
  state.player.x = dungeon.entrance.x;
  state.player.y = dungeon.entrance.y;
  state.player.dir = 'up';
  state.screen = 'FIELD';
  showDialogue(['地図の示す場所に足を踏み入れると、見知らぬ洞窟が広がっていた……', '入口に戻れば、いつでも村へ帰れるようだ。'], () => { state.screen = 'FIELD'; });
}

function interactNpc(npc) {
  if (npc.id === 'elder' && state.flags.bossDefeated && !state.flags.storyEnded) {
    showConfirm(['ここで物語を終えますか？', '（いつでも話しかけ直せます）'], (yes) => {
      if (yes) { triggerEnding(); }
      else { showDialogue(npc.lines(state), () => { state.screen = 'FIELD'; }); }
    });
    return;
  }
  if (npc.id === 'arenaReceptionist') {
    const best = state.flags.arenaBestWave || 0;
    showConfirm([`闘技場へようこそ！ 自己ベストは第${best}戦。`, '挑戦しますか？'], (yes) => {
      if (yes) { startArenaWave(1); } else { state.screen = 'FIELD'; }
    });
    return;
  }
  if (npc.inn) {
    showConfirm([`${state.player.name}は宿屋に泊まりますか？`, '(10ゴールド)'], (yes) => {
      if (yes && state.player.gold >= 10) {
        state.player.gold -= 10;
        fullHeal(state.player);
        saveGame(state.currentSlot);
        showDialogue(['ぐっすり眠った！ HPとMPが全回復した。', '冒険の書にきろくしました。'], () => { state.screen = 'FIELD'; });
      } else if (yes) {
        showDialogue(['ゴールドが足りないようだ。'], () => { state.screen = 'FIELD'; });
      } else {
        showDialogue(['またおいで。'], () => { state.screen = 'FIELD'; });
      }
    });
    return;
  }
  if (npc.shop) {
    showDialogue(npc.lines(state), () => { openShop(npc.shop); });
    return;
  }
  showDialogue(npc.lines(state), () => { state.screen = 'FIELD'; });
}

// ------------------------------------------------------------
// スクリプトイベント戦闘(ガーディアン・魔竜王)
// ------------------------------------------------------------
function startScriptedBattle(entry) {
  showDialogue(entry.introLines, () => {
    state.battle = createBattle(entry.monster, true, entry.overrides);
    state.flags.bestiary[entry.monster] = true;
    state.battle.scripted = entry.id;
    state.battle.log.push(`${state.battle.monster.name}があらわれた！`);
    state.battleMenu = { mode: 'main', cursor: 0 };
    state.screen = 'BATTLE';
  });
}

// ------------------------------------------------------------
// ランダムエンカウント
// ------------------------------------------------------------
function pickWeighted(table) {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of table) { if (r < t.weight) return t.id; r -= t.weight; }
  return table[0].id;
}

function triggerRandomEncounter(table) {
  const monsterId = pickWeighted(table);
  state.battle = createBattle(monsterId, false);
  state.flags.bestiary[monsterId] = true;
  state.battle.log.push(`${state.battle.monster.name}があらわれた！`);
  state.battleMenu = { mode: 'main', cursor: 0 };
  state.screen = 'BATTLE';
}

// ------------------------------------------------------------
// 闘技場 (連戦チャレンジ)
// ------------------------------------------------------------
const ARENA_MONSTER_POOL = ['slime', 'wolf', 'ghost', 'scorpion', 'bat', 'thief', 'skeleton', 'dark_knight', 'golem', 'iron_golem', 'tower_wraith', 'arcane_sentinel'];

function startArenaWave(wave) {
  const monsterId = ARENA_MONSTER_POOL[Math.min(ARENA_MONSTER_POOL.length - 1, Math.floor((wave - 1) / 2))];
  const mult = 1 + (wave - 1) * 0.12;
  const src = MONSTERS[monsterId];
  const overrides = {
    hp: Math.round(src.hp * mult), atk: Math.round(src.atk * mult), def: Math.round(src.def * mult),
    exp: Math.round(src.exp * mult), gold: Math.round(src.gold * mult),
  };
  state.arena = { active: true, wave };
  state.battle = createBattle(monsterId, false, overrides);
  state.battle.scripted = 'arena';
  state.flags.bestiary[monsterId] = true;
  state.battle.log.push(`闘技場 第${wave}戦！ ${state.battle.monster.name}が現れた！`);
  state.battleMenu = { mode: 'main', cursor: 0 };
  state.screen = 'BATTLE';
}

// ------------------------------------------------------------
// 戦闘の解決
// ------------------------------------------------------------
function endBattleVictory() {
  const b = state.battle;
  const p = state.player;
  pushLog(b, `${b.monster.name}をたおした！`);

  if (!b.scripted) {
    state.flags.killCounts[b.monster.id] = (state.flags.killCounts[b.monster.id] || 0) + 1;
    const dropSrc = MONSTERS[b.monster.id];
    if (dropSrc.drop && Math.random() < dropSrc.drop.chance) {
      addItem(p, dropSrc.drop.id, 1);
      pushLog(b, `${ITEMS[dropSrc.drop.id].name}を手に入れた！`);
    }
  }

  if (b.scripted === 'dragon') {
    state.flags.bossDefeated = true;
    pushLog(b, '村を脅かしていた元凶を打ち倒した……！');
    addReputation(15).forEach((l) => pushLog(b, l));
  } else {
    p.gold += b.monster.gold;
    pushLog(b, `${b.monster.gold}ゴールドを手に入れた！`);
    const gained = gainExp(p, b.monster.exp);
    pushLog(b, `${b.monster.exp}の経験値を手に入れた！`);
    if (gained.levels > 0) pushLog(b, `レベルが${gained.levels}あがった！ Lv.${p.level}`);
    gained.newSpells.forEach((sid) => pushLog(b, `呪文『${SPELLS[sid].name}』を覚えた！`));

    const jobResult = gainJobExp(p, b.monster.exp);
    if (jobResult && jobResult.mastered) {
      pushLog(b, `${JOBS[p.job].name}をマスターした！ 永続的なボーナスを得た！`);
    } else if (jobResult && jobResult.leveled) {
      pushLog(b, `${JOBS[p.job].name}の職業レベルが${p.jobLevels[p.job].level}になった！`);
    }

    if (b.scripted === 'guardian') {
      state.flags.guardianDefeated = true;
      state.flags.hasHolySword = true;
      addOwnedEquipment(p, 'sword_holy');
      pushLog(b, '古の聖剣「光の剣」を手に入れた！');
      addReputation(15).forEach((l) => pushLog(b, l));
    } else if (b.scripted === 'superboss') {
      state.flags.superbossDefeated = true;
      addOwnedEquipment(p, 'sword_dawn');
      pushLog(b, '暁光の剣を手に入れた！');
      if (state.player.companion === 'kain') {
        pushLog(b, 'カインが呟いた……「これでようやく、雪辱を果たせた」');
      }
      addReputation(15).forEach((l) => pushLog(b, l));
    } else if (b.scripted === 'voidboss') {
      state.flags.voidDefeated = true;
      addOwnedEquipment(p, 'sword_absolute');
      pushLog(b, '終焉の剣を手に入れた！');
    } else if (b.scripted === 'iceguardian') {
      state.flags.iceSealObtained = true;
      addOwnedEquipment(p, 'talisman_frost');
      pushLog(b, '氷の護符を手に入れた！');
    } else if (b.scripted === 'fallenknight') {
      state.flags.sealBroken = true;
      addOwnedEquipment(p, 'emblem_argus');
      pushLog(b, '堕天騎士の紋章を手に入れた！');
    } else if (b.scripted && b.scripted.startsWith('grotto_boss') && state.flags.grottoClearsCounted < 5) {
      state.flags.grottoClearsCounted += 1;
      addReputation(5).forEach((l) => pushLog(b, l));
    }
  }

  const allSeen = Object.keys(MONSTERS).every((id) => state.flags.bestiary[id]);
  if (allSeen && !state.flags.bestiaryRewardGiven) {
    state.flags.bestiaryRewardGiven = true;
    addOwnedEquipment(p, 'ring_hunter');
    pushLog(b, 'モンスター図鑑がすべて埋まった！ 「狩人の指輪」を手に入れた！');
  }

  checkAchievements().forEach((l) => pushLog(b, l));

  b.turn = 'won';
}

function endBattleDefeat() {
  const b = state.battle;
  pushLog(b, `${state.player.name}は倒れてしまった……`);
  b.turn = 'lost';
}

function resolveMonsterTurnIfAlive() {
  const b = state.battle;
  if (b.monster.hp <= 0) { endBattleVictory(); return; }
  if (state.player.companion) {
    companionAttack(state, b);
    if (b.monster.hp <= 0) { endBattleVictory(); return; }
  }
  monsterTakeTurn(state, b);
  b.defending = false;
  if (state.player.hp <= 0) { endBattleDefeat(); return; }
  applyStatusTicks(state, b);
  if (b.monster.hp <= 0) { endBattleVictory(); return; }
  if (state.player.hp <= 0) { endBattleDefeat(); return; }
  b.turn = 'command';
  state.battleMenu = { mode: 'main', cursor: 0 };
}

function battleCommandAttack() {
  const b = state.battle;
  playerAttack(state, b);
  resolveMonsterTurnIfAlive();
}

function battleCommandDefend() {
  const b = state.battle;
  b.defending = true;
  pushLog(b, `${state.player.name}は身を守っている。`);
  resolveMonsterTurnIfAlive();
}

function battleCommandSpell(spellId) {
  const b = state.battle;
  const ok = playerCastSpell(state, b, spellId);
  if (!ok) return; // MP不足などで行動失敗、コマンドに戻らずメッセージのみ
  if (b.monster.hp <= 0) { endBattleVictory(); return; }
  resolveMonsterTurnIfAlive();
}

function battleCommandItem(itemId) {
  const b = state.battle;
  playerUseItem(state, b, itemId);
  resolveMonsterTurnIfAlive();
}

function battleCommandFlee() {
  const b = state.battle;
  if (b.monster.boss) {
    pushLog(b, '逃げられない！');
    monsterTakeTurn(state, b);
    if (state.player.hp <= 0) { endBattleDefeat(); return; }
    applyStatusTicks(state, b);
    if (b.monster.hp <= 0) { endBattleVictory(); return; }
    if (state.player.hp <= 0) { endBattleDefeat(); return; }
    return;
  }
  if (tryFlee(b)) {
    pushLog(b, 'うまく逃げ切った！');
    b.turn = 'fled';
  } else {
    pushLog(b, 'しかし回り込まれてしまった！');
    resolveMonsterTurnIfAlive();
  }
}

function closeBattle() {
  const lost = state.battle && state.battle.turn === 'lost';
  const won = state.battle && state.battle.turn === 'won';
  const scripted = state.battle && state.battle.scripted;
  state.battle = null;
  if (lost) {
    state.arena = null;
    const p = state.player;
    p.gold = Math.floor(p.gold / 2);
    p.hp = Math.max(1, Math.floor(p.maxHp * 0.5));
    p.mp = p.maxMp;
    p.map = 'town'; p.x = 7; p.y = 9; p.dir = 'up';
    state.screen = 'FIELD';
    showDialogue(['気を失っていたようだ……', '村の人に助けられ、村に運ばれた。', '所持金の半分を失ってしまった。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'guardian') {
    showDialogue(['聖剣が黄金の光を放っている……。', 'この力があれば、竜の洞窟の結界を破れるはずだ。', 'もう一度、洞窟を目指そう。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'superboss') {
    showDialogue(['暁光の剣を手に入れた……まさに夜明けの如き輝きだ。', '試練の塔に、もう思い残すことはなさそうだ。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'voidboss') {
    showDialogue(['終焉の剣を手にした今、もはや恐れるものは何もない……', 'この力こそ、すべての物語の果てに辿り着いた証だ。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'iceguardian') {
    showDialogue(['氷結の封印が解けていく……', 'あと一つ、レイヴンの町で手がかりを探そう。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'fallenknight') {
    showDialogue(['最後の封印が、音を立てて崩れていく……', 'これで、竜の結界を打ち破れるはずだ。村へ戻ろう。'], () => { state.screen = 'FIELD'; });
    return;
  }
  if (won && scripted === 'arena') {
    const wave = state.arena.wave;
    state.flags.arenaBestWave = Math.max(state.flags.arenaBestWave || 0, wave);
    const achLines = checkAchievements();
    const askContinue = () => {
      showConfirm([`第${wave}戦に勝利した！`, '次の相手と戦いますか？'], (yes) => {
        if (yes) { startArenaWave(wave + 1); } else { state.arena = null; state.screen = 'FIELD'; }
      });
    };
    if (achLines.length > 0) showDialogue(achLines, askContinue);
    else askContinue();
    return;
  }
  state.screen = 'FIELD';
}

// ------------------------------------------------------------
// エンディング
// ------------------------------------------------------------
function triggerEnding() {
  state.flags.storyEnded = true;
  const lines = [];
  if (state.flags.loreStonesComplete) {
    lines.push('石版に刻まれていた真実 ―― 賢者たちの堕落と、その果てに生まれた深淵。');
    lines.push('その全てを知った上で、勇者はなお前へ進むことを選んだ。');
  }
  if (state.flags.superbossDefeated) {
    lines.push('試練の塔に巣食っていた大魔導士ゼノンをも打ち倒し、');
    lines.push('勇者の名は伝説として語り継がれることとなった。');
  }
  if (state.flags.voidDefeated) {
    lines.push('深淵の主すら打ち倒したその名は、もはや神話の域に達していた。');
  }
  if (state.player.masteredJobs && state.player.masteredJobs.includes('hero')) {
    lines.push('五つの職業と四つの流派、そのすべてを極めた者だけが辿り着く境地。');
    lines.push('人々はその姿を、こう呼んだ ―― 「勇者の証」を持つ者、と。');
  }
  const doneQuests = SIDE_QUESTS.filter((q) => state.flags[q.doneFlag]);
  if (doneQuests.length === SIDE_QUESTS.length) {
    lines.push('村人たちの悩みもすべて解決し、誰もが笑顔で勇者を見送った。');
  } else if (doneQuests.length > 0) {
    lines.push('道中で出会った人々の悩みにも、できる限り手を貸してきた。');
  }
  const recruited = state.player.recruitedCompanions || [];
  if (recruited.includes('kain')) {
    lines.push('剣士カインは兄との約束を果たし、これからも勇者と共に歩むと誓った。');
  }
  if (recruited.includes('lisa')) {
    lines.push('旅の神官リサは、静かな祈りと共に勇者の新たな門出を見送った。');
  }
  state.endingExtraLines = lines;
  state.screen = 'ENDING';
}

// ------------------------------------------------------------
// ショップ
// ------------------------------------------------------------
function openShop(shopId) {
  state.shop = { shopId, tab: 'buy', cursor: 0 };
  state.screen = 'SHOP';
}

function shopBuyList() { return SHOPS[state.shop.shopId].items; }
function shopSellList() {
  const p = state.player;
  const list = [];
  p.ownedEquipment.forEach((id) => {
    if (id !== p.weapon && id !== p.shield && id !== p.armor && id !== p.accessory) list.push(id);
  });
  Object.keys(p.inventory).forEach((id) => { if (p.inventory[id] > 0) list.push(id); });
  return list;
}
function itemDef(id) { return EQUIPMENT[id] || ITEMS[id]; }

function shopBuy(id) {
  const p = state.player;
  const def = itemDef(id);
  if (p.gold < def.price) { flashShopMsg('お金が足りない！'); return; }
  p.gold -= def.price;
  if (EQUIPMENT[id]) addOwnedEquipment(p, id); else addItem(p, id);
  flashShopMsg(`${def.name}を買った！`);
}

function shopSell(id) {
  const p = state.player;
  const def = itemDef(id);
  const price = Math.floor(def.price / 2);
  if (EQUIPMENT[id]) removeOwnedEquipment(p, id); else removeItem(p, id);
  p.gold += price;
  flashShopMsg(`${def.name}を売った！ (+${price}G)`);
}

function flashShopMsg(msg) {
  state.shop.msg = msg;
  state.shop.msgTimer = 90;
}

// ------------------------------------------------------------
// 隠しコマンド: レベル最大化 & 最強フル装備
// ------------------------------------------------------------
const CHEAT_MAX_LEVEL = 30;

function activateCheat() {
  const p = state.player;
  if (!p) return;
  p.level = CHEAT_MAX_LEVEL;
  const st = statsForLevel(CHEAT_MAX_LEVEL);
  const jobMod = p.job && JOBS[p.job] ? JOBS[p.job].mpMod : 1;
  p.maxHp = st.maxHp;
  p.maxMp = Math.round(st.maxMp * jobMod);
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  refreshSpells(p);
  Object.keys(EQUIPMENT).forEach((id) => addOwnedEquipment(p, id));
  p.weapon = 'sword_dawn';
  p.shield = 'shield_aegis';
  p.armor = 'armor_radiant';
  p.accessory = 'twilight_charm';
  p.gold = 99999;
  p.jobLevels = p.jobLevels || {};
  p.masteredJobs = p.masteredJobs || [];
  Object.keys(JOBS).forEach((id) => {
    p.jobLevels[id] = { level: JOB_MAX_LEVEL, exp: jobExpToReach(JOB_MAX_LEVEL, JOBS[id].tier) };
    if (!p.masteredJobs.includes(id)) p.masteredJobs.push(id);
  });
  state.flags.hasHolySword = true;
  showDialogue(['……体の奥から、抑えきれない力が溢れ出す！', '(隠しコマンドが発動した！ 勇者は最強の姿になった！)'], () => { state.screen = 'FIELD'; });
}

// ------------------------------------------------------------
// アイテム合成
// ------------------------------------------------------------
function craftHasMaterials(p, recipe) {
  return Object.entries(recipe.materials).every(([id, qty]) => (p.inventory[id] || 0) >= qty);
}

function craftItem(recipeId) {
  const p = state.player;
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return;
  if (p.gold < recipe.gold || !craftHasMaterials(p, recipe)) {
    state.menu.msg = '材料かゴールドが足りない！';
    return;
  }
  p.gold -= recipe.gold;
  Object.entries(recipe.materials).forEach(([id, qty]) => removeItem(p, id, qty));
  if (EQUIPMENT[recipe.result]) {
    addOwnedEquipment(p, recipe.result);
  } else {
    addItem(p, recipe.result, recipe.resultQty || 1);
  }
  state.menu.msg = `${itemDef(recipe.result).name}を合成した！`;
}

// ------------------------------------------------------------
// セーブ / ロード (3スロット)
// ------------------------------------------------------------
function slotKey(slot) { return SAVE_KEY_PREFIX + slot; }

function saveGame(slot) {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify({ player: state.player, flags: state.flags }));
  } catch (e) { /* localStorage unavailable */ }
}
function loadGame(slot) {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function listSaveSlots() {
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const data = loadGame(i);
    const map = data && MAPS[data.player.map];
    slots.push({
      slot: i,
      summary: data ? { name: data.player.name, level: data.player.level, mapName: map ? map.name : '' } : null,
    });
  }
  return slots;
}
function hasSaveData() {
  for (let i = 0; i < SLOT_COUNT; i++) { if (loadGame(i)) return true; }
  return false;
}
// 旧・単一スロット形式(v1)からの非破壊移行。スロット0が空の場合のみ、旧データをコピーする(旧キーは残す)
function migrateLegacySave() {
  try {
    if (loadGame(0)) return;
    const raw = localStorage.getItem(SAVE_KEY_V1);
    if (!raw) return;
    localStorage.setItem(slotKey(0), raw);
  } catch (e) { /* localStorage unavailable */ }
}

if (typeof module !== 'undefined') {
  module.exports = {
    state, tileWalkable, npcAt, chestAt, movePlayer, doWarp, openChest, interactNpc,
    startScriptedBattle, pickWeighted, triggerRandomEncounter,
    endBattleVictory, endBattleDefeat, resolveMonsterTurnIfAlive,
    battleCommandAttack, battleCommandSpell, battleCommandItem, battleCommandDefend, battleCommandFlee, closeBattle,
    openShop, shopBuyList, shopSellList, itemDef, shopBuy, shopSell,
    craftHasMaterials, craftItem, activateCheat, addReputation, enterRandomDungeon,
    checkAchievements, startArenaWave, recruitCompanion,
    saveGame, loadGame, listSaveSlots, hasSaveData, migrateLegacySave,
    triggerEnding, showDialogue, showConfirm,
  };
}
