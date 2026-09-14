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
      const px = vx * TILE, py = vy * TILE;
      ctx.fillStyle = TILE_COLORS[tile] || '#000';
      ctx.fillRect(px, py, TILE, TILE);

      if (tile === TILES.GROUND) {
        ctx.fillStyle = 'rgba(15,55,20,0.4)';
        const seed = (gx * 7 + gy * 13) % 5;
        if (seed === 0) ctx.fillRect(px + 6, py + 8, 3, 3);
        if (seed === 2) ctx.fillRect(px + 21, py + 18, 3, 3);
        if (seed === 4) ctx.fillRect(px + 12, py + 24, 3, 3);
      } else if (tile === TILES.TREE) {
        ctx.fillStyle = '#0d3416';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2 - 1, TILE / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e6a2c';
        ctx.beginPath();
        ctx.arc(px + TILE / 2 - 3, py + TILE / 2 - 5, TILE / 2 - 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px + TILE / 2 - 2, py + TILE - 9, 4, 6);
      } else if (tile === TILES.WATER) {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 4, py + TILE / 2 - 4);
        ctx.lineTo(px + TILE - 4, py + TILE / 2 - 4);
        ctx.moveTo(px + 4, py + TILE / 2 + 5);
        ctx.lineTo(px + TILE - 4, py + TILE / 2 + 5);
        ctx.stroke();
      } else if (tile === TILES.DOOR) {
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px + 6, py + 4, TILE - 12, TILE - 8);
        ctx.fillStyle = '#e0c060';
        ctx.fillRect(px + TILE / 2 + 5, py + TILE / 2 + 1, 2, 4);
      } else if (tile === TILES.MOUNTAIN) {
        ctx.fillStyle = '#8a7a68';
        ctx.beginPath();
        ctx.moveTo(px + 4, py + TILE - 4);
        ctx.lineTo(px + TILE / 2, py + 4);
        ctx.lineTo(px + TILE - 4, py + TILE - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d8d0ba';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py + 4);
        ctx.lineTo(px + TILE / 2 + 7, py + 15);
        ctx.lineTo(px + TILE / 2 - 7, py + 15);
        ctx.closePath();
        ctx.fill();
      } else if (tile === TILES.FLOWER) {
        ctx.fillStyle = '#e07ab0';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5e05a';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === TILES.STATUE) {
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(px + 10, py + 8, TILE - 20, TILE - 12);
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(px + 12, py + 4, TILE - 24, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 10, py + 8, TILE - 20, TILE - 12);
      } else if (tile === TILES.WALL) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + TILE / 2 + 0.5);
        ctx.lineTo(px + TILE, py + TILE / 2 + 0.5);
        ctx.moveTo(px + TILE / 4 + 0.5, py);
        ctx.lineTo(px + TILE / 4 + 0.5, py + TILE / 2);
        ctx.moveTo(px + (TILE * 3) / 4 + 0.5, py + TILE / 2);
        ctx.lineTo(px + (TILE * 3) / 4 + 0.5, py + TILE);
        ctx.stroke();
      } else if (tile === TILES.FLOOR && (gx + gy) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px, py, TILE, TILE);
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function lightenColor(hex, amt) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
  const num = parseInt(full, 16);
  const r = Math.min(255, Math.round(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amt));
  const g = Math.min(255, Math.round(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amt));
  const b = Math.min(255, Math.round((num & 255) + (255 - (num & 255)) * amt));
  return `rgb(${r},${g},${b})`;
}

function drawGlyphSprite(screenX, screenY, glyph, color, bob) {
  const cx = screenX + TILE / 2;
  const cy = screenY + TILE / 2 + (bob || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, screenY + TILE - 5, TILE / 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, TILE / 2);
  grad.addColorStop(0, lightenColor(color, 0.4));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, TILE / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = "bold 16px 'DotGothic16', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, cx, cy + 1);
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = '#f0ead8';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9c7a3c';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#101a66');
  grad.addColorStop(1, '#050830');
  ctx.fillStyle = grad;
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
  ctx.font = (opts.font || '16px') + " 'DotGothic16', sans-serif";
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

if (typeof module !== 'undefined') {
  module.exports = { wrapJapanese };
}
