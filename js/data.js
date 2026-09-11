// ============================================================
// data.js - マップ / モンスター / アイテム / 会話などの静的データ
// ============================================================

const TILES = {
  WALL: 0,
  GROUND: 1,
  WATER: 2,
  TREE: 3,
  FLOOR: 4,
  DOOR: 5,
  MOUNTAIN: 6,
  FLOWER: 7,
  STATUE: 8,
};

const WALKABLE = new Set([TILES.GROUND, TILES.FLOOR, TILES.DOOR, TILES.FLOWER]);
const ENCOUNTER_TILES = new Set([TILES.GROUND, TILES.FLOOR]);

// --- マップ生成ヘルパー ---------------------------------------
function buildMap(width, height, base) {
  const grid = [];
  for (let y = 0; y < height; y++) grid.push(new Array(width).fill(base));
  return grid;
}
function cloneGrid(grid) { return grid.map((row) => row.slice()); }

// 村の発展段階: 0=初期 1=聖剣入手後 2=魔竜王撃破後(エンディング後の平和な村)
function townStage(state) {
  if (state.flags.bossDefeated) return 2;
  if (state.flags.hasHolySword) return 1;
  return 0;
}

// メインクエストの現在の目標をクエストログ用に一行で表す
function mainQuestStageText(state) {
  const f = state.flags;
  if (f.storyEnded) return '勇者の物語は幕を閉じた。';
  if (f.bossDefeated) return '魔竜王を倒した。ルミナ村の長老に話しかけると物語を終えられる。';
  if (f.hasHolySword) return '聖剣を手に、竜の洞窟の奥で魔竜王ガロズに挑もう。';
  if (f.questAccepted) return 'フェルンの城下町で王に会い、聖剣のありかを聞こう。';
  return 'ルミナ村の長老に話しかけよう。';
}
function setTiles(grid, coords, tile) {
  coords.forEach(([x, y]) => {
    if (grid[y] && grid[y][x] !== undefined) grid[y][x] = tile;
  });
}
function setRect(grid, x0, y0, x1, y1, tile) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (grid[y] && grid[y][x] !== undefined) grid[y][x] = tile;
    }
  }
}
function setBorder(grid, tile) {
  const h = grid.length, w = grid[0].length;
  for (let x = 0; x < w; x++) { grid[0][x] = tile; grid[h - 1][x] = tile; }
  for (let y = 0; y < h; y++) { grid[y][0] = tile; grid[y][w - 1] = tile; }
}

// ============================================================
// 村: ルミナ村 (物語の進行で見た目が進化する)
// ============================================================
const townGridBase = buildMap(15, 11, TILES.GROUND);
setBorder(townGridBase, TILES.TREE);
setRect(townGridBase, 0, 0, 14, 0, TILES.TREE);
setRect(townGridBase, 0, 10, 14, 10, TILES.TREE);
setTiles(townGridBase, [[7, 10], [8, 10]], TILES.DOOR); // 村の南口 -> 平原
setTiles(townGridBase, [[2, 2], [12, 2], [2, 8], [12, 8]], TILES.TREE);
setRect(townGridBase, 6, 4, 7, 5, TILES.WATER);

// 第1段階: 聖剣を手に入れた噂が広まり、花が飾られはじめる
const townGridStage1 = cloneGrid(townGridBase);
setTiles(townGridStage1, [[5, 4], [8, 4], [5, 5], [8, 5]], TILES.FLOWER);

// 第2段階: 魔竜王を倒し、村に平和と賑わいが戻る。中央に勇者の像が建つ
const townGridStage2 = cloneGrid(townGridStage1);
setTiles(townGridStage2, [[4, 4], [9, 4], [4, 5], [9, 5], [6, 7], [8, 7]], TILES.FLOWER);
setTiles(townGridStage2, [[7, 7]], TILES.STATUE);

const TOWN_GRIDS_BY_STAGE = [townGridBase, townGridStage1, townGridStage2];
const TOWN_BG_COLORS = ['#050505', '#14180d', '#241c08'];
function townGridForStage(stage) { return TOWN_GRIDS_BY_STAGE[Math.max(0, Math.min(2, stage))]; }

// ============================================================
// リアーナ平原
// ============================================================
const fieldGrid = buildMap(22, 16, TILES.GROUND);
setBorder(fieldGrid, TILES.TREE);
setTiles(fieldGrid, [[10, 0], [11, 0]], TILES.DOOR); // 北口 -> 村
setRect(fieldGrid, 16, 11, 20, 13, TILES.MOUNTAIN);
setTiles(fieldGrid, [[18, 13]], TILES.DOOR); // 洞窟入口(結界あり)
setTiles(fieldGrid, [[21, 7], [21, 8]], TILES.DOOR); // 東口 -> フェルン城下町
setRect(fieldGrid, 2, 2, 4, 4, TILES.TREE);
setRect(fieldGrid, 15, 2, 18, 3, TILES.TREE);
setRect(fieldGrid, 3, 9, 6, 11, TILES.WATER);
setRect(fieldGrid, 8, 6, 9, 8, TILES.TREE);
setRect(fieldGrid, 12, 8, 13, 9, TILES.TREE);

