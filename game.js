
"use strict";

// ZEENITH GAMES - SPACE SHOOTER
// Laptop: Arrow keys / WASD + Space + Escape
// Mobile: Touch direction buttons + FIRE

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);

// Screens
const homeScreen = $("homeScreen");
const difficultyScreen = $("difficultyScreen");
const gameScreen = $("gameScreen");
const pauseOverlay = $("pauseOverlay");
const gameOverOverlay = $("gameOverOverlay");

// Game dimensions
let GAME_WIDTH = 900;
let GAME_HEIGHT = 650;

// Game state
let running = false;
let paused = false;
let animationId = null;

let score = 0;
let health = 3;
let difficulty = "medium";

let lastShot = 0;
let lastEnemy = 0;
let lastTime = 0;
let audioContext = null;

const keys = Object.create(null);

// Player
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 75,
    width: 42,
    height: 48,
    speed: 6,
    invulnerable: 0
};

// Game objects
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];

// Difficulty
const levels = {
    slow: { speed: 1.8, spawn: 1250, label: "SLOW" },
    medium: { speed: 2.8, spawn: 900, label: "MEDIUM" },
    hard: { speed: 4.2, spawn: 620, label: "HARD" }
};

// ---------------- RESPONSIVE GAME SIZE ----------------

function resizeGame() {
    const mobile = window.innerWidth <= 600;

    const newWidth = mobile ? 390 : 900;
    const newHeight = mobile ? 693 : 650;

    if (GAME_WIDTH === newWidth && GAME_HEIGHT === newHeight) {
        return;
    }

    const scaleX = newWidth / GAME_WIDTH;
    const scaleY = newHeight / GAME_HEIGHT;

    player.x *= scaleX;
    player.y *= scaleY;

    bullets.forEach(bullet => {
        bullet.x *= scaleX;
        bullet.y *= scaleY;
    });

    enemies.forEach(enemy => {
        enemy.x *= scaleX;
        enemy.y *= scaleY;
    });

    particles.forEach(particle => {
        particle.x *= scaleX;
        particle.y *= scaleY;
        particle.vx *= scaleX;
        particle.vy *= scaleY;
    });

    GAME_WIDTH = newWidth;
    GAME_HEIGHT = newHeight;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    createStars();

    player.x = Math.max(24, Math.min(GAME_WIDTH - 24, player.x));
    player.y = Math.max(25, Math.min(GAME_HEIGHT - 28, player.y));
}

window.addEventListener("resize", resizeGame);
window.addEventListener("orientationchange", resizeGame);

// ---------------- SCREEN CONTROL ----------------

function showScreen(name) {
    homeScreen.hidden = name !== "home";
    difficultyScreen.hidden = name !== "difficulty";
    gameScreen.hidden = name !== "game";
}

$("startBtn").addEventListener("click", () => {
    showScreen("difficulty");
    sound(520, 0.08);
});

$("backBtn").addEventListener("click", () => {
    showScreen("home");
});

document.querySelectorAll(".difficulty-card").forEach(card => {
    card.addEventListener("click", () => {
        document.querySelectorAll(".difficulty-card").forEach(item => {
            item.classList.remove("selected");
        });

        card.classList.add("selected");

        const radio = card.querySelector('input[name="difficulty"]');

        if (radio) {
            radio.checked = true;
        }
    });
});

$("playBtn").addEventListener("click", () => {
    const selected = document.querySelector(
        'input[name="difficulty"]:checked'
    );

    difficulty = selected ? selected.value : "medium";
    startGame();
});

$("homeBtn").addEventListener("click", goHome);
$("menuBtn").addEventListener("click", goHome);
$("pauseMenuBtn").addEventListener("click", goHome);
$("retryBtn").addEventListener("click", startGame);
$("resumeBtn").addEventListener("click", resumeGame);

// ---------------- SOUND ----------------

function sound(frequency = 440, duration = 0.08, type = "sine") {
    try {
        audioContext ??= new (
            window.AudioContext || window.webkitAudioContext
        )();

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.07, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        // Sound is optional.
    }
}

function explosionSound() {
    try {
        audioContext ??= new (
            window.AudioContext || window.webkitAudioContext
        )();

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const now = audioContext.currentTime;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(180, now);
        oscillator.frequency.exponentialRampToValueAtTime(35, now + 0.35);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.4);
    } catch (error) {
        // Sound is optional.
    }
}

// ---------------- KEYBOARD CONTROLS ----------------

window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
    ) {
        event.preventDefault();
    }

    if (key === "escape" && running) {
        if (paused) {
            resumeGame();
        } else {
            pauseGame();
        }
        return;
    }

    keys[key] = true;
});

window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearKeys();
});

function clearKeys() {
    Object.keys(keys).forEach(key => {
        keys[key] = false;
    });

    document.querySelectorAll(".mobile-controls button").forEach(button => {
        button.classList.remove("pressed");
    });
}

