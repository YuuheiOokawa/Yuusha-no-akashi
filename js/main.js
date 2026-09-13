// ============================================================
// main.js - 描画・入力・メインループ
// ============================================================

const topOptions = ['どうぐ', '合成', 'そうび', 'じゅもん', 'クエスト', 'モンスター図鑑', 'ステータス', 'セーブ', 'とじる'];
const mainCommands = ['たたかう', 'じゅもん', 'どうぐ', 'ぼうぎょ', 'にげる'];

// 文字がゆっくり表示されるスピード(1フレームあたりの文字数)
const DIALOGUE_CHARS_PER_FRAME = 1.4;
const LOG_CHARS_PER_FRAME = 1.6;

// ------------------------------------------------------------
// 起動処理
// ------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  migrateLegacySave();
  state.hasSave = hasSaveData();
  document.addEventListener('keydown', handleKeydown);
  initControlMode();
  initTouchControls();
  requestAnimationFrame(loop);
});

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function update() {
  state.frame++;
  if (state.battle) {
    if (state.battle.flashEnemy > 0) state.battle.flashEnemy--;
    if (state.battle.flashPlayer > 0) state.battle.flashPlayer--;
    if (state.battle.shake > 0) state.battle.shake--;
    if (state.battle.popups && state.battle.popups.length > 0) {
      state.battle.popups.forEach((p) => { p.life--; });
      state.battle.popups = state.battle.popups.filter((p) => p.life > 0);
    }
  }
  if (state.shop && state.shop.msgTimer > 0) {
    state.shop.msgTimer--;
    if (state.shop.msgTimer <= 0) state.shop.msg = null;
  }
  if (state.dialogue) {
    const total = dialoguePageCharCount(state.dialogue);
    state.dialogue.revealed = Math.min(total, state.dialogue.revealed + DIALOGUE_CHARS_PER_FRAME);
  }
  if (state.battle) {
    const lastLen = (state.battle.log[state.battle.log.length - 1] || '').length;
    state.battle.logRevealed = Math.min(lastLen, (state.battle.logRevealed || 0) + LOG_CHARS_PER_FRAME);
  }
}

function dialoguePageCharCount(d) {
  const page = d.pages[d.index] || [];
  return page.reduce((s, l) => s + l.length, 0);
}

// ------------------------------------------------------------
// PC/スマホ操作モードの切り替え
// ------------------------------------------------------------
const CONTROL_MODE_KEY = 'yuusha_no_akashi_control_mode';

function detectDefaultControlMode() {
  const saved = localStorage.getItem(CONTROL_MODE_KEY);
  if (saved === 'mobile' || saved === 'desktop') return saved;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return coarse ? 'mobile' : 'desktop';
}

function applyControlMode(mode) {
  const isMobile = mode === 'mobile';
  document.body.classList.toggle('mobile-mode', isMobile);
  const btn = document.getElementById('modeToggle');
  if (btn) {
    btn.classList.toggle('is-active', isMobile);
    btn.textContent = isMobile ? '⌨️ PC操作にする' : '📱 スマホ操作にする';
  }
  try { localStorage.setItem(CONTROL_MODE_KEY, mode); } catch (e) { /* localStorage unavailable */ }
}

function initControlMode() {
  applyControlMode(detectDefaultControlMode());
  const btn = document.getElementById('modeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isMobile = document.body.classList.contains('mobile-mode');
      applyControlMode(isMobile ? 'desktop' : 'mobile');
    });
  }
}

// ------------------------------------------------------------
// 疑似ゲームボタン (ゲームボーイ風の十字キー・A/B/STARTボタン)
// ------------------------------------------------------------
function simulateKey(key) {
  handleKeydown({ key, preventDefault() {} });
}

function bindRepeatButton(el) {
  const key = el.dataset.key;
  let timer = null;
  const fire = () => simulateKey(key);
  const start = (e) => {
    e.preventDefault();
    fire();
    stop();
    timer = setInterval(fire, 150);
  };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
}

function bindTapButton(el) {
  const key = el.dataset.key;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); simulateKey(key); });
}

function initTouchControls() {
  document.querySelectorAll('#dpad .dbtn').forEach(bindRepeatButton);
  document.querySelectorAll('#actionpad .abtn, #actionpad .startbtn').forEach(bindTapButton);
}

// ------------------------------------------------------------
// 隠しコマンド (↑↑↓↓←→←→BA を フィールド上で入力すると発動)
// ------------------------------------------------------------
const CHEAT_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter'];
let cheatBuffer = [];
function checkCheatCode(key) {
  cheatBuffer.push(key);
  if (cheatBuffer.length > CHEAT_SEQUENCE.length) cheatBuffer.shift();
  if (cheatBuffer.length === CHEAT_SEQUENCE.length && CHEAT_SEQUENCE.every((k, i) => k === cheatBuffer[i])) {
    cheatBuffer = [];
    activateCheat();
  }
}