// ============================================================
// 竜の洞窟
// ============================================================
const caveGrid = buildMap(22, 18, TILES.WALL);
setRect(caveGrid, 9, 14, 13, 16, TILES.FLOOR); // 入口の間
setTiles(caveGrid, [[11, 17]], TILES.DOOR); // 洞窟出口 -> 平原
setRect(caveGrid, 10, 10, 12, 14, TILES.FLOOR); // 上への通路
setRect(caveGrid, 4, 9, 7, 12, TILES.FLOOR); // 西の小部屋
setRect(caveGrid, 7, 10, 10, 11, TILES.FLOOR); // 接続通路
setRect(caveGrid, 10, 6, 12, 10, TILES.FLOOR); // 通路続き
setRect(caveGrid, 14, 5, 18, 8, TILES.FLOOR); // 東の小部屋
setRect(caveGrid, 12, 6, 15, 7, TILES.FLOOR); // 接続通路
setRect(caveGrid, 10, 2, 12, 6, TILES.FLOOR); // 最深部への通路
setRect(caveGrid, 7, 1, 15, 4, TILES.FLOOR); // ボスの間
setTiles(caveGrid, [[11, 1]], TILES.DOOR); // 魔竜王撃破後、試練の塔への道が開ける

// ============================================================
// フェルンの城下町
// ============================================================
const town2Grid = buildMap(20, 14, TILES.GROUND);
setBorder(town2Grid, TILES.TREE);
setTiles(town2Grid, [[0, 6], [0, 7]], TILES.DOOR); // 西口 -> リアーナ平原
setTiles(town2Grid, [[10, 13], [11, 13]], TILES.DOOR); // 南口 -> 囁きの森
setRect(town2Grid, 7, 1, 12, 4, TILES.WALL); // 城
setRect(town2Grid, 9, 1, 9, 4, TILES.GROUND); // 城への通路
setRect(town2Grid, 2, 9, 4, 10, TILES.WATER);
setTiles(town2Grid, [[15, 9], [16, 9], [2, 3], [17, 3]], TILES.TREE);

// ============================================================
// 囁きの森
// ============================================================
const field2Grid = buildMap(20, 16, TILES.GROUND);
setBorder(field2Grid, TILES.TREE);
setTiles(field2Grid, [[10, 0], [11, 0]], TILES.DOOR); // 北口 -> フェルン城下町
setTiles(field2Grid, [[10, 15], [11, 15]], TILES.DOOR); // 南口 -> 古代遺跡
setRect(field2Grid, 2, 2, 5, 5, TILES.TREE);
setRect(field2Grid, 13, 2, 17, 4, TILES.TREE);
setRect(field2Grid, 2, 10, 6, 13, TILES.TREE);
setRect(field2Grid, 13, 9, 18, 13, TILES.TREE);
setRect(field2Grid, 8, 7, 11, 9, TILES.WATER);

// ============================================================
// 古代遺跡
// ============================================================
const ruinsGrid = buildMap(22, 18, TILES.WALL);
setRect(ruinsGrid, 8, 15, 14, 17, TILES.FLOOR); // 入口の間
setTiles(ruinsGrid, [[10, 17], [11, 17]], TILES.DOOR); // 出口 -> 囁きの森
setRect(ruinsGrid, 10, 11, 12, 15, TILES.FLOOR); // 上への通路
setRect(ruinsGrid, 4, 10, 7, 13, TILES.FLOOR); // 西の小部屋(宝箱)
setRect(ruinsGrid, 7, 11, 10, 12, TILES.FLOOR); // 接続通路
setRect(ruinsGrid, 10, 7, 12, 11, TILES.FLOOR); // 通路続き
setRect(ruinsGrid, 14, 6, 18, 9, TILES.FLOOR); // 東の小部屋(ミミック)
setRect(ruinsGrid, 12, 7, 14, 8, TILES.FLOOR); // 接続通路
setRect(ruinsGrid, 10, 3, 12, 7, TILES.FLOOR); // 最深部への通路
setRect(ruinsGrid, 6, 1, 16, 4, TILES.FLOOR); // ガーディアンの間

// ============================================================
// 試練の塔 (隠しダンジョン・魔竜王撃破後にのみ到達可能)
// ============================================================
const towerGrid = buildMap(16, 20, TILES.WALL);
setRect(towerGrid, 6, 16, 9, 18, TILES.FLOOR); // 入口の間
setTiles(towerGrid, [[7, 18], [8, 18]], TILES.DOOR); // 洞窟へ戻る道
setRect(towerGrid, 7, 10, 8, 16, TILES.FLOOR); // 中層への階段
setRect(towerGrid, 4, 7, 11, 10, TILES.FLOOR); // 試練の間 (宝箱・強敵)
setRect(towerGrid, 7, 3, 8, 7, TILES.FLOOR); // 最上階への階段
setRect(towerGrid, 4, 1, 11, 4, TILES.FLOOR); // 最上階 (大魔導士の間)