// ---------------- MOBILE TOUCH CONTROLS ----------------

// Prevent browser gestures on the control area
const mobileControls = document.querySelector(".mobile-controls");

if (mobileControls) {
    mobileControls.style.touchAction = "none";
    mobileControls.style.userSelect = "none";
    mobileControls.style.webkitUserSelect = "none";
}

document.querySelectorAll(".mobile-controls button").forEach(button => {
    const key = button.dataset.key;

    if (!key) return;

    button.style.touchAction = "none";
    button.style.userSelect = "none";
    button.style.webkitUserSelect = "none";

    function pressButton(event) {
        event.preventDefault();

        if (!running || paused) return;

        keys[key] = true;
        button.classList.add("pressed");

        try {
            button.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is optional.
        }
    }

    function releaseButton(event) {
        event.preventDefault();

        keys[key] = false;
        button.classList.remove("pressed");
    }

    button.addEventListener("pointerdown", pressButton, {
        passive: false
    });

    button.addEventListener("pointerup", releaseButton, {
        passive: false
    });

    button.addEventListener("pointercancel", releaseButton, {
        passive: false
    });

    button.addEventListener("lostpointercapture", () => {
        keys[key] = false;
        button.classList.remove("pressed");
    });

    button.addEventListener("contextmenu", event => {
        event.preventDefault();
    });
});

// ---------------- STARS ----------------

function createStars() {
    stars = [];

    for (let i = 0; i < 120; i++) {
        stars.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            size: Math.random() * 2 + 0.4,
            speed: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.8 + 0.2
        });
    }
}

function drawStars(delta) {
    for (const star of stars) {
        star.y += star.speed * delta * 0.06;

        if (star.y > GAME_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * GAME_WIDTH;
        }

        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#dcecff";
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;
}

// ---------------- PLAYER ----------------

function drawPlayer() {
    if (
        player.invulnerable > 0 &&
        Math.floor(performance.now() / 100) % 2 === 0
    ) {
        return;
    }

    const x = player.x;
    const y = player.y;

    ctx.save();

    // Engine flames
    ctx.shadowColor = "#00d9ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ff8c28";

    ctx.beginPath();
    ctx.moveTo(x - 9, y + 34);
    ctx.lineTo(x - 4, y + 51 + Math.random() * 8);
    ctx.lineTo(x, y + 38);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 9, y + 34);
    ctx.lineTo(x + 4, y + 51 + Math.random() * 8);
    ctx.lineTo(x, y + 38);
    ctx.fill();

    // Ship body
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d4af37";

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 21, y + 44);
    ctx.lineTo(x, y + 34);
    ctx.lineTo(x + 21, y + 44);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = "#00d9ff";
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function movePlayer(delta) {
    const step = player.speed * delta * 0.06;

    if (keys.arrowleft || keys.a) player.x -= step;
    if (keys.arrowright || keys.d) player.x += step;
    if (keys.arrowup || keys.w) player.y -= step;
    if (keys.arrowdown || keys.s) player.y += step;

    player.x = Math.max(24, Math.min(GAME_WIDTH - 24, player.x));
    player.y = Math.max(25, Math.min(GAME_HEIGHT - 28, player.y));

    if (player.invulnerable > 0) {
        player.invulnerable -= delta;
    }
}

// ---------------- SHOOTING ----------------

function shoot() {
    bullets.push({
        x: player.x,
        y: player.y - 18,
        speed: 10,
        radius: 4
    });

    sound(750, 0.055, "square");
}

function updateBullets(delta) {
    const now = performance.now();

    if (keys[" "] && now - lastShot > 220) {
        shoot();
        lastShot = now;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        bullet.y -= bullet.speed * delta * 0.06;

        ctx.save();
        ctx.shadowColor = "#00d9ff";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#00eaff";
        ctx.fillRect(bullet.x - 3, bullet.y, 6, 17);
        ctx.restore();

        if (bullet.y < -20) {
            bullets.splice(i, 1);
        }
    }
}

// ---------------- ENEMIES ----------------

function createEnemy() {
    const setting = levels[difficulty];

    enemies.push({
        x: 30 + Math.random() * (GAME_WIDTH - 60),
        y: -40,
        width: 36,
        height: 34,
        speed: setting.speed + Math.min(score / 1000, 2),
        phase: Math.random() * Math.PI * 2
    });
}