// ------------------------------------------------------------
// 入力ディスパッチ
// ------------------------------------------------------------
function handleKeydown(e) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) e.preventDefault();
  // 隠しコマンドは画面遷移をまたいでも判定する(例えばコマンド中のEscapeで
  // 一時的にメニューが開いても、続くキー入力で発動できるように)。
  if (state.player) checkCheatCode(e.key);
  switch (state.screen) {
    case 'TITLE': titleKey(e); break;
    case 'FIELD': fieldKey(e); break;
    case 'DIALOGUE': dialogueKey(e); break;
    case 'CONFIRM': confirmKey(e); break;
    case 'MENU': menuKey(e); break;
    case 'SHOP': shopKey(e); break;
    case 'BATTLE': battleKey(e); break;
    case 'ENDING': endingKey(e); break;
    case 'SLOTSELECT': slotSelectKey(e); break;
  }
}

function titleOptions() { return state.hasSave ? ['さいしょから', 'つづきから'] : ['さいしょから']; }

function defaultFlags() {
  return {
    questAccepted: false, bossDefeated: false, chestsOpened: [],
    hasHolySword: false, guardianDefeated: false,
    dogQuestActive: false, dogFound: false, dogQuestDone: false,
    storyEnded: false, superbossDefeated: false,
    wolfQuestActive: false, wolfQuestDone: false,
    locketQuestActive: false, locketFound: false, locketQuestDone: false,
    kainQuestActive: false, swordFound: false, kainQuestDone: false, kainTalkCount: 0,
    bestiaryRewardGiven: false,
    loreStonesStarted: false, loreStonesComplete: false, loreStones: {},
    killCounts: {}, bestiary: {}, visitedMaps: {},
  };
}

function startNewGame(slot) {
  state.player = createNewPlayer('勇者');
  state.flags = defaultFlags();
  state.currentSlot = slot;
  state.screen = 'FIELD';
  showDialogue(OPENING_STORY, () => { state.screen = 'FIELD'; });
}

function continueGame(slot) {
  const data = loadGame(slot);
  if (!data) return;
  state.player = data.player;
  if (!state.player.ownedEquipment) state.player.ownedEquipment = [state.player.weapon].filter(Boolean);
  if (state.player.accessory === undefined) state.player.accessory = null;
  if (state.player.companion === undefined) state.player.companion = null;
  state.flags = Object.assign(defaultFlags(), data.flags || {});
  state.currentSlot = slot;
  state.screen = 'FIELD';
}

function titleKey(e) {
  const opts = titleOptions();
  if (e.key === 'ArrowUp') state.titleCursor = (state.titleCursor - 1 + opts.length) % opts.length;
  else if (e.key === 'ArrowDown') state.titleCursor = (state.titleCursor + 1) % opts.length;
  else if (e.key === 'Enter' || e.key === ' ') {
    const choice = opts[state.titleCursor];
    state.slotSelect = { mode: choice === 'さいしょから' ? 'new' : 'load', cursor: 0 };
    state.screen = 'SLOTSELECT';
  }
}

function slotSelectKey(e) {
  const s = state.slotSelect;
  const slots = listSaveSlots();
  if (e.key === 'ArrowUp') s.cursor = (s.cursor - 1 + SLOT_COUNT) % SLOT_COUNT;
  else if (e.key === 'ArrowDown') s.cursor = (s.cursor + 1) % SLOT_COUNT;
  else if (e.key === 'Escape') { state.screen = 'TITLE'; state.slotSelect = null; }
  else if (e.key === 'Enter' || e.key === ' ') {
    const chosen = slots[s.cursor];
    if (s.mode === 'load') {
      if (!chosen.summary) return;
      continueGame(s.cursor);
    } else if (chosen.summary) {
      showConfirm([`スロット${s.cursor + 1}には既にデータがあります。`, '上書きしますか？'], (yes) => {
        if (yes) { startNewGame(s.cursor); } else { state.screen = 'SLOTSELECT'; }
      });
    } else {
      startNewGame(s.cursor);
    }
  }
}

function fieldKey(e) {
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (moves[e.key]) {
    const t = Date.now();
    if (t - state.lastMoveAt < 130) return;
    state.lastMoveAt = t;
    movePlayer(moves[e.key][0], moves[e.key][1]);
  } else if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
    openMenu();
  }
}

function openMenu() { state.menu = { mode: 'top', cursor: 0 }; state.screen = 'MENU'; }

function dialogueKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    const d = state.dialogue;
    if (d.revealed < dialoguePageCharCount(d)) {
      d.revealed = dialoguePageCharCount(d);
      return;
    }
    d.index++;
    if (d.index >= d.pages.length) {
      const onDone = d.onDone;
      state.dialogue = null;
      if (onDone) onDone();
    } else {
      d.revealed = 0;
    }
  }
}

function confirmKey(e) {
  const c = state.confirm;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') c.cursor = 0;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') c.cursor = 1;
  else if (e.key === 'Enter' || e.key === ' ') {
    const onDone = c.onDone;
    const yes = c.cursor === 0;
    state.confirm = null;
    if (onDone) onDone(yes);
  }
}