// ============================================================
// マップ定義
// ============================================================
const MAPS = {
  town: {
    id: 'town', name: 'ルミナ村',
    get grid() { return townGridForStage(typeof state !== 'undefined' ? townStage(state) : 0); },
    encounter: null,
    startX: 7, startY: 9, startDir: 'up',
    get bgColor() { return TOWN_BG_COLORS[typeof state !== 'undefined' ? townStage(state) : 0]; },
  },
  field: {
    id: 'field', name: 'リアーナ平原', grid: fieldGrid,
    encounter: { rate: 0.06, table: [
      { id: 'slime', weight: 5 },
      { id: 'slime_fat', weight: 3 },
      { id: 'wolf', weight: 3 },
    ] },
    startX: 10, startY: 1, startDir: 'down',
    bgColor: '#2b6b3a',
  },
  cave: {
    id: 'cave', name: '竜の洞窟', grid: caveGrid,
    encounter: { rate: 0.09, table: [
      { id: 'ghost', weight: 4 },
      { id: 'scorpion', weight: 4 },
      { id: 'golem', weight: 2 },
    ] },
    startX: 11, startY: 16, startDir: 'up',
    bgColor: '#1a1a2e',
  },
  town2: {
    id: 'town2', name: 'フェルン城下町', grid: town2Grid,
    encounter: null,
    startX: 1, startY: 6, startDir: 'right',
    bgColor: '#2a3a5a',
  },
  field2: {
    id: 'field2', name: '囁きの森', grid: field2Grid,
    encounter: { rate: 0.07, table: [
      { id: 'bat', weight: 5 },
      { id: 'thief', weight: 4 },
      { id: 'wolf', weight: 3 },
    ] },
    startX: 10, startY: 1, startDir: 'down',
    bgColor: '#1e3a2a',
  },
  ruins: {
    id: 'ruins', name: '古代遺跡', grid: ruinsGrid,
    encounter: { rate: 0.10, table: [
      { id: 'skeleton', weight: 5 },
      { id: 'dark_knight', weight: 3 },
      { id: 'bat', weight: 2 },
    ] },
    startX: 11, startY: 16, startDir: 'up',
    bgColor: '#2a2418',
  },
  tower: {
    id: 'tower', name: '試練の塔', grid: towerGrid,
    encounter: { rate: 0.11, table: [
      { id: 'tower_wraith', weight: 4 },
      { id: 'iron_golem', weight: 3 },
      { id: 'arcane_sentinel', weight: 3 },
    ] },
    startX: 7, startY: 17, startDir: 'up',
    bgColor: '#241830',
  },
};

// ============================================================
// ワープ (mapId,x,y) -> 移動先
// ============================================================
const WARPS = {
  'town:7:10': { map: 'field', x: 10, y: 1, dir: 'down' },
  'town:8:10': { map: 'field', x: 11, y: 1, dir: 'down' },
  'field:10:0': { map: 'town', x: 7, y: 9, dir: 'up' },
  'field:11:0': { map: 'town', x: 8, y: 9, dir: 'up' },
  'field:18:13': { map: 'cave', x: 11, y: 16, dir: 'up' },
  'cave:11:17': { map: 'field', x: 18, y: 14, dir: 'down' },
  'field:21:7': { map: 'town2', x: 1, y: 6, dir: 'right' },
  'field:21:8': { map: 'town2', x: 1, y: 7, dir: 'right' },
  'town2:0:6': { map: 'field', x: 20, y: 7, dir: 'left' },
  'town2:0:7': { map: 'field', x: 20, y: 8, dir: 'left' },
  'town2:10:13': { map: 'field2', x: 10, y: 1, dir: 'down' },
  'town2:11:13': { map: 'field2', x: 11, y: 1, dir: 'down' },
  'field2:10:0': { map: 'town2', x: 10, y: 12, dir: 'up' },
  'field2:11:0': { map: 'town2', x: 11, y: 12, dir: 'up' },
  'field2:10:15': { map: 'ruins', x: 10, y: 16, dir: 'up' },
  'field2:11:15': { map: 'ruins', x: 11, y: 16, dir: 'up' },
  'ruins:10:17': { map: 'field2', x: 10, y: 14, dir: 'down' },
  'ruins:11:17': { map: 'field2', x: 11, y: 14, dir: 'down' },
  'cave:11:1': { map: 'tower', x: 7, y: 17, dir: 'up' },
  'tower:7:18': { map: 'cave', x: 11, y: 2, dir: 'down' },
  'tower:8:18': { map: 'cave', x: 11, y: 2, dir: 'down' },
};

// 竜の洞窟の入り口を封じる結界。聖剣を持たない限り通れない。
const BARRIER_MAP = 'cave';
const BARRIER_FLAG = 'hasHolySword';

// ============================================================
// 宝箱
// ============================================================
const CHESTS = [
  { id: 'chest_cave1', map: 'cave', x: 5, y: 10, item: 'shield_leather', gold: 0 },
  { id: 'chest_cave2', map: 'cave', x: 16, y: 6, item: 'sword_steel', gold: 0 },
  { id: 'chest_field1', map: 'field', x: 3, y: 5, item: null, gold: 40 },
  { id: 'chest_ruins1', map: 'ruins', x: 5, y: 11, item: 'shield_mythril', gold: 0 },
  { id: 'chest_ruins2', map: 'ruins', x: 16, y: 7, item: null, gold: 0, mimic: true },
  { id: 'chest_tower1', map: 'tower', x: 5, y: 8, item: 'shield_aegis', gold: 0 },
  { id: 'chest_tower2', map: 'tower', x: 10, y: 8, item: 'armor_radiant', gold: 0 },
];

