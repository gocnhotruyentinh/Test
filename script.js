const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

// Đặt kích thước canvas bằng cửa sổ trình duyệt
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let particlesArray = [];
const emojis = ['😍', '', '❤️', '💻', '🌈', '🔥', '👽', ''];

// Vị trí chạm hiện tại (cho mobile)
const touch = {
    x: null,
    y: null,
    radius: 80 // Bán kính tương tác
};

// Xử lý sự kiện cảm ứng
canvas.addEventListener('touchstart', handleTouchStart, false);
canvas.addEventListener('touchmove', handleTouchMove, false);
canvas.addEventListener('touchend', handleTouchEnd, false);

function handleTouchStart(e) {
    e.preventDefault();
    const firstTouch = e.touches[0];
    touch.x = firstTouch.clientX;
    touch.y = firstTouch.clientY;
}

function handleTouchMove(e) {
    e.preventDefault();
    const firstTouch = e.touches[0];
    touch.x = firstTouch.clientX;
    touch.y = firstTouch.clientY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    touch.x = null;
    touch.y = null;
}

// Class Particle
class Particle {
    constructor(x, y) {
        this.x = Math.random() * canvas.width;        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.density = (Math.random() * 20) + 1;
        this.baseX = x;
        this.baseY = y;
        this.color = `hsl(${Math.random() * 60 + 280}, 100%, 70%)`; // Màu tím-hồng ngẫu nhiên
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    update() {
        // Nếu có chạm, tính lực đẩy
        if (touch.x !== null && touch.y !== null) {
            let dx = touch.x - this.x;
            let dy = touch.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < touch.radius) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (touch.radius - distance) / touch.radius;
                const directionX = forceDirectionX * force * this.density * 3;
                const directionY = forceDirectionY * force * this.density * 3;

                this.x -= directionX;
                this.y -= directionY;
            }
        }

        // Kéo về vị trí gốc
        if (this.x !== this.baseX) {
            let dx = this.x - this.baseX;
            this.x -= dx / 12;
        }
        if (this.y !== this.baseY) {
            let dy = this.y - this.baseY;
            this.y -= dy / 12;
        }
    }
}

// Khởi tạo hạt từ emoji
function init(emojiChar = '😍') {
    particlesArray = [];    
    // Vẽ emoji lên canvas để quét pixel
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.min(canvas.width, canvas.height) * 0.4}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiChar, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = 5; // Giảm mật độ hạt để mượt trên mobile

    for (let y = 0; y < imageData.height; y += step) {
        for (let x = 0; x < imageData.width; x += step) {
            const alpha = imageData.data[(y * 4 * imageData.width) + (x * 4) + 3];
            if (alpha > 128) {
                particlesArray.push(new Particle(x, y));
            }
        }
    }
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].draw();
        particlesArray[i].update();
    }
    requestAnimationFrame(animate);
}

// Gắn sự kiện cho nút emoji
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        init(emoji);
    });
});

// Nút reset
document.getElementById('resetBtn').addEventListener('click', () => {
    init(emojis[Math.floor(Math.random() * emojis.length)]);
});

// Bắt đầu với emoji mặc định
init();
animate();
