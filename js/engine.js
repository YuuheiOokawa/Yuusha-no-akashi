// ============================================================
// engine.js - キャンバス描画まわりの共通処理
// ============================================================

const TILE = 32;
const VIEW_COLS = 20;
const VIEW_ROWS = 15;
const CANVAS_W = TILE * VIEW_COLS;
const CANVAS_H = TILE * VIEW_ROWS;

let canvas, ctx;

function initEngine() {
  canvas = document.getElementById('gameCanvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
}

const TILE_COLORS = {
  [TILES.WALL]: '#2a2a3a',
  [TILES.GROUND]: '#3f8f4f',
  [TILES.WATER]: '#2f6fbf',
  [TILES.TREE]: '#1e5a2a',
  [TILES.FLOOR]: '#4a4658',
  [TILES.DOOR]: '#8a6a3a',
  [TILES.MOUNTAIN]: '#6b5c4a',
  [TILES.FLOWER]: '#3f8f4f',
  [TILES.STATUE]: '#5a5a6a',
};

function computeCamera(map, px, py) {
  const w = map.grid[0].length, h = map.grid.length;
  let camX = px - Math.floor(VIEW_COLS / 2);
  let camY = py - Math.floor(VIEW_ROWS / 2);
  camX = Math.max(0, Math.min(camX, Math.max(0, w - VIEW_COLS)));
  camY = Math.max(0, Math.min(camY, Math.max(0, h - VIEW_ROWS)));
  return { camX, camY };
}

function drawMap(map, camX, camY) {
  const grid = map.grid;
  ctx.fillStyle = map.bgColor || '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    const gy = camY + vy;
    if (gy < 0 || gy >= grid.length) continue;
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const gx = camX + vx;
      if (gx < 0 || gx >= grid[0].length) continue;
      const tile = grid[gy][gx];
      ctx.fillStyle = TILE_COLORS[tile] || '#000';
      ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
      if (tile === TILES.TREE) {
        ctx.fillStyle = '#164a20';
        ctx.beginPath();
        ctx.arc(vx * TILE + TILE / 2, vy * TILE + TILE / 2, TILE / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILES.WATER) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(vx * TILE + 4, vy * TILE + TILE / 2);
        ctx.lineTo(vx * TILE + TILE - 4, vy * TILE + TILE / 2);
        ctx.stroke();
      } else if (tile === TILES.DOOR) {
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(vx * TILE + 6, vy * TILE + 4, TILE - 12, TILE - 8);
      } else if (tile === TILES.MOUNTAIN) {
        ctx.fillStyle = '#8a7a68';
        ctx.beginPath();
        ctx.moveTo(vx * TILE + 4, vy * TILE + TILE - 4);
        ctx.lineTo(vx * TILE + TILE / 2, vy * TILE + 4);
        ctx.lineTo(vx * TILE + TILE - 4, vy * TILE + TILE - 4);
        ctx.closePath();
        ctx.fill();
      } else if (tile === TILES.FLOWER) {
        ctx.fillStyle = '#e07ab0';
        ctx.beginPath();
        ctx.arc(vx * TILE + TILE / 2, vy * TILE + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5e05a';
        ctx.beginPath();
        ctx.arc(vx * TILE + TILE / 2, vy * TILE + TILE / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILES.STATUE) {
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(vx * TILE + 10, vy * TILE + 8, TILE - 20, TILE - 12);
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(vx * TILE + 12, vy * TILE + 4, TILE - 24, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(vx * TILE + 10, vy * TILE + 8, TILE - 20, TILE - 12);
      }
    }
  }
}

function drawGlyphSprite(screenX, screenY, glyph, color, bob) {
  const cx = screenX + TILE / 2;
  const cy = screenY + TILE / 2 + (bob || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, screenY + TILE - 5, TILE / 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, TILE / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, cx, cy + 1);
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = '#0a1a4a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#0a1a4a';
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
}

function wrapJapanese(text, maxChars) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n' || cur.length >= maxChars) { lines.push(cur); cur = ch === '\n' ? '' : ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(x, y, text, opts) {
  opts = opts || {};
  ctx.fillStyle = opts.color || '#fff';
  ctx.font = (opts.font || '16px') + ' sans-serif';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

if (typeof module !== 'undefined') {
  module.exports = { wrapJapanese };
}