// ============================================================
// スクリプトイベント戦闘 (特定のタイルに触れると一度だけ発生)
// ============================================================
const SCRIPTED_ENCOUNTERS = [
  {
    id: 'guardian', map: 'ruins', x: 11, y: 2, monster: 'guardian_stone', flag: 'guardianDefeated',
    introLines: ['遺跡の最奥で、巨大な石像がゆっくりと動き出した！', '古の番人「ガーディアン」が目覚めた！'],
  },
  {
    id: 'dragon', map: 'cave', x: 11, y: 2, monster: 'dragon_king', flag: 'bossDefeated',
    introLines: ['奥から強大な気配を感じる……', '魔竜王ガロズが目を覚ました！'],
  },
  {
    id: 'superboss', map: 'tower', x: 7, y: 2, monster: 'archmage_zenon', flag: 'superbossDefeated',
    introLines: ['塔の最奥、渦巻く魔力の中心に、何者かが佇んでいた。', '試練の塔の主、大魔導士ゼノンが姿を現した！'],
  },
];

// ============================================================
// NPC
// ============================================================
const NPCS = [
  {
    id: 'elder', map: 'town', x: 7, y: 2, glyph: '長', color: '#e0c26b',
    lines(state) {
      if (state.flags.bossDefeated) {
        return ['勇者よ、そなたのおかげで村に平和が戻った。', 'この村はいつまでもそなたを誇りに思うだろう。'];
      }
      if (state.flags.hasHolySword) {
        return ['聖剣を手にしたか！ それならば竜の結界も破れよう。', '気をつけて、魔竜王ガロズを倒しておくれ。'];
      }
      if (state.flags.questAccepted) {
        return ['竜の洞窟の入り口は強い結界に守られておる。', '東にあるフェルンの城下町で、王様に相談してみるとよい。'];
      }
      state.flags.questAccepted = true;
      return [
        'おお、勇者よ。よくぞ参った。',
        '村の南に広がるリアーナ平原の先、竜の洞窟の奥に',
        '魔竜王ガロズという恐ろしい魔物が封じられておる。',
        '奴が目覚めれば、この村も無事では済まぬだろう。',
        'じゃが、洞窟の入り口は強い結界に守られておる。',
        'まずは東にあるフェルンの城下町へ向かい、',
        '王様の力を借りるのじゃ。',
      ];
    },
  },
  {
    id: 'shop', map: 'town', x: 3, y: 6, glyph: '商', color: '#6ba3e0',
    shop: 'weapon',
    lines() { return ['いらっしゃい！ 良い武具を取り揃えているよ。']; },
  },
  {
    id: 'inn', map: 'town', x: 11, y: 6, glyph: '宿', color: '#e08a6b',
    inn: true,
    lines() { return ['疲れたようだね。休んでいくかい？']; },
  },
  {
    id: 'villager1', map: 'town', x: 4, y: 3, glyph: '村', color: '#a0e06b',
    lines(state) {
      const stage = townStage(state);
      if (stage >= 2) return ['勇者様のおかげで、村に活気が戻ったよ！', 'こんなに賑やかなルミナ村は久しぶりだ。'];
      if (stage >= 1) return ['聖剣を手に入れたって聞いたよ！', 'いよいよ竜退治か……頑張っておくれ。'];
      return ['この村はルミナ村。小さいけど平和な村さ。'];
    },
  },
  {
    id: 'villager2', map: 'town', x: 10, y: 8, glyph: '村', color: '#a0e06b',
    lines() { return ['宿屋で休めば、体力も魔力も全回復するし、記録も残せるよ。']; },
  },
  {
    id: 'villagerHype', map: 'town', x: 8, y: 8, glyph: '村', color: '#e0c26b',
    hidden(state) { return townStage(state) < 1; },
    lines() { return ['聖剣を見つけたって本当かい！？', 'さすが勇者様だ、頼りにしてるよ！']; },
  },
  {
    id: 'villagerFestival', map: 'town', x: 6, y: 8, glyph: '子', color: '#e08ac0',
    hidden(state) { return townStage(state) < 2; },
    lines() { return ['えへへ、村がにぎやかになって嬉しいな！', '勇者様、ありがとう！']; },
  },
  {
    id: 'happyDog', map: 'town', x: 13, y: 3, glyph: '犬', color: '#c9a06b',
    hidden(state) { return !state.flags.dogQuestDone; },
    lines() { return ['(ワンワン！ ポチは元気いっぱいだ)']; },
  },
  {
    id: 'dogOwner', map: 'town', x: 12, y: 3, glyph: '主', color: '#e0a06b',
    lines(state) {
      if (state.flags.dogQuestDone) {
        return ['ポチも元気にしているよ。本当にありがとう。'];
      }
      if (state.flags.dogFound) {
        state.flags.dogQuestDone = true;
        addItem(state.player, 'item_hi_herb', 1);
        state.player.gold += 30;
        return ['おお、ポチ！ よかった、無事だったんだね！', 'お礼に上級やくそうと30ゴールドを渡すよ。', '本当にありがとう、勇者様。'];
      }
      if (state.flags.dogQuestActive) {
        return ['ポチがまだ見つからないの……', 'リアーナ平原のどこかにいると思うんだけど。'];
      }
      state.flags.dogQuestActive = true;
      return ['うちの犬のポチが、リアーナ平原に迷い込んでしまったの。', 'もし見かけたら、連れて帰ってきてくれない？'];
    },
  },
  {
    id: 'traveler', map: 'field', x: 6, y: 6, glyph: '旅', color: '#c0c0c0',
    lines() { return ['洞窟の入り口には結界が張られているらしい。', 'フェルンの城下町で話を聞くといい。']; },
  },
  {
    id: 'lostDog', map: 'field', x: 5, y: 13, glyph: '犬', color: '#c9a06b',
    hidden(state) { return state.flags.dogFound; },
    lines(state) {
      state.flags.dogFound = true;
      return ['(クゥン……)', '迷子の犬を見つけた！ 村に連れて帰ろう。'];
    },
  },
  {
    id: 'king', map: 'town2', x: 9, y: 2, glyph: '王', color: '#ffd54a',
    lines(state) {
      if (state.flags.hasHolySword) {
        return ['聖剣の力、確かに感じるぞ。', 'その力で、竜の結界を打ち破るのじゃ。', '健闘を祈る、勇者よ。'];
      }
      if (state.flags.guardianDefeated) {
        return ['ガーディアンを倒したというのか！', 'ならば聖剣は手に入れたはずじゃ。', '竜の洞窟へ向かうがよい。'];
      }
      return [
        'よく来た、旅の勇者よ。',
        '竜の洞窟を守る結界は、光の聖剣でしか破れぬ。',
        'その剣は、東の森を越えた古代遺跡に眠っておる。',
        '遺跡には石の番人「ガーディアン」が眠っているという。',
        '力を試されるであろうが、どうか成し遂げてほしい。',
      ];
    },
  },
  {
    id: 'weapon2', map: 'town2', x: 5, y: 6, glyph: '武', color: '#6ba3e0',
    shop: 'weapon2',
    lines() { return ['当店では上質な武具を扱っております。']; },
  },
  {
    id: 'magic', map: 'town2', x: 14, y: 6, glyph: '魔', color: '#b18ae6',
    shop: 'magic',
    lines() { return ['薬や巻物なら、なんでも揃えていますよ。']; },
  },
  {
    id: 'inn2', map: 'town2', x: 14, y: 9, glyph: '宿', color: '#e08a6b',
    inn: true,
    lines() { return ['王都自慢の宿だよ。ゆっくりしていきな。']; },
  },
  {
    id: 'villagerC', map: 'town2', x: 4, y: 4, glyph: '住', color: '#a0e06b',
    lines() { return ['古代遺跡には昔の魔法使いの遺産が眠っているそうよ。', '油断しないでね。']; },
  },
  {
    id: 'villagerD', map: 'town2', x: 16, y: 4, glyph: '住', color: '#a0e06b',
    lines() { return ['宝箱の中には、たまに化け物が潜んでいることもあるらしい……', '気をつけて。']; },
  },
  {
    id: 'hunter', map: 'town2', x: 5, y: 9, glyph: '猟', color: '#c98a4a',
    lines(state) {
      if (state.flags.wolfQuestDone) {
        return ['おかげで平原の狼も落ち着いたよ。感謝する。'];
      }
      const kills = (state.flags.killCounts && state.flags.killCounts.wolf) || 0;
      if (kills >= 5) {
        state.flags.wolfQuestDone = true;
        state.player.gold += 50;
        addItem(state.player, 'item_hi_herb', 2);
        return ['おお、はぐれ狼を5匹も討伐してくれたのか！', 'これは礼だ、受け取ってくれ。', '(50ゴールドと上級やくそうを2つ手に入れた！)'];
      }
      if (state.flags.wolfQuestActive) {
        return [`まだ平原に狼が出るらしい。(討伐数: ${kills}/5)`, '引き続き頼めるか？'];
      }
      state.flags.wolfQuestActive = true;
      return ['リアーナ平原にはぐれ狼が増えて困っているんだ。', '5匹ほど討伐してきてくれないか？'];
    },
  },
  {
    id: 'granny', map: 'town2', x: 16, y: 6, glyph: '婆', color: '#c0a0c0',
    lines(state) {
      if (state.flags.locketQuestDone) {
        return ['ロケットは私の大切な宝物。', '本当にありがとう、勇者様。'];
      }
      if (state.flags.locketFound) {
        state.flags.locketQuestDone = true;
        addOwnedEquipment(state.player, 'locket_memory');
        return ['まあ、これは……！ 亡き夫の形見のロケット！', '見つけてくれて本当にありがとう。', 'お礼にこのお守りを受け取っておくれ。', '(思い出のロケットを手に入れた！)'];
      }
      if (state.flags.locketQuestActive) {
        return ['ロケットは囁きの森のどこかに落ちているはずなんじゃ……'];
      }
      state.flags.locketQuestActive = true;
      return ['囁きの森で、大切なロケットを落としてしまってのう……', 'もし見かけたら、届けてもらえんかのう。'];
    },
  },
  {
    id: 'lostLocket', map: 'field2', x: 4, y: 8, glyph: '飾', color: '#e0c26b',
    hidden(state) { return state.flags.locketFound; },
    lines(state) {
      state.flags.locketFound = true;
      return ['(キラッ……)', '古びたロケットを見つけた！ フェルンの城下町に届けよう。'];
    },
  },
];

