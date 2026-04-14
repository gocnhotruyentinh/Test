/* ═══════════════════════════════════════════════════════
   Animated Particle Emoji — script.js  (v3 Fixed Color + Dense)
   ✓ Màu đúng từ pixel emoji (không bị trắng)
   ✓ 4000 hạt, dày đặc hơn
   ✓ Glow nhẹ không làm mất màu
   ✓ TypedArray cache-friendly, không shadowBlur
   ═══════════════════════════════════════════════════════ */
"use strict";

// ── 1. CANVAS ──────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d", { alpha: false });

const MAX_W = 720, MAX_H = 460;
let W, H;

function resize() {
  const vw = Math.min(window.innerWidth  - 32, MAX_W);
  const vh = Math.min(window.innerHeight * 0.54, MAX_H);
  W = canvas.width  = Math.floor(vw);
  H = canvas.height = Math.floor(vh);
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
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%; top:${Math.random()*100}%;
      --d:${(Math.random()*4+2).toFixed(1)}s;
      --delay:${(Math.random()*6).toFixed(1)}s;
      --op:${(Math.random()*0.5+0.2).toFixed(2)};
    `;
    container.appendChild(s);
  }
})();

// ── 3. EMOJI PIXEL SAMPLER ─────────────────────────────
// Trả về mảng {x, y, r, g, b} toạ độ thật trên canvas chính
function sampleEmojiPixels(emojiChar, targetCount) {
  const SIZE = 400;
  const oc   = document.createElement("canvas");
  oc.width = oc.height = SIZE;
  const octx = oc.getContext("2d");

  octx.clearRect(0, 0, SIZE, SIZE);
  octx.font         = `${SIZE * 0.78}px serif`;
  octx.textAlign    = "center";
  octx.textBaseline = "middle";
  octx.fillText(emojiChar, SIZE / 2, SIZE / 2);

  const { data } = octx.getImageData(0, 0, SIZE, SIZE);
  const pixels   = [];
  // STEP nhỏ hơn = lấy nhiều điểm hơn = hình dày hơn
  const STEP = 1;

  for (let py = 0; py < SIZE; py += STEP) {
    for (let px = 0; px < SIZE; px += STEP) {
      const i = (py * SIZE + px) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      // Scale toạ độ về canvas chính, canh giữa
      const margin = 0.10;
      pixels.push({
        x: (px / SIZE) * W * (1 - margin * 2) + W * margin,
        y: (py / SIZE) * H * (1 - margin * 2) + H * margin,
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        a: a / 255
      });
    }
  }

  if (!pixels.length) return [];
  const result = [];
  for (let i = 0; i < targetCount; i++)
    result.push(pixels[Math.floor(Math.random() * pixels.length)]);
  return result;
}

// ── 4. PARTICLE DATA (Structure of Arrays) ─────────────
const N = 4000;  // tăng lên 4000 hạt

const pX  = new Float32Array(N);
const pY  = new Float32Array(N);
const pVX = new Float32Array(N);
const pVY = new Float32Array(N);

// Màu hiện tại (float 0-255)
const pR  = new Float32Array(N);
const pG  = new Float32Array(N);
const pB  = new Float32Array(N);

// Màu đích
const tR  = new Float32Array(N);
const tG  = new Float32Array(N);
const tB  = new Float32Array(N);

// Vị trí đích
const tX  = new Float32Array(N);
const tY  = new Float32Array(N);

const pAlpha = new Float32Array(N);
const pEase  = new Float32Array(N);
const pSize  = new Uint8Array(N);   // 1 hoặc 2
const pState = new Uint8Array(N);   // 0=float 1=seek 2=hold 3=explode

function initParticle(i) {
  pX[i] = Math.random() * W;
  pY[i] = Math.random() * H;
  pVX[i] = (Math.random() - 0.5) * 3;
  pVY[i] = (Math.random() - 0.5) * 3;
  // Màu tím/xanh khi float
  pR[i] = tR[i] = 100 + Math.random() * 80;
  pG[i] = tG[i] = 20  + Math.random() * 50;
  pB[i] = tB[i] = 180 + Math.random() * 75;
  tX[i] = pX[i]; tY[i] = pY[i];
  pAlpha[i] = Math.random() * 0.55 + 0.15;
  pSize[i]  = Math.random() < 0.4 ? 1 : 2;
  pEase[i]  = Math.random() * 0.05 + 0.025;
  pState[i] = 0;
}

for (let i = 0; i < N; i++) initParticle(i);

// ── 5. UPDATE ──────────────────────────────────────────
function updateAll() {
  for (let i = 0; i < N; i++) {
    const st = pState[i];

    if (st === 0) {                     // FLOAT
      pX[i] += pVX[i];
      pY[i] += pVY[i];
      pVX[i] += (Math.random() - 0.5) * 0.12;
      pVY[i] += (Math.random() - 0.5) * 0.12;
      pVX[i] *= 0.985;
      pVY[i] *= 0.985;
      if (pX[i] < 0 || pX[i] > W) pVX[i] *= -1;
      if (pY[i] < 0 || pY[i] > H) pVY[i] *= -1;

    } else if (st === 1) {              // SEEK
      const dx = tX[i] - pX[i];
      const dy = tY[i] - pY[i];
      const e  = pEase[i];
      pX[i] += dx * e;
      pY[i] += dy * e;
      // Lerp màu về đúng màu pixel emoji
      pR[i] += (tR[i] - pR[i]) * 0.10;
      pG[i] += (tG[i] - pG[i]) * 0.10;
      pB[i] += (tB[i] - pB[i]) * 0.10;
      pAlpha[i] += (0.95 - pAlpha[i]) * 0.07;
      if (dx * dx + dy * dy < 1.5) pState[i] = 2;

    } else if (st === 2) {              // HOLD
      pX[i] += (tX[i] - pX[i]) * 0.12 + (Math.random() - 0.5) * 0.35;
      pY[i] += (tY[i] - pY[i]) * 0.12 + (Math.random() - 0.5) * 0.35;
      pR[i] += (tR[i] - pR[i]) * 0.05;
      pG[i] += (tG[i] - pG[i]) * 0.05;
      pB[i] += (tB[i] - pB[i]) * 0.05;

    } else {                            // EXPLODE
      pX[i] += pVX[i];
      pY[i] += pVY[i];
      pVY[i] += 0.18;
      pVX[i] *= 0.97;
      pAlpha[i] -= 0.017;
      if (pAlpha[i] <= 0) initParticle(i);
    }
  }
}

// ── 6. DRAW — ImageData với màu đúng ──────────────────
// KHÔNG dùng additive blend (gây trắng) mà dùng alpha blend đúng cách:
// dst = src * alpha + dst * (1 - alpha)
// Giữ màu emoji, chỉ glow nhẹ bằng hàng xóm 50%

let pixelBuf = null;  // reuse ImageData

function drawAll() {
  // Lấy ImageData hiện tại
  if (!pixelBuf || pixelBuf.width !== W || pixelBuf.height !== H) {
    pixelBuf = ctx.createImageData(W, H);
    // Fill nền đen lần đầu
    const d = pixelBuf.data;
    for (let j = 3; j < d.length; j += 4) d[j] = 255;
  }

  const d = pixelBuf.data;

  // Trail fade: nhân với 0.82 → màu phai dần tạo vệt
  for (let j = 0; j < d.length; j += 4) {
    d[j]     = d[j]     * 0.82 | 0;
    d[j + 1] = d[j + 1] * 0.82 | 0;
    d[j + 2] = d[j + 2] * 0.82 | 0;
    d[j + 3] = 255;
  }

  // Vẽ từng hạt bằng alpha blend thật → màu giữ đúng
  for (let i = 0; i < N; i++) {
    const xi = pX[i] | 0;
    const yi = pY[i] | 0;
    if (xi < 1 || xi >= W - 1 || yi < 1 || yi >= H - 1) continue;

    const a  = pAlpha[i];          // 0..1
    const ia = 1 - a;              // inverse alpha
    const r  = pR[i] | 0;
    const g  = pG[i] | 0;
    const b  = pB[i] | 0;

    // Tâm hạt — alpha blend giữ màu đúng
    const ci = (yi * W + xi) * 4;
    d[ci]     = (r * a + d[ci]     * ia) | 0;
    d[ci + 1] = (g * a + d[ci + 1] * ia) | 0;
    d[ci + 2] = (b * a + d[ci + 2] * ia) | 0;

    if (pSize[i] === 2) {
      // Hàng xóm với alpha nhỏ hơn → glow nhẹ, không mất màu
      const ha = a * 0.45;
      const hia = 1 - ha;
      const hr = r, hg = g, hb = b;

      let ni = ((yi - 1) * W + xi) * 4;
      d[ni]     = (hr * ha + d[ni]     * hia) | 0;
      d[ni + 1] = (hg * ha + d[ni + 1] * hia) | 0;
      d[ni + 2] = (hb * ha + d[ni + 2] * hia) | 0;

      ni = ((yi + 1) * W + xi) * 4;
      d[ni]     = (hr * ha + d[ni]     * hia) | 0;
      d[ni + 1] = (hg * ha + d[ni + 1] * hia) | 0;
      d[ni + 2] = (hb * ha + d[ni + 2] * hia) | 0;

      ni = (yi * W + (xi - 1)) * 4;
      d[ni]     = (hr * ha + d[ni]     * hia) | 0;
      d[ni + 1] = (hg * ha + d[ni + 1] * hia) | 0;
      d[ni + 2] = (hb * ha + d[ni + 2] * hia) | 0;

      ni = (yi * W + (xi + 1)) * 4;
      d[ni]     = (hr * ha + d[ni]     * hia) | 0;
      d[ni + 1] = (hg * ha + d[ni + 1] * hia) | 0;
      d[ni + 2] = (hb * ha + d[ni + 2] * hia) | 0;
    }
  }

  ctx.putImageData(pixelBuf, 0, 0);
}

// ── 7. TRIGGER EMOJI ───────────────────────────────────
let currentEmoji = null;

function triggerEmoji(emojiChar, silent = false) {
  currentEmoji = emojiChar;
  if (!silent) {
    document.querySelectorAll(".emoji-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.emoji === emojiChar)
    );
  }
  const pts = sampleEmojiPixels(emojiChar, N);
  if (!pts.length) return;

  for (let i = 0; i < N; i++) {
    const pt  = pts[i % pts.length];
    tX[i]     = pt.x + (Math.random() - 0.5) * 2;
    tY[i]     = pt.y + (Math.random() - 0.5) * 2;
    // Màu đích = màu thật của pixel emoji
    tR[i]     = pt.r;
    tG[i]     = pt.g;
    tB[i]     = pt.b;
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
    const angle   = Math.random() * Math.PI * 2;
    const spd     = Math.random() * 10 + 2;
    pVX[i]    = Math.cos(angle) * spd;
    pVY[i]    = Math.sin(angle) * spd - 4;
    pAlpha[i] = 1;
  }
}

// ── 9. RENDER LOOP ─────────────────────────────────────
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
