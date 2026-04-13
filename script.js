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
const emojis = ['😍', '', '❤️', '💻', '', '🔥', '👽', ''];

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
    constructor(x, y, color) {
        this.x = Math.random() * canvas.width;        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 2; // Tăng kích thước hạt: 2-5px
        this.density = (Math.random() * 20) + 1;
        this.baseX = x;
        this.baseY = y;
        this.color = color; // Màu lấy từ pixel emoji
        this.shadowColor = color.replace(')', ', 0.3)').replace('rgb', 'rgba'); // Thêm bóng mờ
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        // Vẽ bóng nhẹ để nổi bật
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.shadowColor;
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
        // Tắt shadow sau khi vẽ xong để không ảnh hưởng hiệu năng
        ctx.shadowBlur = 0;
    }
}

// Khởi tạo hạt từ emoji — LẤY MÀU THẬT TỪ PIXEL
function init(emojiChar = '😍') {
    particlesArray = [];
    
    // Vẽ emoji lên canvas để quét pixel
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontSize = Math.min(canvas.width, canvas.height) * 0.4;
    ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiChar, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = 3; // Giảm step → nhiều hạt hơn, hình rõ hơn (vẫn ổn trên mobile)

    for (let y = 0; y < imageData.height; y += step) {
        for (let x = 0; x < imageData.width; x += step) {
            const index = (y * 4 * imageData.width) + (x * 4);
            const alpha = imageData.data[index + 3];
            
            if (alpha > 128) {
                // Lấy màu RGB từ pixel
                const r = imageData.data[index];
                const g = imageData.data[index + 1];
                const b = imageData.data[index + 2];
                const color = `rgb(${r}, ${g}, ${b})`;
                
                particlesArray.push(new Particle(x, y, color));
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

// Gắn sự kiện cho nút emojidocument.querySelectorAll('.emoji-btn').forEach(btn => {
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