// ============================================================
// サイドクエスト一覧 (クエストログUIが参照する)
// ============================================================
const SIDE_QUESTS = [
  { id: 'dog', name: 'まいごの犬', activeFlag: 'dogQuestActive', doneFlag: 'dogQuestDone' },
  { id: 'wolfHunt', name: '狼退治', activeFlag: 'wolfQuestActive', doneFlag: 'wolfQuestDone' },
  { id: 'locket', name: '忘れ形見のロケット', activeFlag: 'locketQuestActive', doneFlag: 'locketQuestDone' },
];

// ============================================================
// ゲーム開始時のオープニング (さいしょから、のみ表示)
// ============================================================
const OPENING_STORY = [
  '長きにわたり平和だったこの地に、ある日、恐ろしい噂が広まった。',
  '竜の洞窟の奥深くで、魔竜王ガロズが目覚めようとしている……と。',
  'そんな折、一人の若者がルミナ村にたどり着いた。',
  'それが、あなただ。',
  'まずは村の人々に聞き込みをしてみよう。長老が何か知っているかもしれない。',
];

// ============================================================
// マップに初めて足を踏み入れたときの一言 (簡単なナビ)
// ============================================================
const MAP_FIRST_VISIT_HINTS = {
  field: [
    'ここがリアーナ平原か……',
    '東の方が気になるな……フェルンの城下町を目指してみよう。',
  ],
  town2: [
    'ここがフェルンの城下町か。',
    'お城で王様に会ってみよう。',
  ],
  field2: [
    '森の奥に、何か重要なものがありそうだ……',
    '古代遺跡を探してみよう。',
  ],
  ruins: [
    '空気が重い……',
    '何か強大な気配を感じる。気をつけて進もう。',
  ],
  cave: [
    'ついに来た、竜の洞窟……',
    '魔竜王ガロズがこの奥で待っているはずだ。心してかかろう。',
  ],
  tower: [
    'この塔には尋常ではない気配が満ちている……',
    '試練が待ち受けているようだ。',
  ],
};

