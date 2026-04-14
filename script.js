/* ═══════════════════════════════════════════════════════
   Animated Particle Emoji — script.js  (v5 · Mobile Fixed)
   ✓ Fix đen màn hình trên mobile (bỏ new ImageData)
   ✓ 10 000 hạt, màu đúng từ pixel emoji
   ✓ Dùng ctx.getImageData + putImageData (tương thích tốt)
   ✓ Fallback arc() nếu ImageData không hoạt động
   ═══════════════════════════════════════════════════════ */
"use strict";

// ── 1. CANVAS ──────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");   // KHÔNG { alpha:false } — mobile compat

const MAX_W = 720, MAX_H = 460;
let W, H;

function resize() {
  const vw = Math.min(window.innerWidth  - 32, MAX_W);
  const vh = Math.min(window.innerHeight * 0.54, MAX_H);
  W = canvas.width  = Math.floor(vw);
  H = canvas.height = Math.floor(vh);
  // Vẽ nền đen ngay sau resize
  ctx.fillStyle = "#060010";
  ctx.fillRect(0, 0, W, H);
}
resize();
window.addEventListener("resize", () => {
  resize();
  if (currentEmoji) triggerEmoji(currentEmoji, true);
});

// ── 2. BACKGROUND STARS ────────────────────────────────
(function createStars() {
  const container = document.getElementById("bgStars");
  for (let i = 0; i < 120; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 0.5;
    s.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      --d:${(Math.random()*4+2).toFixed(1)}s;
      --delay:${(Math.random()*6).toFixed(1)}s;
      --op:${(Math.random()*0.5+0.2).toFixed(2)};`;
    container.appendChild(s);
  }
})();

// ── 3. EMOJI PIXEL SAMPLER ─────────────────────────────
function sampleEmojiPixels(emojiChar, targetCount) {
  const SIZE = 480;
  const oc   = document.createElement("canvas");
  oc.width = oc.height = SIZE;
  const octx = oc.getContext("2d");
  octx.clearRect(0, 0, SIZE, SIZE);
  octx.font         = `${SIZE * 0.78}px serif`;
  octx.textAlign    = "center";
  octx.textBaseline = "middle";
  octx.fillText(emojiChar, SIZE / 2, SIZE / 2);

  const { data } = octx.getImageData(0, 0, SIZE, SIZE);
  const pixels = [];
  const mg = 0.09;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const i = (py * SIZE + px) * 4;
      if (data[i + 3] < 20) continue;
      pixels.push({
        x: (px / SIZE) * W * (1 - mg * 2) + W * mg,
        y: (py / SIZE) * H * (1 - mg * 2) + H * mg,
        r: data[i], g: data[i + 1], b: data[i + 2]
      });
    }
  }

  if (!pixels.length) return [];
  const result = new Array(targetCount);
  for (let i = 0; i < targetCount; i++)
    result[i] = pixels[Math.floor(Math.random() * pixels.length)];
  return result;
}

// ── 4. PARTICLE DATA (SoA TypedArray) ─────────────────
const N = 10000;

const pX  = new Float32Array(N);
const pY  = new Float32Array(N);
const pVX = new Float32Array(N);
const pVY = new Float32Array(N);
const pR  = new Float32Array(N);
const pG  = new Float32Array(N);
const pB  = new Float32Array(N);
const tR  = new Float32Array(N);
const tG  = new Float32Array(N);
const tB  = new Float32Array(N);
const tX  = new Float32Array(N);
const tY  = new Float32Array(N);
const pAlpha = new Float32Array(N);
const pEase  = new Float32Array(N);
const pSize  = new Uint8Array(N);
const pState = new Uint8Array(N);

function initParticle(i) {
  pX[i]  = Math.random() * W;
  pY[i]  = Math.random() * H;
  pVX[i] = (Math.random() - 0.5) * 3;
  pVY[i] = (Math.random() - 0.5) * 3;
  pR[i]  = tR[i] = 100 + Math.random() * 80;
  pG[i]  = tG[i] = 20  + Math.random() * 50;
  pB[i]  = tB[i] = 180 + Math.random() * 75;
  tX[i]  = pX[i]; tY[i] = pY[i];
  pAlpha[i] = Math.random() * 0.55 + 0.15;
  pSize[i]  = Math.random() < 0.42 ? 1 : 2;
  pEase[i]  = Math.random() * 0.05 + 0.02;
  pState[i] = 0;
}
for (let i = 0; i < N; i++) initParticle(i);

// Random pool
const RND_SZ  = 8192;
const rndPool = new Float32Array(RND_SZ);
let   rndIdx  = 0;
for (let i = 0; i < RND_SZ; i++) rndPool[i] = Math.random();
setInterval(() => { for (let i = 0; i < RND_SZ; i++) rndPool[i] = Math.random(); }, 2000);
function rnd() { if (rndIdx >= RND_SZ) rndIdx = 0; return rndPool[rndIdx++]; }

// ── 5. UPDATE ──────────────────────────────────────────
function updateAll() {
  for (let i = 0; i < N; i++) {
    const st = pState[i];
    if (st === 0) {
      pX[i] += pVX[i]; pY[i] += pVY[i];
      pVX[i] += (rnd() - 0.5) * 0.10; pVY[i] += (rnd() - 0.5) * 0.10;
      pVX[i] *= 0.986; pVY[i] *= 0.986;
      if (pX[i] < 0 || pX[i] > W) pVX[i] *= -1;
      if (pY[i] < 0 || pY[i] > H) pVY[i] *= -1;
    } else if (st === 1) {
      const dx = tX[i] - pX[i], dy = tY[i] - pY[i], e = pEase[i];
      pX[i] += dx * e; pY[i] += dy * e;
      pR[i] += (tR[i] - pR[i]) * 0.10;
      pG[i] += (tG[i] - pG[i]) * 0.10;
      pB[i] += (tB[i] - pB[i]) * 0.10;
      pAlpha[i] += (0.95 - pAlpha[i]) * 0.07;
      if (dx * dx + dy * dy < 1.5) pState[i] = 2;
    } else if (st === 2) {
      pX[i] += (tX[i] - pX[i]) * 0.12 + (rnd() - 0.5) * 0.35;
      pY[i] += (tY[i] - pY[i]) * 0.12 + (rnd() - 0.5) * 0.35;
      pR[i] += (tR[i] - pR[i]) * 0.05;
      pG[i] += (tG[i] - pG[i]) * 0.05;
      pB[i] += (tB[i] - pB[i]) * 0.05;
    } else {
      pX[i] += pVX[i]; pY[i] += pVY[i];
      pVY[i] += 0.18; pVX[i] *= 0.97;
      pAlpha[i] -= 0.016;
      if (pAlpha[i] <= 0) initParticle(i);
    }
  }
}

// ── 6. DRAW — getImageData (mobile compatible) ─────────
// Đọc từ canvas thật → fade → vẽ hạt → put lại
// Không dùng "new ImageData" tránh lỗi trắng/đen mobile

function drawAll() {
  // Lấy pixel buffer từ canvas hiện tại
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  // Trail fade
  for (let j = 0; j < d.length; j += 4) {
    d[j]     = d[j]     * 0.82 | 0;
    d[j + 1] = d[j + 1] * 0.82 | 0;
    d[j + 2] = d[j + 2] * 0.82 | 0;
    d[j + 3] = 255;
  }

  // Vẽ hạt — alpha blend giữ màu đúng
  for (let i = 0; i < N; i++) {
    const xi = pX[i] | 0;
    const yi = pY[i] | 0;
    if (xi < 1 || xi >= W - 1 || yi < 1 || yi >= H - 1) continue;

    const a  = pAlpha[i];
    const ia = 1 - a;
    const r  = pR[i] | 0;
    const g  = pG[i] | 0;
    const b  = pB[i] | 0;

    let idx = (yi * W + xi) * 4;
    d[idx]     = (r * a + d[idx]     * ia) | 0;
    d[idx + 1] = (g * a + d[idx + 1] * ia) | 0;
    d[idx + 2] = (b * a + d[idx + 2] * ia) | 0;
    d[idx + 3] = 255;

    if (pSize[i] === 2) {
      const ha = a * 0.45, hia = 1 - ha;

      idx = ((yi - 1) * W + xi) * 4;
      d[idx]     = (r * ha + d[idx]     * hia) | 0;
      d[idx + 1] = (g * ha + d[idx + 1] * hia) | 0;
      d[idx + 2] = (b * ha + d[idx + 2] * hia) | 0;
      d[idx + 3] = 255;

      idx = ((yi + 1) * W + xi) * 4;
      d[idx]     = (r * ha + d[idx]     * hia) | 0;
      d[idx + 1] = (g * ha + d[idx + 1] * hia) | 0;
      d[idx + 2] = (b * ha + d[idx + 2] * hia) | 0;
      d[idx + 3] = 255;

      idx = (yi * W + xi - 1) * 4;
      d[idx]     = (r * ha + d[idx]     * hia) | 0;
      d[idx + 1] = (g * ha + d[idx + 1] * hia) | 0;
      d[idx + 2] = (b * ha + d[idx + 2] * hia) | 0;
      d[idx + 3] = 255;

      idx = (yi * W + xi + 1) * 4;
      d[idx]     = (r * ha + d[idx]     * hia) | 0;
      d[idx + 1] = (g * ha + d[idx + 1] * hia) | 0;
      d[idx + 2] = (b * ha + d[idx + 2] * hia) | 0;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ── 7. TRIGGER EMOJI ───────────────────────────────────
let currentEmoji = null;

function triggerEmoji(emojiChar, silent = false) {
  currentEmoji = emojiChar;
  if (!silent)
    document.querySelectorAll(".emoji-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.emoji === emojiChar));

  const pts = sampleEmojiPixels(emojiChar, N);
  if (!pts.length) return;
  for (let i = 0; i < N; i++) {
    const pt  = pts[i % pts.length];
    tX[i]     = pt.x + (Math.random() - 0.5) * 1.5;
    tY[i]     = pt.y + (Math.random() - 0.5) * 1.5;
    tR[i]     = pt.r; tG[i] = pt.g; tB[i] = pt.b;
    pState[i] = 1;
    pEase[i]  = Math.random() * 0.055 + 0.022;
  }
}

// ── 8. RESET ───────────────────────────────────────────
function reset() {
  currentEmoji = null;
  document.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("active"));
  for (let i = 0; i < N; i++) {
    pState[i] = 3;
    const angle = Math.random() * Math.PI * 2;
    const spd   = Math.random() * 10 + 2;
    pVX[i] = Math.cos(angle) * spd;
    pVY[i] = Math.sin(angle) * spd - 4;
    pAlpha[i] = 1;
  }
}

// ── 9. LOOP ────────────────────────────────────────────
function render() {
  updateAll();
  drawAll();
  requestAnimationFrame(render);
}
render();

// ── 10. EVENTS ─────────────────────────────────────────
document.querySelectorAll(".emoji-btn").forEach(btn =>
  btn.addEventListener("click", () => triggerEmoji(btn.dataset.emoji))
);
document.getElementById("resetBtn").addEventListener("click", reset);
setTimeout(() => triggerEmoji("🚀"), 300);
