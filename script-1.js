/* ═══════════════════════════════════════════════════════
   Animated Particle Emoji — script.js  (Performance Edition)

   Tối ưu hoá:
   ✓ Bỏ shadowBlur per-particle (nguyên nhân lag số 1)
   ✓ Viết thẳng pixel vào ImageData (nhanh hơn arc+fill ~10×)
   ✓ Glow additive blending — không cần blur API
   ✓ Float32Array / TypedArray (cache-friendly, ít GC)
   ✓ Loại bỏ ctx.save/restore, globalAlpha riêng từng hạt
   ✓ Trail bằng pixel multiply thay vì fillRect alpha
   ═══════════════════════════════════════════════════════ */

"use strict";

// ──────────────────────────────────────────────────────
// 1. CANVAS SETUP
// ──────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d", { alpha: false });

const MAX_W = 720, MAX_H = 460;
let W, H;

// Buffer canvas: vẽ hạt ở đây trước, rồi blit 1 lần ra màn hình
const bufCanvas = document.createElement("canvas");
const bufCtx    = bufCanvas.getContext("2d", { alpha: false });

function resize() {
  const vw = Math.min(window.innerWidth  - 32, MAX_W);
  const vh = Math.min(window.innerHeight * 0.54, MAX_H);
  W = canvas.width  = bufCanvas.width  = Math.floor(vw);
  H = canvas.height = bufCanvas.height = Math.floor(vh);
}
resize();
window.addEventListener("resize", () => {
  resize();
  if (currentEmoji) triggerEmoji(currentEmoji, true);
});

// ──────────────────────────────────────────────────────
// 2. BACKGROUND STARS (DOM)
// ──────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────
// 3. EMOJI → PIXEL COLOR SAMPLER
// ──────────────────────────────────────────────────────
function sampleEmojiPixels(emojiChar, targetCount) {
  const SIZE = 300;
  const oc   = document.createElement("canvas");
  oc.width = oc.height = SIZE;
  const octx = oc.getContext("2d");

  octx.clearRect(0, 0, SIZE, SIZE);
  octx.font         = `${SIZE * 0.8}px serif`;
  octx.textAlign    = "center";
  octx.textBaseline = "middle";
  octx.fillText(emojiChar, SIZE / 2, SIZE / 2);

  const { data } = octx.getImageData(0, 0, SIZE, SIZE);
  const pixels   = [];
  const STEP     = 2;

  for (let py = 0; py < SIZE; py += STEP) {
    for (let px = 0; px < SIZE; px += STEP) {
      const i = (py * SIZE + px) * 4;
      if (data[i + 3] < 30) continue;
      pixels.push({
        x: (px / SIZE) * W * 0.82 + W * 0.09,
        y: (py / SIZE) * H * 0.82 + H * 0.09,
        r: data[i], g: data[i + 1], b: data[i + 2]
      });
    }
  }

  if (!pixels.length) return [];
  const result = [];
  for (let i = 0; i < targetCount; i++)
    result.push(pixels[Math.floor(Math.random() * pixels.length)]);
  return result;
}

// ──────────────────────────────────────────────────────
// 4. PARTICLE DATA — Structure of Arrays (TypedArray)
//    Tránh object overhead, GC pressure, cache miss
// ──────────────────────────────────────────────────────
const N   = 2000;

const px_  = new Float32Array(N);  // vị trí
const py_  = new Float32Array(N);
const pvx  = new Float32Array(N);  // vận tốc
const pvy  = new Float32Array(N);

const pr_  = new Float32Array(N);  // màu hiện tại
const pg_  = new Float32Array(N);
const pb_  = new Float32Array(N);

const ptr  = new Float32Array(N);  // màu đích
const ptg  = new Float32Array(N);
const ptb  = new Float32Array(N);

const ptx  = new Float32Array(N);  // vị trí đích
const pty  = new Float32Array(N);

const palpha = new Float32Array(N);
const pease  = new Float32Array(N);
const psize  = new Uint8Array(N);   // 1 hoặc 2
const pstate = new Uint8Array(N);   // 0=float 1=seek 2=hold 3=explode