// ============================================================
// ショップ
// ============================================================
const SHOPS = {
  weapon: {
    name: 'マルコの武具屋',
    items: ['sword_iron', 'sword_steel', 'shield_leather', 'shield_iron', 'armor_leather', 'armor_iron', 'item_herb', 'item_water'],
  },
  weapon2: {
    name: 'フェルン武具店',
    items: ['sword_steel', 'sword_mythril', 'shield_iron', 'shield_mythril', 'armor_iron', 'armor_mythril', 'ring_power', 'pendant_guard'],
  },
  magic: {
    name: 'フェルン魔法店',
    items: ['item_herb', 'item_hi_herb', 'item_water', 'item_antidote', 'item_elixir', 'item_scroll', 'item_scroll_fire'],
  },
};

// ============================================================
// 装備品
// ============================================================
const EQUIPMENT = {
  sword_bronze: { id: 'sword_bronze', name: '青銅の剣', type: 'weapon', atk: 4, price: 0 },
  sword_iron: { id: 'sword_iron', name: '鉄の剣', type: 'weapon', atk: 9, price: 100 },
  sword_steel: { id: 'sword_steel', name: 'はがねの剣', type: 'weapon', atk: 16, price: 300 },
  sword_mythril: { id: 'sword_mythril', name: 'ミスリルの剣', type: 'weapon', atk: 24, price: 600 },
  sword_holy: { id: 'sword_holy', name: '光の聖剣', type: 'weapon', atk: 38, price: 0 },
  shield_leather: { id: 'shield_leather', name: '皮の盾', type: 'shield', def: 3, price: 40 },
  shield_iron: { id: 'shield_iron', name: '鉄の盾', type: 'shield', def: 7, price: 150 },
  shield_mythril: { id: 'shield_mythril', name: 'ミスリルの盾', type: 'shield', def: 12, price: 350 },
  armor_leather: { id: 'armor_leather', name: '皮の鎧', type: 'armor', def: 4, price: 50 },
  armor_iron: { id: 'armor_iron', name: '鉄の鎧', type: 'armor', def: 10, price: 200 },
  armor_mythril: { id: 'armor_mythril', name: 'ミスリルの鎧', type: 'armor', def: 18, price: 500 },
  ring_power: { id: 'ring_power', name: '力の指輪', type: 'accessory', atk: 6, price: 250 },
  pendant_guard: { id: 'pendant_guard', name: '守りのペンダント', type: 'accessory', def: 6, price: 220 },
  shield_aegis: { id: 'shield_aegis', name: '神盾イージス', type: 'shield', def: 20, price: 0 },
  armor_radiant: { id: 'armor_radiant', name: '光の鎧', type: 'armor', def: 26, price: 0 },
  sword_dawn: { id: 'sword_dawn', name: '暁光の剣', type: 'weapon', atk: 46, price: 0 },
  locket_memory: { id: 'locket_memory', name: '思い出のロケット', type: 'accessory', atk: 3, def: 3, price: 0 },
};