function menuKey(e) {
  const m = state.menu;
  if (m.mode === 'top') {
    if (e.key === 'ArrowUp') m.cursor = (m.cursor + topOptions.length - 1) % topOptions.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % topOptions.length;
    else if (e.key === 'Enter' || e.key === ' ') {
      const choice = topOptions[m.cursor];
      if (choice === 'どうぐ') { m.mode = 'item'; m.cursor = 0; m.msg = null; }
      else if (choice === '合成') { m.mode = 'craft'; m.cursor = 0; m.msg = null; }
      else if (choice === 'そうび') { m.mode = 'equipSlot'; m.cursor = 0; }
      else if (choice === 'じゅもん') {
        if (state.player.spells.length > 0) { m.mode = 'spell'; m.cursor = 0; m.msg = null; }
      } else if (choice === 'クエスト') { m.mode = 'quest'; }
      else if (choice === 'モンスター図鑑') { m.mode = 'bestiary'; m.cursor = 0; }
      else if (choice === 'ステータス') { m.mode = 'status'; }
      else if (choice === 'セーブ') { saveGame(state.currentSlot); m.msg = 'ぼうけんの書にきろくした！'; }
      else if (choice === 'とじる') { state.screen = 'FIELD'; state.menu = null; }
    } else if (e.key === 'Escape') { state.screen = 'FIELD'; state.menu = null; }
    return;
  }
  if (m.mode === 'item') {
    const list = Object.keys(state.player.inventory).filter((id) => ITEMS[id] && !ITEMS[id].material);
    if (e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; m.msg = null; return; }
    if (list.length === 0) { if (e.key === 'Enter' || e.key === ' ') { m.mode = 'top'; m.cursor = 0; m.msg = null; } return; }
    if (e.key === 'ArrowUp') m.cursor = (m.cursor - 1 + list.length) % list.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % list.length;
    else if (e.key === 'Enter' || e.key === ' ') {
      const id = list[m.cursor];
      const item = ITEMS[id];
      if (item.usableInField) {
        const result = item.effect(state.player);
        if (result === '__WARP_TOWN__') {
          removeItem(state.player, id);
          state.player.map = 'town'; state.player.x = 7; state.player.y = 9; state.player.dir = 'up';
          state.screen = 'FIELD'; state.menu = null; return;
        }
        removeItem(state.player, id);
        m.msg = null;
        const remaining = Object.keys(state.player.inventory).filter((iid) => ITEMS[iid] && !ITEMS[iid].material);
        m.cursor = Math.max(0, Math.min(m.cursor, remaining.length - 1));
      } else {
        m.msg = 'この道具は戦闘中でないと使えない！';
      }
    }
    return;
  }
  if (m.mode === 'equipSlot') {
    const slots = ['weapon', 'shield', 'armor', 'accessory'];
    if (e.key === 'ArrowUp') m.cursor = (m.cursor + slots.length - 1) % slots.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % slots.length;
    else if (e.key === 'Enter' || e.key === ' ') { m.mode = 'equipList'; m.equipSlot = slots[m.cursor]; m.cursor = 0; }
    else if (e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; }
    return;
  }
  if (m.mode === 'equipList') {
    const owned = state.player.ownedEquipment.filter((id) => EQUIPMENT[id].type === m.equipSlot);
    const list = [null, ...owned];
    if (e.key === 'ArrowUp') m.cursor = (m.cursor - 1 + list.length) % list.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % list.length;
    else if (e.key === 'Enter' || e.key === ' ') { state.player[m.equipSlot] = list[m.cursor]; m.mode = 'equipSlot'; }
    else if (e.key === 'Escape') { m.mode = 'equipSlot'; }
    return;
  }
  if (m.mode === 'spell') {
    const list = state.player.spells;
    if (e.key === 'ArrowUp') m.cursor = (m.cursor - 1 + list.length) % list.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % list.length;
    else if (e.key === 'Enter' || e.key === ' ') {
      const sid = list[m.cursor];
      const spell = SPELLS[sid];
      if (spell.kind === 'heal') {
        if (state.player.mp >= spell.mp) {
          state.player.mp -= spell.mp;
          const heal = spellDamage(spell.power);
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
          m.msg = `HPが${heal}回復した！`;
        } else { m.msg = 'MPが足りない！'; }
      } else { m.msg = '戦闘中でないと使えない！'; }
    } else if (e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; m.msg = null; }
    return;
  }
  if (m.mode === 'status') {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; }
    return;
  }
  if (m.mode === 'quest') {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; }
    return;
  }
  if (m.mode === 'bestiary') {
    const ids = Object.keys(MONSTERS);
    if (e.key === 'ArrowUp') m.cursor = (m.cursor - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % ids.length;
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; }
    return;
  }
  if (m.mode === 'craft') {
    if (e.key === 'Escape') { m.mode = 'top'; m.cursor = 0; m.msg = null; return; }
    if (e.key === 'ArrowUp') m.cursor = (m.cursor - 1 + CRAFT_RECIPES.length) % CRAFT_RECIPES.length;
    else if (e.key === 'ArrowDown') m.cursor = (m.cursor + 1) % CRAFT_RECIPES.length;
    else if (e.key === 'Enter' || e.key === ' ') craftItem(CRAFT_RECIPES[m.cursor].id);
  }
}

function currentShopList(s) { return s.tab === 'buy' ? shopBuyList() : shopSellList(); }