function initParticle(i) {
  px_[i] = Math.random() * W;
  py_[i] = Math.random() * H;
  pvx[i] = (Math.random() - 0.5) * 3;
  pvy[i] = (Math.random() - 0.5) * 3;
  pr_[i] = ptr[i] = 120 + Math.random() * 90;
  pg_[i] = ptg[i] = 30  + Math.random() * 60;
  pb_[i] = ptb[i] = 190 + Math.random() * 65;
  ptx[i] = px_[i]; pty[i] = py_[i];
  palpha[i] = Math.random() * 0.5 + 0.15;
  psize[i]  = Math.random() < 0.45 ? 1 : 2;
  pease[i]  = Math.random() * 0.05 + 0.025;
  pstate[i] = 0;
}

for (let i = 0; i < N; i++) initParticle(i);

// ──────────────────────────────────────────────────────
// 5. UPDATE — thuần arithmetic, không gọi canvas API
// ──────────────────────────────────────────────────────
function updateAll() {
  for (let i = 0; i < N; i++) {
    const st = pstate[i];

    if (st === 0) {                          // FLOAT
      px_[i] += pvx[i];
      py_[i] += pvy[i];
      pvx[i] += (Math.random() - 0.5) * 0.12;
      pvy[i] += (Math.random() - 0.5) * 0.12;
      pvx[i] *= 0.985;
      pvy[i] *= 0.985;
      if (px_[i] < 0 || px_[i] > W) pvx[i] *= -1;
      if (py_[i] < 0 || py_[i] > H) pvy[i] *= -1;

    } else if (st === 1) {                   // SEEK
      const dx = ptx[i] - px_[i];
      const dy = pty[i] - py_[i];
      const e  = pease[i];
      px_[i] += dx * e;
      py_[i] += dy * e;
      pr_[i] += (ptr[i] - pr_[i]) * 0.09;
      pg_[i] += (ptg[i] - pg_[i]) * 0.09;
      pb_[i] += (ptb[i] - pb_[i]) * 0.09;
      palpha[i] += (0.92 - palpha[i]) * 0.06;
      if (dx * dx + dy * dy < 2) pstate[i] = 2;

    } else if (st === 2) {                   // HOLD
      px_[i] += (ptx[i] - px_[i]) * 0.12 + (Math.random() - 0.5) * 0.4;
      py_[i] += (pty[i] - py_[i]) * 0.12 + (Math.random() - 0.5) * 0.4;
      pr_[i] += (ptr[i] - pr_[i]) * 0.05;
      pg_[i] += (ptg[i] - pg_[i]) * 0.05;
      pb_[i] += (ptb[i] - pb_[i]) * 0.05;

    } else {                                 // EXPLODE (st === 3)
      px_[i] += pvx[i];
      py_[i] += pvy[i];
      pvy[i] += 0.18;
      pvx[i] *= 0.97;
      palpha[i] -= 0.018;
      if (palpha[i] <= 0) initParticle(i);
    }
  }
}