// ============================================================
// アイテム
// ============================================================
const ITEMS = {
  item_herb: {
    id: 'item_herb', name: 'やくそう', price: 8, usableInBattle: true, usableInField: true,
    effect(target) { const heal = 30; target.hp = Math.min(target.maxHp, target.hp + heal); return `${target.name}のHPが${heal}回復した！`; },
  },
  item_hi_herb: {
    id: 'item_hi_herb', name: '上級やくそう', price: 40, usableInBattle: true, usableInField: true,
    effect(target) { const heal = 70; target.hp = Math.min(target.maxHp, target.hp + heal); return `${target.name}のHPが${heal}回復した！`; },
  },
  item_water: {
    id: 'item_water', name: 'まほうの水', price: 15, usableInBattle: true, usableInField: true,
    effect(target) { const heal = 20; target.mp = Math.min(target.maxMp, target.mp + heal); return `${target.name}のMPが${heal}回復した！`; },
  },
  item_elixir: {
    id: 'item_elixir', name: 'エリクサー', price: 150, usableInBattle: true, usableInField: true,
    effect(target) { target.hp = target.maxHp; target.mp = target.maxMp; return `${target.name}のHPとMPが全回復した！`; },
  },
  item_antidote: {
    id: 'item_antidote', name: 'どくけしそう', price: 8, usableInBattle: true, usableInField: false, curesPoison: true,
  },
  item_scroll: {
    id: 'item_scroll', name: '帰還の巻物', price: 25, usableInBattle: false, usableInField: true,
    effect() { return '__WARP_TOWN__'; },
  },
  item_scroll_fire: {
    id: 'item_scroll_fire', name: 'メラの巻物', price: 20, usableInBattle: true, usableInField: false, targetsEnemy: true,
    effect(monster) {
      const dmg = Math.max(1, spellDamage(18) - Math.floor(monster.def * 0.3));
      monster.hp = Math.max(0, monster.hp - dmg);
      return `メラの巻物を使った！ ${monster.name}に${dmg}のダメージ！`;
    },
  },
};

// ============================================================
// 呪文
// ============================================================
const SPELLS = {
  heal: { id: 'heal', name: 'ヒール', mp: 3, learnLv: 3, kind: 'heal', power: 25, desc: 'HPを25前後回復する' },
  fire: { id: 'fire', name: 'ファイア', mp: 2, learnLv: 5, kind: 'attack', power: 16, element: 'fire', desc: '敵に炎のダメージ' },
  poison: { id: 'poison', name: 'ポイズン', mp: 4, learnLv: 6, kind: 'poison', desc: '敵を毒状態にする' },
  ice: { id: 'ice', name: 'アイス', mp: 3, learnLv: 7, kind: 'attack', power: 20, element: 'ice', desc: '敵に氷のダメージ' },
  sleep: { id: 'sleep', name: 'スリープ', mp: 4, learnLv: 8, kind: 'sleep', desc: '敵を眠らせる' },
  thunder: { id: 'thunder', name: 'サンダー', mp: 5, learnLv: 9, kind: 'attack', power: 26, element: 'thunder', desc: '敵に雷のダメージ' },
  highHeal: { id: 'highHeal', name: 'ハイヒール', mp: 8, learnLv: 10, kind: 'heal', power: 65, desc: 'HPを65前後回復する' },
  blaze: { id: 'blaze', name: 'ブレイズ', mp: 7, learnLv: 12, kind: 'attack', power: 34, element: 'fire', desc: '敵に大きな炎のダメージ' },
  holyLight: { id: 'holyLight', name: 'ホーリー', mp: 9, learnLv: 14, kind: 'attack', power: 42, element: 'holy', desc: '敵に聖なる大ダメージ' },
  exHeal: { id: 'exHeal', name: 'エクスヒール', mp: 14, learnLv: 16, kind: 'heal', power: 120, desc: 'HPを120前後回復する' },
};