function shopKey(e) {
  const s = state.shop;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { s.tab = s.tab === 'buy' ? 'sell' : 'buy'; s.cursor = 0; s.msg = null; }
  else if (e.key === 'ArrowUp') { const n = currentShopList(s).length + 1; s.cursor = (s.cursor - 1 + n) % n; }
  else if (e.key === 'ArrowDown') { const n = currentShopList(s).length + 1; s.cursor = (s.cursor + 1) % n; }
  else if (e.key === 'Enter' || e.key === ' ') {
    const list = currentShopList(s);
    if (s.cursor === list.length) { state.screen = 'FIELD'; state.shop = null; return; }
    const id = list[s.cursor];
    if (s.tab === 'buy') shopBuy(id); else shopSell(id);
    s.cursor = Math.min(s.cursor, currentShopList(s).length);
  } else if (e.key === 'Escape') { state.screen = 'FIELD'; state.shop = null; }
}

function battleKey(e) {
  const b = state.battle;
  if (!b) return;
  if (b.turn === 'won' || b.turn === 'lost' || b.turn === 'fled') {
    if (e.key === 'Enter' || e.key === ' ') closeBattle();
    return;
  }
  const bm = state.battleMenu;
  if (bm.mode === 'main') {
    if (e.key === 'ArrowUp') bm.cursor = (bm.cursor + mainCommands.length - 1) % mainCommands.length;
    else if (e.key === 'ArrowDown') bm.cursor = (bm.cursor + 1) % mainCommands.length;
    else if (e.key === 'Enter' || e.key === ' ') {
      if (bm.cursor === 0) battleCommandAttack();
      else if (bm.cursor === 1) {
        if (state.player.spells.length === 0) pushLog(b, '呪文を覚えていない！');
        else { bm.mode = 'spell'; bm.cursor = 0; }
      } else if (bm.cursor === 2) {
        const avail = Object.keys(state.player.inventory).filter((id) => ITEMS[id] && ITEMS[id].usableInBattle && state.player.inventory[id] > 0);
        if (avail.length === 0) pushLog(b, '使えるどうぐがない！');
        else { bm.mode = 'item'; bm.cursor = 0; bm.itemList = avail; }
      } else if (bm.cursor === 3) battleCommandDefend();
      else if (bm.cursor === 4) battleCommandFlee();
    }
    return;
  }
  if (bm.mode === 'spell') {
    const list = state.player.spells;
    if (e.key === 'ArrowUp') bm.cursor = (bm.cursor - 1 + list.length) % list.length;
    else if (e.key === 'ArrowDown') bm.cursor = (bm.cursor + 1) % list.length;
    else if (e.key === 'Enter' || e.key === ' ') battleCommandSpell(list[bm.cursor]);
    else if (e.key === 'Escape') { bm.mode = 'main'; bm.cursor = 0; }
    return;
  }
  if (bm.mode === 'item') {
    const list = bm.itemList || [];
    if (list.length === 0) { bm.mode = 'main'; bm.cursor = 0; return; }
    if (e.key === 'ArrowUp') bm.cursor = (bm.cursor - 1 + list.length) % list.length;
    else if (e.key === 'ArrowDown') bm.cursor = (bm.cursor + 1) % list.length;
    else if (e.key === 'Enter' || e.key === ' ') battleCommandItem(list[bm.cursor]);
    else if (e.key === 'Escape') { bm.mode = 'main'; bm.cursor = 0; }
  }
}

function endingKey(e) {
  if (e.key === 'Enter' || e.key === ' ') location.reload();
}

// ------------------------------------------------------------
// 描画
// ------------------------------------------------------------
function draw() {
  if (!ctx) return;
  if (state.screen === 'TITLE') { drawTitle(); return; }
  if (state.screen === 'SLOTSELECT') { drawSlotSelect(); return; }
  if (state.screen === 'ENDING') { drawEnding(); return; }
  if (state.battle) drawBattleScene();
  else if (state.player) drawFieldScene();

  if (state.screen === 'DIALOGUE') drawDialogueBox();
  else if (state.screen === 'CONFIRM') drawConfirmBox();
  else if (state.screen === 'MENU') drawMenu();
  else if (state.screen === 'SHOP') drawShop();
  else if (state.screen === 'BATTLE') drawBattleUI();
}

function drawTitle() {
  ctx.fillStyle = '#0a1428';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawText(CANVAS_W / 2, 120, '勇者の証', { align: 'center', font: 'bold 40px', color: '#ffd54a' });
  drawText(CANVAS_W / 2, 175, '～ 竜の洞窟の伝説 ～', { align: 'center', font: '16px', color: '#cfd8ff' });
  const opts = titleOptions();
  opts.forEach((opt, i) => {
    drawText(CANVAS_W / 2, 300 + i * 40, (state.titleCursor === i ? '▶ ' : '　') + opt, { align: 'center', font: '22px', color: '#fff' });
  });
  if (Math.floor(state.frame / 30) % 2 === 0) {
    drawText(CANVAS_W / 2, 440, '矢印キーで選択・Enterで決定', { align: 'center', font: '13px', color: '#8899cc' });
  }
}

