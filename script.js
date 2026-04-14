/* ═══════════════════════════════════════════════════════
   Animated Particle Emoji — script.js
   Kỹ thuật: vẽ emoji lên offscreen canvas → đọc màu từng
   pixel thật → gán màu đó cho hạt → hạt bay tới đúng vị trí
   ═══════════════════════════════════════════════════════ */

"use strict";

// ──────────────────────────────────────────────────────
// 1. CANVAS SETUP
// ──────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

const MAX_W = 720;
const MAX_H = 460;
let W, H;

function resize() {
  const vw  = Math.min(window.innerWidth  - 32, MAX_W);
  const vh  = Math.min(window.innerHeight * 0.54, MAX_H);
  W = canvas.width  = Math.floor(vw);
  H = canvas.height = Math.floor(vh);
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
/**
 * Vẽ emoji lên canvas ẩn, quét từng pixel,
 * trả về mảng { x, y, r, g, b } với toạ độ đã scale về canvas chính.
 */
function sampleEmojiPixels(emojiChar, targetCount) {
  const SIZE  = 300;               // kích thước canvas ẩn
  const oc    = document.createElement("canvas");
  oc.width = oc.height = SIZE;
  const octx  = oc.getContext("2d");

  // Vẽ emoji vào giữa canvas ẩn
  octx.clearRect(0, 0, SIZE, SIZE);
  octx.font          = `${SIZE * 0.8}px serif`;
  octx.textAlign     = "center";
  octx.textBaseline  = "middle";
  octx.fillText(emojiChar, SIZE / 2, SIZE / 2);

  const { data } = octx.getImageData(0, 0, SIZE, SIZE);

  // Thu thập tất cả pixel có alpha > 30
  const pixels = [];
  const STEP   = 2;                 // bước nhảy (càng nhỏ → càng nhiều điểm)
  for (let py = 0; py < SIZE; py += STEP) {
    for (let px = 0; px < SIZE; px += STEP) {
      const i = (py * SIZE + px) * 4;
      const a = data[i + 3];
      if (a < 30) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Đổi toạ độ → canvas chính (căn giữa, 80% diện tích)
      const cx = (px / SIZE) * W * 0.82 + W * 0.09;
      const cy = (py / SIZE) * H * 0.82 + H * 0.09;

      pixels.push({ x: cx, y: cy, r, g, b });
    }
  }

  if (pixels.length === 0) return [];

  // Lấy ngẫu nhiên `targetCount` điểm (có thể lặp)
  const result = [];
  for (let i = 0; i < targetCount; i++) {
    result.push(pixels[Math.floor(Math.random() * pixels.length)]);
  }
  return result;
}

// ──────────────────────────────────────────────────────
// 4. PARTICLE CLASS
// ──────────────────────────────────────────────────────
class Particle {
  constructor() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;

    // Màu tím nhạt mặc định khi trôi nổi
    this.r  = 160 + Math.random() * 60 | 0;
    this.g  = 60  + Math.random() * 40 | 0;
    this.b  = 220 + Math.random() * 35 | 0;

    this.tr = this.r; this.tg = this.g; this.tb = this.b;  // target colour
    this.tx = this.x; this.ty = this.y;                     // target position

    this.size    = Math.random() * 1.8 + 0.5;
    this.alpha   = Math.random() * 0.5 + 0.2;
    this.state   = "float";   // float | seek | hold | explode
    this.easeSpd = Math.random() * 0.05 + 0.03;
  }

  /* ── Berikan target posisi & warna dari pixel ── */
  setTarget(tx, ty, r, g, b) {
    this.tx = tx; this.ty = ty;
    this.tr = r;  this.tg = g;  this.tb = b;
    this.state   = "seek";
    this.easeSpd = Math.random() * 0.055 + 0.025;
  }

  /* ── Ledakan saat reset ── */
  blast() {
    this.state = "explode";
    const angle = Math.random() * Math.PI * 2;
    const spd   = Math.random() * 9 + 2;
    this.vx     = Math.cos(angle) * spd;
    this.vy     = Math.sin(angle) * spd - 4;
    this.alpha  = 1;
  }

  /* ── Tái sinh ── */
  respawn() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.r  = 130 + Math.random() * 80 | 0;
    this.g  = 40  + Math.random() * 60 | 0;
    this.b  = 200 + Math.random() * 55 | 0;
    this.alpha = Math.random() * 0.4 + 0.1;
    this.state = "float";
  }

  update() {
    switch (this.state) {

      case "float":
        this.x  += this.vx;
        this.y  += this.vy;
        this.vx += (Math.random() - 0.5) * 0.12;
        this.vy += (Math.random() - 0.5) * 0.12;
        this.vx  *= 0.985;
        this.vy  *= 0.985;
        if (this.x < 0 || this.x > W) this.vx *= -1;
        if (this.y < 0 || this.y > H) this.vy *= -1;
        break;

      case "seek": {
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        this.x += dx * this.easeSpd;
        this.y += dy * this.easeSpd;
        // Lerp màu
        this.r += (this.tr - this.r) * 0.08;
        this.g += (this.tg - this.g) * 0.08;
        this.b += (this.tb - this.b) * 0.08;
        this.alpha += (0.9 - this.alpha) * 0.06;
        if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) this.state = "hold";
        break;
      }

      case "hold":
        // Rung nhẹ quanh vị trí đích
        this.x += (this.tx - this.x) * 0.12 + (Math.random() - 0.5) * 0.4;
        this.y += (this.ty - this.y) * 0.12 + (Math.random() - 0.5) * 0.4;
        this.r += (this.tr - this.r) * 0.05;
        this.g += (this.tg - this.g) * 0.05;
        this.b += (this.tb - this.b) * 0.05;
        break;

      case "explode":
        this.x     += this.vx;
        this.y     += this.vy;
        this.vy    += 0.18;
        this.vx    *= 0.97;
        this.alpha -= 0.018;
        if (this.alpha <= 0) this.respawn();
        break;
    }
  }

  draw() {
    ctx.save();
    const alpha = Math.max(0, Math.min(1, this.alpha));
    ctx.globalAlpha = alpha;

    const color = `rgb(${this.r|0},${this.g|0},${this.b|0})`;
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 7;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ──────────────────────────────────────────────────────
// 5. PARTICLE POOL
// ──────────────────────────────────────────────────────
const NUM_PARTICLES = 2000;
const particles = Array.from({ length: NUM_PARTICLES }, () => new Particle());

// ──────────────────────────────────────────────────────
// 6. TRIGGER EMOJI
// ──────────────────────────────────────────────────────
let currentEmoji = null;

function triggerEmoji(emojiChar, silent = false) {
  currentEmoji = emojiChar;

  // Highlight active button
  if (!silent) {
    document.querySelectorAll(".emoji-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.emoji === emojiChar);
    });
  }

  // Sample pixel colours
  const pts = sampleEmojiPixels(emojiChar, NUM_PARTICLES);
  if (pts.length === 0) return;

  particles.forEach((p, i) => {
    const pt = pts[i % pts.length];
    // Thêm jitter nhỏ để tránh chồng chất
    const jx = pt.x + (Math.random() - 0.5) * 2.5;
    const jy = pt.y + (Math.random() - 0.5) * 2.5;
    p.setTarget(jx, jy, pt.r, pt.g, pt.b);
  });
}

// ──────────────────────────────────────────────────────
// 7. RESET
// ──────────────────────────────────────────────────────
function reset() {
  currentEmoji = null;
  document.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("active"));
  particles.forEach(p => p.blast());
}

// ──────────────────────────────────────────────────────
// 8. RENDER LOOP
// ──────────────────────────────────────────────────────
function render() {
  // Trail mờ để có hiệu ứng vệt sáng
  ctx.fillStyle = "rgba(6, 0, 16, 0.20)";
  ctx.fillRect(0, 0, W, H);

  for (const p of particles) {
    p.update();
    p.draw();
  }
  requestAnimationFrame(render);
}
render();

// ──────────────────────────────────────────────────────
// 9. EVENTS
// ──────────────────────────────────────────────────────
document.querySelectorAll(".emoji-btn").forEach(btn => {
  btn.addEventListener("click", () => triggerEmoji(btn.dataset.emoji));
});
document.getElementById("resetBtn").addEventListener("click", reset);

// Tự động kích hoạt emoji đầu tiên
setTimeout(() => triggerEmoji("🚀"), 300);