// ============================================================
// モンスター
// ============================================================
const MONSTERS = {
  slime: { id: 'slime', name: 'スライム', hp: 10, atk: 6, def: 1, exp: 4, gold: 5, glyph: 'ス', color: '#5aa9e6', desc: 'ぷるぷるとした低級モンスター。攻撃力は低い。' },
  slime_fat: { id: 'slime_fat', name: 'デブスライム', hp: 17, atk: 8, def: 3, exp: 9, gold: 10, glyph: 'ス', color: '#3a7fc9', desc: 'ひとまわり大きいスライム。皮膚が厚く打たれ強い。' },
  wolf: { id: 'wolf', name: 'はぐれ狼', hp: 19, atk: 10, def: 3, exp: 11, gold: 9, glyph: '狼', color: '#8a7a6a', desc: '群れからはぐれた狼。牙による攻撃は鋭い。' },
  ghost: { id: 'ghost', name: 'ゴースト', hp: 23, atk: 13, def: 4, exp: 17, gold: 14, glyph: '霊', color: '#b18ae6', desc: '成仏できない霊。実体を持たずすり抜けるように動く。' },
  scorpion: { id: 'scorpion', name: 'さそり', hp: 27, atk: 15, def: 5, exp: 21, gold: 18, glyph: '蠍', color: '#e0a03a', poisonChance: 0.35, desc: '猛毒の針を持つ大サソリ。毒攻撃に注意。' },
  golem: { id: 'golem', name: 'ゴーレム', hp: 42, atk: 18, def: 10, exp: 42, gold: 35, glyph: '岩', color: '#7a7a7a', desc: '岩でできた巨体の番人。高い防御力を誇る。' },
  bat: { id: 'bat', name: 'こうもり', hp: 15, atk: 12, def: 3, exp: 13, gold: 11, glyph: '蝙', color: '#7a5a9a', desc: '洞窟や森に棲む大コウモリ。素早い動きで襲いかかる。' },
  thief: { id: 'thief', name: '盗賊', hp: 21, atk: 14, def: 4, exp: 16, gold: 22, glyph: '賊', color: '#9a7a4a', desc: '旅人を狙う盗賊。金品を狙って襲ってくる。' },
  skeleton: { id: 'skeleton', name: 'スケルトン', hp: 30, atk: 17, def: 6, exp: 26, gold: 20, glyph: '骨', color: '#d8d8c0', desc: '古代遺跡をさまよう骸骨の戦士。' },
  dark_knight: { id: 'dark_knight', name: '黒騎士', hp: 38, atk: 21, def: 9, exp: 36, gold: 30, glyph: '騎', color: '#3a3a4a', desc: '闇に堕ちた騎士。重厚な一撃を放つ。' },
  mimic: { id: 'mimic', name: 'ミミック', hp: 34, atk: 19, def: 6, exp: 32, gold: 45, glyph: '箱', color: '#c9a227', desc: '宝箱に擬態する魔物。油断すると牙をむく。' },
  guardian_stone: {
    id: 'guardian_stone', name: '石の番人ガーディアン', hp: 110, atk: 23, def: 14, exp: 150, gold: 100,
    glyph: '像', color: '#8a8a9a', boss: true, statusImmune: true,
    desc: '古代遺跡の最奥を守る石像の番人。あらゆる状態異常が効かない。',
  },
  dragon_king: {
    id: 'dragon_king', name: '魔竜王ガロズ', hp: 220, atk: 30, def: 12, exp: 0, gold: 0,
    glyph: '竜', color: '#d43a3a', boss: true, statusImmune: true, resist: { fire: 0.5 },
    desc: '竜の洞窟に封じられていた魔竜王。炎への耐性を持つ。',
  },
  tower_wraith: {
    id: 'tower_wraith', name: '塔の怨霊', hp: 45, atk: 24, def: 10, exp: 55, gold: 40,
    glyph: '幽', color: '#4a2a6a', poisonChance: 0.2, desc: '試練の塔に彷徨う怨霊。触れた者に毒を残す。',
  },
  iron_golem: {
    id: 'iron_golem', name: '鋼鉄の巨人', hp: 70, atk: 26, def: 16, exp: 70, gold: 55,
    glyph: '鉄', color: '#5a5a6a', desc: '塔の試練が生み出した鋼鉄の巨人。',
  },
  arcane_sentinel: {
    id: 'arcane_sentinel', name: '魔導番兵', hp: 50, atk: 29, def: 8, exp: 65, gold: 60,
    glyph: '番', color: '#8a3aa0', statusImmune: true, desc: '魔力で編まれた番人。状態異常を受け付けない。',
  },
  archmage_zenon: {
    id: 'archmage_zenon', name: '大魔導士ゼノン', hp: 300, atk: 34, def: 16, exp: 600, gold: 500,
    glyph: '導', color: '#6a2a8a', boss: true, statusImmune: true, resist: { thunder: 0.4 },
    desc: '試練の塔の最奥に君臨する大魔導士。雷への耐性を持つ。',
  },
};

if (typeof module !== 'undefined') {
  module.exports = {
    TILES, WALKABLE, ENCOUNTER_TILES, MAPS, WARPS, BARRIER_MAP, BARRIER_FLAG, CHESTS, SCRIPTED_ENCOUNTERS,
    NPCS, SHOPS, EQUIPMENT, ITEMS, SPELLS, MONSTERS, SIDE_QUESTS,
    OPENING_STORY, MAP_FIRST_VISIT_HINTS,
    townStage, townGridForStage, TOWN_GRIDS_BY_STAGE, TOWN_BG_COLORS, mainQuestStageText,
  };
}