function drawSlotSelect() {
  ctx.fillStyle = '#0a1428';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const s = state.slotSelect;
  drawText(CANVAS_W / 2, 60, s.mode === 'new' ? 'どのスロットに はじめますか？' : 'どのスロットを つづけますか？', { align: 'center', font: 'bold 20px', color: '#ffd54a' });
  const slots = listSaveSlots();
  slots.forEach((slot, i) => {
    const y = 150 + i * 80;
    drawPanel(120, y, 400, 60);
    const label = slot.summary
      ? `${slot.summary.name}  Lv${slot.summary.level}  (${slot.summary.mapName})`
      : '－ からっぽ －';
    drawText(150, y + 20, (s.cursor === i ? '▶ ' : '　') + `スロット${i + 1}: ${label}`, { font: '16px' });
  });
  drawText(CANVAS_W / 2, 420, 'Enterで決定・Escでタイトルへ', { align: 'center', font: '13px', color: '#8899cc' });
}

function drawFieldScene() {
  const map = MAPS[state.player.map];
  const { camX, camY } = computeCamera(map, state.player.x, state.player.y);
  drawMap(map, camX, camY);

  CHESTS.filter((c) => c.map === map.id && !state.flags.chestsOpened.includes(c.id)).forEach((c) => {
    const vx = c.x - camX, vy = c.y - camY;
    if (vx >= 0 && vx < VIEW_COLS && vy >= 0 && vy < VIEW_ROWS) {
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(vx * TILE + 6, vy * TILE + 10, TILE - 12, TILE - 16);
      ctx.strokeStyle = '#7a5a10';
      ctx.lineWidth = 2;
      ctx.strokeRect(vx * TILE + 6, vy * TILE + 10, TILE - 12, TILE - 16);
    }
  });

  SCRIPTED_ENCOUNTERS.filter((s) => s.map === map.id && !state.flags[s.flag]).forEach((s) => {
    const vx = s.x - camX, vy = s.y - camY;
    if (vx >= 0 && vx < VIEW_COLS && vy >= 0 && vy < VIEW_ROWS) {
      const glyph = MONSTERS[s.monster].glyph;
      const color = MONSTERS[s.monster].color;
      drawGlyphSprite(vx * TILE, vy * TILE, glyph, color, Math.sin(state.frame * 0.1) * 3);
    }
  });

  NPCS.filter((n) => n.map === map.id && !(n.hidden && n.hidden(state))).forEach((n) => {
    const vx = n.x - camX, vy = n.y - camY;
    if (vx >= 0 && vx < VIEW_COLS && vy >= 0 && vy < VIEW_ROWS) drawGlyphSprite(vx * TILE, vy * TILE, n.glyph, n.color, 0);
  });

  {
    const vx = state.player.x - camX, vy = state.player.y - camY;
    drawGlyphSprite(vx * TILE, vy * TILE, '勇', '#3a7fd4', Math.sin(state.frame * 0.15) * 2);
  }

  drawNavBanner();
  drawText(CANVAS_W - 10, TOP_UI_OFFSET + 8, map.name, { align: 'right', font: '14px', color: '#fff' });
  drawHud();
  drawMinimap(map, state.player.x, state.player.y);
}

const TOP_UI_OFFSET = 28;

function drawNavBanner() {
  const y = 0, h = 24;
  const text = mainQuestStageText(state);
  ctx.fillStyle = 'rgba(8,14,36,0.82)';
  ctx.fillRect(0, y, CANVAS_W, h);
  ctx.strokeStyle = 'rgba(255,213,74,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, y + 0.5, CANVAS_W - 1, h - 1);
  drawText(CANVAS_W / 2, y + 5, '▶ ' + text, { align: 'center', font: '13px', color: '#ffd54a' });
}

function drawMinimap(map, px, py) {
  const grid = map.grid;
  const w = grid[0].length, h = grid.length;
  const boxW = 130, boxH = 100;
  const boxX = CANVAS_W - boxW - 8, boxY = TOP_UI_OFFSET + 26;
  const pad = 8;
  const cell = Math.min((boxW - pad * 2) / w, (boxH - pad * 2) / h);
  drawPanel(boxX, boxY, boxW, boxH);
  const originX = boxX + pad, originY = boxY + pad;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = WALKABLE.has(grid[y][x]) ? '#3a3a55' : '#141420';
      ctx.fillRect(originX + x * cell, originY + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath();
  ctx.arc(originX + px * cell + cell / 2, originY + py * cell + cell / 2, Math.max(2, cell), 0, Math.PI * 2);
  ctx.fill();
}

function drawHud() {
  const p = state.player;
  const y = TOP_UI_OFFSET + 8;
  drawPanel(8, y, 220, 64);
  drawText(20, y + 8, `${p.name}  Lv${p.level}`, { font: '14px' });
  drawText(20, y + 26, `HP ${p.hp}/${p.maxHp}`, { font: '13px' });
  drawText(120, y + 26, `MP ${p.mp}/${p.maxMp}`, { font: '13px' });
  drawText(20, y + 44, `G ${p.gold}`, { font: '13px' });
}

function drawDialogueBox() {
  drawPanel(20, 340, 600, 120);
  const d = state.dialogue;
  const lines = d.pages[d.index];
  let remaining = Math.floor(d.revealed);
  lines.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, remaining));
    remaining -= line.length;
    drawText(40, 364 + i * 26, shown, { font: '18px' });
  });
  const fullyRevealed = d.revealed >= dialoguePageCharCount(d);
  if (fullyRevealed && Math.floor(state.frame / 20) % 2 === 0) {
    drawText(600, 432, '▼', { align: 'right', font: '16px', color: '#ffd54a' });
  }
}