// ──────────────────────────────────────────────────────
// 6. DRAW — viết thẳng vào ImageData, không shadowBlur
//    Trail: multiply pixel × 0.80 mỗi frame
//    Glow:  additive blend (cộng RGB, clamp 255)
//    Size 2: trung tâm + 4 pixel láng giềng với half-bright
// ──────────────────────────────────────────────────────
function drawAll() {
  const imgData = bufCtx.getImageData(0, 0, W, H);
  const d = imgData.data;

  // ── Trail fade (thay fillRect alpha) ──
  for (let j = 0; j < d.length; j += 4) {
    d[j]     = d[j]     * 0.80 | 0;
    d[j + 1] = d[j + 1] * 0.80 | 0;
    d[j + 2] = d[j + 2] * 0.80 | 0;
    d[j + 3] = 255;
  }

  // ── Vẽ hạt bằng additive blend ──
  for (let i = 0; i < N; i++) {
    const xi = px_[i] | 0;
    const yi = py_[i] | 0;
    if (xi < 1 || xi >= W - 1 || yi < 1 || yi >= H - 1) continue;

    const a  = palpha[i];
    const r  = pr_[i] * a | 0;
    const g  = pg_[i] * a | 0;
    const b  = pb_[i] * a | 0;

    if (psize[i] === 1) {
      const idx = (yi * W + xi) * 4;
      d[idx]     = Math.min(255, d[idx]     + r);
      d[idx + 1] = Math.min(255, d[idx + 1] + g);
      d[idx + 2] = Math.min(255, d[idx + 2] + b);
    } else {
      // Trung tâm sáng full + 4 hướng half = glow nhẹ, không cần blur API
      const hr = r >> 1, hg = g >> 1, hb = b >> 1;

      let idx = (yi * W + xi) * 4;
      d[idx]     = Math.min(255, d[idx]     + r);
      d[idx + 1] = Math.min(255, d[idx + 1] + g);
      d[idx + 2] = Math.min(255, d[idx + 2] + b);

      idx = ((yi - 1) * W + xi) * 4;
      d[idx]     = Math.min(255, d[idx]     + hr);
      d[idx + 1] = Math.min(255, d[idx + 1] + hg);
      d[idx + 2] = Math.min(255, d[idx + 2] + hb);

      idx = ((yi + 1) * W + xi) * 4;
      d[idx]     = Math.min(255, d[idx]     + hr);
      d[idx + 1] = Math.min(255, d[idx + 1] + hg);
      d[idx + 2] = Math.min(255, d[idx + 2] + hb);

      idx = (yi * W + (xi - 1)) * 4;
      d[idx]     = Math.min(255, d[idx]     + hr);
      d[idx + 1] = Math.min(255, d[idx + 1] + hg);
      d[idx + 2] = Math.min(255, d[idx + 2] + hb);

      idx = (yi * W + (xi + 1)) * 4;
      d[idx]     = Math.min(255, d[idx]     + hr);
      d[idx + 1] = Math.min(255, d[idx + 1] + hg);
      d[idx + 2] = Math.min(255, d[idx + 2] + hb);
    }
  }

  bufCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(bufCanvas, 0, 0);  // 1 draw call duy nhất ra màn hình
}

// ──────────────────────────────────────────────────────
// 7. TRIGGER EMOJI
// ──────────────────────────────────────────────────────
let currentEmoji = null;

function triggerEmoji(emojiChar, silent = false) {
  currentEmoji = emojiChar;

  if (!silent) {
    document.querySelectorAll(".emoji-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.emoji === emojiChar);
    });
  }

  const pts = sampleEmojiPixels(emojiChar, N);
  if (!pts.length) return;

  for (let i = 0; i < N; i++) {
    const pt  = pts[i % pts.length];
    ptx[i]    = pt.x + (Math.random() - 0.5) * 2.5;
    pty[i]    = pt.y + (Math.random() - 0.5) * 2.5;
    ptr[i]    = pt.r;
    ptg[i]    = pt.g;
    ptb[i]    = pt.b;
    pstate[i] = 1;
    pease[i]  = Math.random() * 0.055 + 0.025;
  }
}

// ──────────────────────────────────────────────────────
// 8. RESET
// ──────────────────────────────────────────────────────
function reset() {
  currentEmoji = null;
  document.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("active"));
  for (let i = 0; i < N; i++) {
    pstate[i] = 3;
    const angle = Math.random() * Math.PI * 2;
    const spd   = Math.random() * 9 + 2;
    pvx[i]    = Math.cos(angle) * spd;
    pvy[i]    = Math.sin(angle) * spd - 4;
    palpha[i] = 1;
  }
}

// ──────────────────────────────────────────────────────
// 9. RENDER LOOP
// ──────────────────────────────────────────────────────
function render() {
  updateAll();
  drawAll();
  requestAnimationFrame(render);
}
render();

// ──────────────────────────────────────────────────────
// 10. EVENTS
// ──────────────────────────────────────────────────────
document.querySelectorAll(".emoji-btn").forEach(btn => {
  btn.addEventListener("click", () => triggerEmoji(btn.dataset.emoji));
});
document.getElementById("resetBtn").addEventListener("click", reset);

setTimeout(() => triggerEmoji("🚀"), 300);