function drawEnemy(enemy) {
    const x = enemy.x;
    const y = enemy.y;

    ctx.save();
    ctx.translate(x + 18, y + 17);

    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#64152b";

    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(16, -8);
    ctx.lineTo(18, 5);
    ctx.lineTo(9, 16);
    ctx.lineTo(-9, 16);
    ctx.lineTo(-18, 5);
    ctx.lineTo(-16, -8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d93646";

    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, -7);
    ctx.lineTo(0, -3);
    ctx.lineTo(-12, -7);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "#00eaff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00eaff";

    ctx.beginPath();
    ctx.ellipse(-7, 1, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(7, 1, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffb347";
    ctx.fillRect(-7, 9, 14, 3);

    ctx.fillStyle = "#d4af37";
    ctx.fillRect(-19, -3, 5, 13);
    ctx.fillRect(14, -3, 5, 13);

    ctx.restore();
}

function updateEnemies(delta) {
    const now = performance.now();
    const setting = levels[difficulty];

    if (now - lastEnemy > setting.spawn) {
        createEnemy();
        lastEnemy = now;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        enemy.y += enemy.speed * delta * 0.06;
        enemy.x += Math.sin(now / 350 + enemy.phase) * 0.5;

        drawEnemy(enemy);

        if (enemy.y > GAME_HEIGHT + 40) {
            enemies.splice(i, 1);
        }
    }
}

// ---------------- EXPLOSIONS ----------------

function createExplosion(x, y) {
    const colors = [
        "#ffd700",
        "#00d9ff",
        "#ffffff",
        "#ff8c28",
        "#ff3030"
    ];

    for (let i = 0; i < 35; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 1;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 650,
            maxLife: 650,
            size: Math.random() * 5 + 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    explosionSound();
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx * delta * 0.06;
        p.y += p.vy * delta * 0.06;
        p.life -= delta;

        const opacity = Math.max(0, p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// ---------------- COLLISIONS ----------------

function damagePlayer() {
    if (player.invulnerable > 0 || !running) return;

    health = Math.max(0, health - 1);
    player.invulnerable = 850;

    sound(140, 0.2, "sawtooth");
    updateHUD();

    if (health <= 0) {
        endGame();
    }
}

function checkCollisions() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        const dx = enemy.x + 18 - player.x;
        const dy = enemy.y + 17 - (player.y + 23);

        if (Math.hypot(dx, dy) < 34) {
            createExplosion(enemy.x + 18, enemy.y + 17);
            enemies.splice(i, 1);
            damagePlayer();
            continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];

            if (
                bullet.x > enemy.x - 5 &&
                bullet.x < enemy.x + enemy.width + 5 &&
                bullet.y > enemy.y - 5 &&
                bullet.y < enemy.y + enemy.height + 5
            ) {
                createExplosion(enemy.x + 18, enemy.y + 17);

                enemies.splice(i, 1);
                bullets.splice(j, 1);

                score += 10;
                updateHUD();
                break;
            }
        }
    }
}

// ---------------- HUD ----------------

function updateHUD() {
    $("score").textContent = score;
    $("health").textContent = "❤️".repeat(health);

    const levelElement = $("level");

    if (levelElement) {
        levelElement.textContent = levels[difficulty].label;
    }
}

// ---------------- GAME LOOP ----------------

function gameLoop(timestamp) {
    if (!running || paused) return;

    const delta = Math.min(
        timestamp - (lastTime || timestamp),
        35
    );

    lastTime = timestamp;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawStars(delta);
    movePlayer(delta);
    drawPlayer();

    updateBullets(delta);
    updateEnemies(delta);
    updateParticles(delta);
    checkCollisions();

    if (!running) return;

    animationId = requestAnimationFrame(gameLoop);
}

// ---------------- START GAME ----------------

function startGame() {
    cancelAnimationFrame(animationId);

    resizeGame();

    score = 0;
    health = 3;

    bullets = [];
    enemies = [];
    particles = [];

    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 75;
    player.invulnerable = 0;

    clearKeys();
    createStars();
    updateHUD();

    pauseOverlay.hidden = true;
    gameOverOverlay.hidden = true;

    showScreen("game");

    running = true;
    paused = false;

    lastShot = 0;
    lastEnemy = performance.now();
    lastTime = 0;

    sound(600, 0.12);

    animationId = requestAnimationFrame(gameLoop);
}

// ---------------- PAUSE / RESUME ----------------

function pauseGame() {
    if (!running || paused) return;

    paused = true;
    clearKeys();

    cancelAnimationFrame(animationId);
    pauseOverlay.hidden = false;
}

function resumeGame() {
    if (!running || !paused) return;

    paused = false;
    pauseOverlay.hidden = true;
    lastTime = 0;

    clearKeys();

    animationId = requestAnimationFrame(gameLoop);
}

// ---------------- GAME OVER ----------------

function endGame() {
    running = false;
    paused = false;

    cancelAnimationFrame(animationId);
    clearKeys();

    $("finalScore").textContent = score;
    gameOverOverlay.hidden = false;
}

// ---------------- MAIN MENU ----------------

function goHome() {
    running = false;
    paused = false;

    cancelAnimationFrame(animationId);
    clearKeys();

    pauseOverlay.hidden = true;
    gameOverOverlay.hidden = true;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    showScreen("home");
}

// ---------------- INITIALIZE ----------------

resizeGame();
createStars();
showScreen("home");