function drawConfirmBox() {
  const c = state.confirm;
  drawPanel(20, 280, 600, 160);
  c.lines.forEach((line, i) => drawText(40, 300 + i * 26, line, { font: '18px' }));
  const optsY = 280 + 160 - 44;
  drawText(220, optsY, (c.cursor === 0 ? '▶ ' : '　') + 'はい', { font: '18px' });
  drawText(380, optsY, (c.cursor === 1 ? '▶ ' : '　') + 'いいえ', { font: '18px' });
}

function drawMenu() {
  const m = state.menu;
  if (m.mode === 'top') {
    drawPanel(360, 12, 260, 320);
    topOptions.forEach((opt, i) => drawText(380, 30 + i * 34, (m.cursor === i ? '▶ ' : '　') + opt, { font: '17px' }));
    if (m.msg) drawText(380, 30 + topOptions.length * 34 + 6, m.msg, { font: '12px', color: '#ffd54a' });
    return;
  }
  if (m.mode === 'item') {
    drawPanel(60, 20, 520, 300);
    const list = Object.keys(state.player.inventory).filter((id) => ITEMS[id] && !ITEMS[id].material);
    if (list.length === 0) drawText(80, 40, 'どうぐを持っていない。', { font: '15px' });
    list.forEach((id, i) => {
      const item = ITEMS[id];
      drawText(80, 40 + i * 30, (m.cursor === i ? '▶ ' : '　') + `${item.name} x${state.player.inventory[id]}`, { font: '16px' });
    });
    if (m.msg) drawText(80, 270, m.msg, { font: '13px', color: '#ffd54a' });
    drawText(80, 300, 'Enter:つかう　Esc:もどる', { font: '12px', color: '#aaa' });
    return;
  }
  if (m.mode === 'equipSlot') {
    drawPanel(280, 20, 340, 210);
    const names = { weapon: 'ぶき', shield: 'たて', armor: 'よろい', accessory: 'アクセサリ' };
    ['weapon', 'shield', 'armor', 'accessory'].forEach((slot, i) => {
      const eq = state.player[slot];
      const label = eq ? EQUIPMENT[eq].name : 'なし';
      drawText(300, 40 + i * 40, (m.cursor === i ? '▶ ' : '　') + `${names[slot]}: ${label}`, { font: '16px' });
    });
    return;
  }
  if (m.mode === 'equipList') {
    drawPanel(60, 20, 520, 300);
    const owned = state.player.ownedEquipment.filter((id) => EQUIPMENT[id].type === m.equipSlot);
    const list = [null, ...owned];
    list.forEach((id, i) => {
      const label = id === null ? 'はずす' : EQUIPMENT[id].name;
      const equipped = state.player[m.equipSlot] === id;
      drawText(80, 40 + i * 30, (m.cursor === i ? '▶ ' : '　') + label + (equipped ? ' (装備中)' : ''), { font: '16px' });
    });
    return;
  }
  if (m.mode === 'spell') {
    drawPanel(60, 20, 520, 300);
    state.player.spells.forEach((sid, i) => {
      const sp = SPELLS[sid];
      drawText(80, 40 + i * 30, (m.cursor === i ? '▶ ' : '　') + `${sp.name} (MP${sp.mp}) - ${sp.desc}`, { font: '14px' });
    });
    if (m.msg) drawText(80, 280, m.msg, { font: '14px', color: '#ffd54a' });
    return;
  }
  if (m.mode === 'status') {
    drawPanel(60, 20, 520, 360);
    const p = state.player;
    const lines = [
      `名前: ${p.name}`,
      `レベル: ${p.level}`,
      `HP: ${p.hp}/${p.maxHp}`,
      `MP: ${p.mp}/${p.maxMp}`,
      `こうげき力: ${playerAtk(p)}`,
      `しゅび力: ${playerDef(p)}`,
      `経験値: ${p.exp}  (つぎのレベルまで ${Math.max(0, expToReach(p.level + 1) - p.exp)})`,
      `ゴールド: ${p.gold}`,
      `なかま: ${p.companion ? COMPANIONS[p.companion].name : 'いない'}`,
      `ぶき: ${p.weapon ? EQUIPMENT[p.weapon].name : 'なし'}`,
      `たて: ${p.shield ? EQUIPMENT[p.shield].name : 'なし'}`,
      `よろい: ${p.armor ? EQUIPMENT[p.armor].name : 'なし'}`,
      `アクセサリ: ${p.accessory ? EQUIPMENT[p.accessory].name : 'なし'}`,
    ];
    lines.forEach((l, i) => drawText(80, 38 + i * 24, l, { font: '15px' }));
    drawText(80, 358, 'Enterでもどる', { font: '12px', color: '#aaa' });
    return;
  }
  if (m.mode === 'quest') {
    drawPanel(60, 20, 520, 300);
    drawText(80, 40, 'メインクエスト', { font: '14px', color: '#ffd54a' });
    const stageLines = wrapJapanese(mainQuestStageText(state), 30);
    stageLines.forEach((line, i) => drawText(80, 64 + i * 22, line, { font: '14px' }));
    let y = 64 + stageLines.length * 22 + 22;
    drawText(80, y, 'サイドクエスト', { font: '14px', color: '#ffd54a' });
    y += 26;
    SIDE_QUESTS.forEach((q) => {
      const status = state.flags[q.doneFlag] ? '完了' : (state.flags[q.activeFlag] ? '進行中' : '未受注');
      drawText(80, y, `・${q.name} (${status})`, { font: '14px' });
      y += 26;
    });
    drawText(80, 300, 'Enterでもどる', { font: '12px', color: '#aaa' });
    return;
  }
  if (m.mode === 'bestiary') {
    const ids = Object.keys(MONSTERS);
    drawPanel(60, 12, 520, 440);
    ids.forEach((id, i) => {
      const known = !!(state.flags.bestiary && state.flags.bestiary[id]);
      const label = known ? `${MONSTERS[id].glyph} ${MONSTERS[id].name}` : '？？？？？';
      drawText(80, 30 + i * 22, (m.cursor === i ? '▶ ' : '　') + label, { font: '13px', color: known ? '#fff' : '#777' });
    });
    const curId = ids[m.cursor];
    const curKnown = !!(state.flags.bestiary && state.flags.bestiary[curId]);
    drawText(80, 422, curKnown ? MONSTERS[curId].desc : 'まだ出会っていないモンスターだ。', { font: '12px', color: '#ffd54a' });
    return;
  }
  if (m.mode === 'craft') {
    drawPanel(40, 12, 560, 420);
    drawText(60, 30, `アイテム合成　所持金:${state.player.gold}G`, { font: '15px', color: '#ffd54a' });
    CRAFT_RECIPES.forEach((r, i) => {
      const p = state.player;
      const affordable = p.gold >= r.gold && craftHasMaterials(p, r);
      const matText = Object.entries(r.materials).map(([id, qty]) => `${ITEMS[id].name} ${p.inventory[id] || 0}/${qty}`).join('　');
      const y = 62 + i * 48;
      drawText(60, y, (m.cursor === i ? '▶ ' : '　') + `${r.name}　${r.gold}G`, { font: '14px', color: affordable ? '#fff' : '#888' });
      drawText(80, y + 20, matText, { font: '11px', color: '#aaa' });
    });
    if (m.msg) drawText(60, 62 + CRAFT_RECIPES.length * 48 + 6, m.msg, { font: '13px', color: '#ffd54a' });
    drawText(60, 412, 'Enter:合成する　Esc:もどる', { font: '12px', color: '#aaa' });
  }
}

