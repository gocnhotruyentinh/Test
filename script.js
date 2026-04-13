const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

// Mapping emoji -> URL ảnh PNG (Twemoji 72x72)
const emojiImages = {
    '😍': 'https://twemoji.maxcdn.com/v/latest/72x72/1f60d.png',
    '': 'https://twemoji.maxcdn.com/v/latest/72x72/1f680.png',
    '❤️': 'https://twemoji.maxcdn.com/v/latest/72x72/2764.png',
    '💻': 'https://twemoji.maxcdn.com/v/latest/72x72/1f4bb.png',
    '': 'https://twemoji.maxcdn.com/v/latest/72x72/1f308.png',
    '': 'https://twemoji.maxcdn.com/v/latest/72x72/1f525.png',
    '👽': 'https://twemoji.maxcdn.com/v/latest/72x72/1f47d.png',
    '': 'https://twemoji.maxcdn.com/v/latest/72x72/1f921.png'
};

let particlesArray = [];
let currentEmoji = '😍';

// Vị trí chạm
const touch = {
    x: null,
    y: null,
    radius: 100
};

// Xử lý cảm ứng
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
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 3; // 3-6px
        this.density = (Math.random() * 20) + 1;
        this.baseX = x;
        this.baseY = y;
        this.color = color;
        this.shadowColor = color.replace(')', ', 0.4)').replace('rgb', 'rgba');
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 6;
        ctx.shadowColor = this.shadowColor;
    }

    update() {
        if (touch.x !== null && touch.y !== null) {
            let dx = touch.x - this.x;
            let dy = touch.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < touch.radius) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (touch.radius - distance) / touch.radius;
                const directionX = forceDirectionX * force * this.density * 4;
                const directionY = forceDirectionY * force * this.density * 4;

                this.x -= directionX;
                this.y -= directionY;
            }
        }

        if (this.x !== this.baseX) {
            let dx = this.x - this.baseX;
            this.x -= dx / 10;
        }
        if (this.y !== this.baseY) {
            let dy = this.y - this.baseY;
            this.y -= dy / 10;
        }
        ctx.shadowBlur = 0;
    }
}

// Load ảnh emoji và khởi tạo hạt — PHIÊN BẢN CHUẨN
function init(emojiChar = '😍') {
    currentEmoji = emojiChar;
    particlesArray = [];

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = emojiImages[emojiChar] || emojiImages['😍'];

    img.onload = () => {
        // Tính kích thước ảnh phù hợp màn hình — GIỮ NGUYÊN TỶ LỆ
        const maxSize = Math.min(canvas.width, canvas.height) * 0.5; // Giảm xuống 0.5 để không quá lớn
        const scale = maxSize / Math.max(img.width, img.height); // Dùng max để giữ tỷ lệ
        const w = img.width * scale;
        const h = img.height * scale;

        // Vẽ ảnh vào GIỮA CANVAS — không dùng offset phức tạp
        const centerX = (canvas.width - w) / 2;
        const centerY = (canvas.height - h) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, centerX, centerY, w, h);

        // Quét pixel TRONG VÙNG ẢNH ĐÃ VẼ
        const imageData = ctx.getImageData(centerX, centerY, w, h);
        const step = 2; // Rất dày đặc

        for (let y = 0; y < imageData.height; y += step) {
            for (let x = 0; x < imageData.width; x += step) {
                const index = (y * 4 * imageData.width) + (x * 4);
                const alpha = imageData.data[index + 3];
                
                if (alpha > 128) {
                    const r = imageData.data[index];
                    const g = imageData.data[index + 1];
                    const b = imageData.data[index + 2];
                    const color = `rgb(${r}, ${g}, ${b})`;
                    
                    // Vị trí thực tế trên canvas
                    const realX = centerX + x;
                    const realY = centerY + y;
                    
                    particlesArray.push(new Particle(realX, realY, color));
                }
            }        }
    };

    img.onerror = () => {
        console.warn("Không load được ảnh emoji, dùng fallback");
        fallbackInit(emojiChar);
    };
}

// Fallback nếu không load được ảnh
function fallbackInit(emojiChar) {
    particlesArray = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const fontSize = Math.min(canvas.width, canvas.height) * 0.4;
    ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Màu giả lập theo emoji
    let fakeColor = '#ffffff';
    if (emojiChar === '😍') fakeColor = '#FFD700';
    else if (emojiChar === '') fakeColor = '#FF4500';
    else if (emojiChar === '❤️') fakeColor = '#FF1493';
    else if (emojiChar === '💻') fakeColor = '#C0C0C0';
    else if (emojiChar === '') fakeColor = '#FF69B4';
    else if (emojiChar === '') fakeColor = '#FF4500';
    else if (emojiChar === '👽') fakeColor = '#00FF00';
    else if (emojiChar === '') fakeColor = '#FFFFFF';

    ctx.fillStyle = fakeColor;
    ctx.fillText(emojiChar, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = 3;

    for (let y = 0; y < imageData.height; y += step) {
        for (let x = 0; x < imageData.width; x += step) {
            const index = (y * 4 * imageData.width) + (x * 4);
            const alpha = imageData.data[index + 3];
            
            if (alpha > 128) {
                particlesArray.push(new Particle(x, y, fakeColor));
            }
        }
    }
}

// Animation loop
function animate() {    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].draw();
        particlesArray[i].update();
    }
    requestAnimationFrame(animate);
}

// Gắn sự kiện nút
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        init(emoji);
    });
});

document.getElementById('resetBtn').addEventListener('click', () => {
    const emojis = Object.keys(emojiImages);
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    init(randomEmoji);
});

// Khởi động
init();
animate();