function drawShop() {
  const s = state.shop;
  drawPanel(40, 20, 560, 400);
  drawText(60, 32, `${SHOPS[s.shopId].name}　所持金:${state.player.gold}G`, { font: '16px' });
  drawText(60, 58, s.tab === 'buy' ? '▶買う　　売る' : '　買う　▶売る', { font: '14px', color: '#aaa' });
  const list = currentShopList(s);
  if (list.length === 0) drawText(60, 90, 'なにもない。', { font: '14px' });
  list.forEach((id, i) => {
    const def = itemDef(id);
    const price = s.tab === 'buy' ? def.price : Math.floor(def.price / 2);
    drawText(60, 90 + i * 28, (s.cursor === i ? '▶ ' : '　') + `${def.name}　${price}G`, { font: '15px' });
  });
  const exitY = 90 + list.length * 28;
  drawText(60, exitY, (s.cursor === list.length ? '▶ ' : '　') + 'でる', { font: '15px' });
  if (s.msg) drawText(60, 390, s.msg, { font: '14px', color: '#ffd54a' });
}

function drawBar(x, y, w, h, val, max, color) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, w, h);
  const ratio = Math.max(0, val / max);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawBattleScene() {
  const b = state.battle;
  ctx.fillStyle = b.monster.boss ? '#3a0a0a' : '#102a1a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  if (b.shake > 0) ctx.translate(Math.random() * 8 - 4, Math.random() * 8 - 4);

  const mx = CANVAS_W / 2, my = 170;
  const radius = b.monster.boss ? 70 : 50;
  const shakeOx = b.flashEnemy > 0 ? (Math.random() * 6 - 3) : 0;
  ctx.save();
  ctx.translate(shakeOx, 0);
  ctx.fillStyle = b.flashEnemy > 0 ? '#fff' : b.monster.color;
  ctx.beginPath();
  ctx.arc(mx, my, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = b.flashEnemy > 0 ? '#000' : '#fff';
  ctx.font = `bold ${b.monster.boss ? 48 : 32}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.monster.glyph, mx, my + 2);
  ctx.restore();

  const monsterStatusLabel = b.monsterStatus ? (b.monsterStatus.type === 'poison' ? '(どく)' : '(すいみん)') : '';
  drawText(mx, my - radius - 30, b.monster.name + (monsterStatusLabel ? ' ' + monsterStatusLabel : ''), { align: 'center', font: '18px', color: b.monsterStatus ? '#c07adf' : '#fff' });
  drawBar(mx - 80, my - radius - 12, 160, 14, b.monster.hp, b.monster.maxHp, '#d43a3a');

  const p = state.player;
  const playerStatusLabel = b.playerStatus && b.playerStatus.type === 'poison' ? ' (どく)' : '';
  drawText(30, 220, `${p.name}  Lv${p.level}${playerStatusLabel}`, { font: '16px', color: playerStatusLabel ? '#c07adf' : '#fff' });
  drawBar(30, 244, 180, 14, p.hp, p.maxHp, '#3ad46a');
  drawText(220, 244, `${p.hp}/${p.maxHp}`, { font: '13px' });
  drawBar(30, 264, 180, 14, p.mp, p.maxMp, '#3a8fd4');
  drawText(220, 264, `${p.mp}/${p.maxMp}`, { font: '13px' });
  if (p.companion) {
    drawText(30, 284, `${COMPANIONS[p.companion].name}が加勢中！`, { font: '12px', color: '#7ad4ff' });
  }

  drawPanel(20, 300, 380, 160);
  const visibleLog = b.log.slice(-5);
  visibleLog.forEach((line, i) => {
    const isLast = i === visibleLog.length - 1;
    const shown = isLast ? line.slice(0, Math.floor(b.logRevealed || 0)) : line;
    drawText(40, 316 + i * 24, shown, { font: '14px' });
  });

  drawBattlePopups(b);
  ctx.restore();
}

function drawBattlePopups(b) {
  const mx = CANVAS_W / 2, my = 170;
  (b.popups || []).forEach((p) => {
    const t = 1 - p.life / 40;
    const alpha = Math.max(0, 1 - t);
    const rise = t * 30;
    const baseX = p.target === 'enemy' ? mx : 110;
    const baseY = p.target === 'enemy' ? my - 60 : 230;
    const color = p.heal ? '#7af08a' : (p.crit ? '#ffd54a' : '#ffffff');
    const text = (p.heal ? '+' : '-') + p.amount + (p.crit ? '!' : '');
    ctx.save();
    ctx.globalAlpha = alpha;
    drawText(baseX, baseY - rise, text, { align: 'center', font: p.crit ? 'bold 22px' : 'bold 16px', color });
    ctx.restore();
  });
}

function drawBattleUI() {
  const b = state.battle;
  if (b.turn === 'command') {
    drawPanel(410, 300, 210, 160);
    const bm = state.battleMenu;
    if (bm.mode === 'main') {
      mainCommands.forEach((c, i) => drawText(430, 316 + i * 32, (bm.cursor === i ? '▶ ' : '　') + c, { font: '16px' }));
    } else if (bm.mode === 'spell') {
      state.player.spells.forEach((sid, i) => {
        const sp = SPELLS[sid];
        drawText(425, 314 + i * 24, (bm.cursor === i ? '▶' : '　') + `${sp.name}(${sp.mp})`, { font: '13px' });
      });
      drawText(425, 440, 'Esc:もどる', { font: '11px', color: '#aaa' });
    } else if (bm.mode === 'item') {
      (bm.itemList || []).forEach((id, i) => {
        drawText(425, 314 + i * 24, (bm.cursor === i ? '▶' : '　') + `${ITEMS[id].name} x${state.player.inventory[id]}`, { font: '13px' });
      });
      drawText(425, 440, 'Esc:もどる', { font: '11px', color: '#aaa' });
    }
    return;
  }
  drawPanel(410, 300, 210, 160);
  drawText(430, 360, 'Enterで つづける', { font: '13px', color: '#ffd54a' });
}

function drawEnding() {
  ctx.fillStyle = '#0a0a2a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawText(CANVAS_W / 2, 90, '魔竜王ガロズを倒した！', { align: 'center', font: 'bold 24px', color: '#ffd54a' });
  const lines = [
    '光の聖剣が、闇に染まった竜の心を打ち砕いた。',
    'ルミナ村にも、フェルンの城下町にも、',
    '再び穏やかな日々が戻った。',
  ];
  const extra = state.endingExtraLines || [];
  if (extra.length > 0) { lines.push(''); extra.forEach((l) => lines.push(l)); }
  lines.push('', `勇者${state.player.name}の物語は、こうして幕を閉じる……`, '', '- おわり -');
  const lineH = lines.length > 10 ? 24 : 28;
  lines.forEach((l, i) => drawText(CANVAS_W / 2, 150 + i * lineH, l, { align: 'center', font: '16px' }));
  if (Math.floor(state.frame / 30) % 2 === 0) {
    drawText(CANVAS_W / 2, 440, 'Enterでタイトルへ', { align: 'center', font: '13px', color: '#8899cc' });
  }
}
