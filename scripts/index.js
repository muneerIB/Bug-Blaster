/**
 * Game Engine & Logic
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- USER CONFIGURATION ---
// PASTE YOUR MUSIC FILE PATH HERE (e.g., "music.mp3")
const BACKGROUND_MUSIC_FILE = ""; 

// --- Configuration ---
let GAME_WIDTH = 800;
let GAME_HEIGHT = 450;

// Physics Constants
const GRAVITY = 0.5;
const MAX_SPEED = 5;
const ACCELERATION = 0.8; 
const FRICTION = 0.6;     
const JUMP_FORCE = 11;
const VARIABLE_JUMP_CUTOFF = 0.5;

const BULLET_SPEED = 12;
const ENEMY_SPEED = 1.5;

// Advanced Physics
const COYOTE_TIME = 6;
const JUMP_BUFFER = 5;

// --- Game State ---
let score = 0;
let isPlaying = false;
let frames = 0;
let cameraX = 0;
let animationId = null; 
let shakeTimer = 0;

// Endless Generation State
let generationX = 0;
let lastPlatformY = 300;
let distanceTraveled = 0;

// --- Colors ---
const COLORS = {
    sky: "#5c94fc",
    waterSurface: "#3c6c9c",
    waterBody: "#5c94fc",
    grassTop: "#80d010",
    grassDark: "#008000",
    dirt: "#e79c21",
    dirtDark: "#c84c0c",
    brick: "#a05000",
    cloud: "#ffffff",
    island: "#2e8b57", 
    playerGreen: "#4d8009",
    playerSkin: "#ffcc99",
    enemyPurple: "#9b30ff",
    enemyDarkPurple: "#6a0dad",
    bossRed: "#d32f2f",
    bossDarkRed: "#8b0000",
    // Background Prop Colors
    hillGreen: "#269926",
    hillDark: "#1a661a",
    mushroomRed: "#ff3333",
    mushroomStem: "#ffcc99",
    castleGrey: "#808080",
    castleDark: "#505050",
    pipeGreen: "#00aa00",
    pipeDark: "#006600"
};

// --- AUDIO MANAGER ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.bgMusic = null;
        this.masterVolume = 0.3;
    }

    init() {
        // Initialize Audio Context on user gesture
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Initialize Background Music if file provided
        if (BACKGROUND_MUSIC_FILE && !this.bgMusic) {
            this.bgMusic = new Audio(BACKGROUND_MUSIC_FILE);
            this.bgMusic.loop = true;
            this.bgMusic.volume = 0.4;
        }
    }

    playMusic() {
        if (this.bgMusic) {
            this.bgMusic.play().catch(e => console.log("Music play failed:", e));
        }
    }

    stopMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
    }

    // Synthesized Shoot Sound (Retro Laser)
    playShoot(pitch = 1.0) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(880 * pitch, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110 * pitch, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1 * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Synthesized Explosion Sound (Noise)
    playExplosion() {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3 * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start();
    }
}

const audio = new SoundManager();

// --- Input Handling ---
const keys = {
    right: false,
    left: false,
    up: false,
    down: false,
    shoot: false,
    upPressed: false
};

window.addEventListener('keydown', (e) => {
    if(!isPlaying) return;
    if(e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if(e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
    if(e.code === 'ArrowUp' || e.code === 'KeyW') {
        if(!keys.up) keys.upPressed = true; 
        keys.up = true;
    }
    if(e.code === 'Space') keys.shoot = true;
});

window.addEventListener('keyup', (e) => {
    if(e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if(e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if(e.code === 'ArrowUp' || e.code === 'KeyW') {
        keys.up = false;
        keys.upPressed = false;
    }
    if(e.code === 'Space') keys.shoot = false;
});

const setupTouch = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        keys[key] = true;
        if(key === 'up') keys.upPressed = true;
    });
    el.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        keys[key] = false; 
        if(key === 'up') keys.upPressed = false;
    });
};

setupTouch('btn-left', 'left');
setupTouch('btn-right', 'right');
setupTouch('btn-down', 'down');
setupTouch('btn-jump', 'up');
setupTouch('btn-shoot', 'shoot');

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('mobile-controls').style.display = 'block';
}

// --- Effects Helpers ---
function shakeScreen(amount) {
    shakeTimer = amount;
}

// --- Classes ---

class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.markedForDeletion = false;
    }
    
    checkRectCollision(other) {
        return (this.x < other.x + other.width &&
                this.x + this.width > other.x &&
                this.y < other.y + other.height &&
                this.y + this.height > other.y);
    }
    
    update() {}
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.velY = -1;
        this.markedForDeletion = false;
    }

    update() {
        this.y += this.velY;
        this.life -= 0.02;
        if(this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx, camX) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(this.text, this.x - camX, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Particle extends Entity {
    constructor(x, y, color, speedX, speedY, size, gravity = 0, friction = 0.95) {
        super(x, y, size, size);
        this.color = color;
        this.speedX = speedX;
        this.speedY = speedY;
        this.gravity = gravity;
        this.friction = friction;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.5;
    }

    update() {
        this.speedY += this.gravity;
        this.speedX *= this.friction;
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
        if(this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx, camX) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        
        ctx.save();
        ctx.translate(this.x - camX, this.y);
        ctx.rotate(this.rotation);
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();
        
        ctx.globalAlpha = 1.0;
    }
}

class Bullet extends Entity {
    constructor(x, y, direction, owner) {
        super(x, y, 8, 4);
        this.speed = BULLET_SPEED * direction;
        this.color = owner === 'player' ? '#ffff00' : '#ff0000';
        this.owner = owner;
    }

    update(platforms) {
        this.x += this.speed;
        
        if (this.x < cameraX - 500 || this.x > cameraX + GAME_WIDTH + 500) {
            this.markedForDeletion = true;
        }

        for(let p of platforms) {
            if (this.checkRectCollision(p)) {
                this.markedForDeletion = true;
                createExplosion(this.x + (this.speed > 0 ? 8 : 0), this.y, '#cccccc', 3);
                return;
            }
        }
    }

    draw(ctx, camX) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camX, this.y, this.width, this.height);
        // Trail
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(this.x - camX - (this.speed > 0 ? 10 : -10), this.y, 10, this.height);
    }
}

class Player extends Entity {
    constructor() {
        super(100, 200, 32, 48); 
        this.velX = 0;
        this.velY = 0;
        this.isGrounded = false;
        this.isCrouching = false;
        this.facingRight = true;
        this.hp = 100;
        this.invincibleTimer = 0;
        this.shootTimer = 0;
        this.muzzleFlashTimer = 0;
        this.muzzleRand = 0; 
        
        this.coyoteTimer = 0;
        this.jumpBuffer = 0;
        this.wasGrounded = false; 
    }

    update(platforms, enemies, bullets) {
        // --- CROUCHING LOGIC ---
        const wasCrouching = this.isCrouching;
        this.isCrouching = this.isGrounded && keys.down;

        if (!wasCrouching && this.isCrouching) {
            this.y += 16;
            this.height = 32;
        } else if (wasCrouching && !this.isCrouching) {
            this.y -= 16;
            this.height = 48;
        }

        // --- MOVEMENT ---
        if (this.isCrouching) {
            this.velX *= FRICTION; 
        } else {
            if (keys.right) {
                if (this.velX < 0) this.velX += FRICTION; 
                this.velX += ACCELERATION;
                this.facingRight = true;
            } else if (keys.left) {
                if (this.velX > 0) this.velX -= FRICTION;
                this.velX -= ACCELERATION;
                this.facingRight = false;
            } else {
                const f = this.isGrounded ? FRICTION : FRICTION * 0.5;
                if (this.velX > 0) {
                    this.velX -= f;
                    if (this.velX < 0) this.velX = 0;
                } else if (this.velX < 0) {
                    this.velX += f;
                    if (this.velX > 0) this.velX = 0;
                }
            }
        }

        if (this.velX > MAX_SPEED) this.velX = MAX_SPEED;
        if (this.velX < -MAX_SPEED) this.velX = -MAX_SPEED;

        // --- SHOOTING ---
        if (keys.shoot) this.shoot();
        if (this.shootTimer > 0) this.shootTimer--;
        if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer--;

        // --- JUMPING ---
        if (keys.upPressed && !this.isCrouching) {
            this.jumpBuffer = JUMP_BUFFER;
            keys.upPressed = false; 
        }
        if (this.jumpBuffer > 0) this.jumpBuffer--;

        if (!keys.up && this.velY < -2) this.velY *= VARIABLE_JUMP_CUTOFF;

        this.velY += GRAVITY;
        
        if (this.isGrounded) this.coyoteTimer = COYOTE_TIME;
        else if (this.coyoteTimer > 0) this.coyoteTimer--;

        if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
            this.velY = -JUMP_FORCE;
            this.coyoteTimer = 0;
            this.jumpBuffer = 0;
            this.isGrounded = false;
            createDust(this.x + this.width/2, this.y + this.height, 5);
        }
        
        this.x += this.velX;
        this.y += this.velY;

        // --- COLLISION ---
        this.isGrounded = false;
        platforms.forEach(p => {
            if (this.x < p.x + p.width + 10 && this.x + this.width > p.x - 10) {
                if (this.checkRectCollision(p)) {
                    const overlapX = (this.width + p.width)/2 - Math.abs((this.x + this.width/2) - (p.x + p.width/2));
                    const overlapY = (this.height + p.height)/2 - Math.abs((this.y + this.height/2) - (p.y + p.height/2));

                    if (overlapX > overlapY) {
                        if (this.velY > 0 && this.y + this.height - this.velY <= p.y + 20) {
                            this.y = p.y - this.height;
                            this.velY = 0;
                            this.isGrounded = true;
                            if (!this.wasGrounded) createDust(this.x + this.width/2, this.y + this.height, 3);
                        } else if (this.velY < 0 && this.y - this.velY >= p.y + p.height) {
                            this.y = p.y + p.height;
                            this.velY = 0;
                        }
                    } else {
                         if (this.velX > 0) {
                            this.x = p.x - this.width;
                            this.velX = 0;
                        } else if (this.velX < 0) {
                            this.x = p.x + p.width;
                            this.velX = 0;
                        }
                    }
                }
            }
        });
        this.wasGrounded = this.isGrounded;

        if (this.y > GAME_HEIGHT) this.hp = 0;

        // --- DAMAGE ---
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        
        enemies.forEach(e => {
            if (this.checkRectCollision(e)) this.takeDamage(10, e.x); 
        });

        bullets.forEach(b => {
            if (b.owner === 'enemy' && !b.markedForDeletion) {
                if (this.checkRectCollision(b)) {
                    b.markedForDeletion = true;
                    this.takeDamage(10, b.x); 
                }
            }
        });

        if (this.hp <= 0) gameOver();
    }

    takeDamage(amount, sourceX) {
        if (this.invincibleTimer === 0) {
            this.hp -= amount;
            this.invincibleTimer = 60;
            this.velY = -6; 
            this.velX = this.x < sourceX ? -8 : 8; 
            if (this.isCrouching) {
                this.isCrouching = false;
                this.height = 48;
                this.y -= 16;
            }
            shakeScreen(10); 
            createExplosion(this.x + this.width/2, this.y + this.height/2, '#ff0000', 10);
            floatingTexts.push(new FloatingText(this.x, this.y, `-${amount}`, "#ff0000"));
        }
    }

    shoot() {
        if (this.shootTimer === 0) {
            const bulletY = this.isCrouching ? this.y + 14 : this.y + 22;
            
            bullets.push(new Bullet(
                this.facingRight ? this.x + this.width : this.x - 8, 
                bulletY, 
                this.facingRight ? 1 : -1,
                'player'
            ));
            audio.playShoot(1.0); // PLAY SOUND
            this.shootTimer = 8;
            this.muzzleFlashTimer = 3;
            this.muzzleRand = Math.random(); 
            shakeScreen(2); 
            
            // Recoil
            if(!this.isGrounded && !this.isCrouching) this.velX += this.facingRight ? -0.5 : 0.5;
        }
    }

    draw(ctx, camX) {
        const x = Math.round(this.x - camX);
        const y = Math.round(this.y);

        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

        const camo = COLORS.playerGreen;
        const skin = COLORS.playerSkin;
        const darkCamo = "#2f4f09";
        const gunColor = "#222";
        
        const lean = (this.velX / MAX_SPEED) * 4;

        ctx.save();
        ctx.translate(x + this.width/2, y + this.height);
        
        let sx = 1, sy = 1;
        if (Math.abs(this.velY) > 2) { sx = 0.9; sy = 1.1; } 
        if (this.isGrounded && Math.abs(this.velX) > 0.1) { sx = 1.05 - Math.abs(lean)/100; sy = 0.95; }
        
        ctx.scale(this.facingRight ? sx : -sx, sy);
        ctx.rotate(lean * 0.05 * (this.facingRight ? 1 : -1));
        
        if (this.isCrouching) {
            ctx.translate(-16, -32); 
            ctx.fillStyle = camo;
            ctx.fillRect(4, 20, 16, 8); 
            ctx.fillStyle = "#111"; 
            ctx.fillRect(18, 22, 10, 6); 
            ctx.fillStyle = darkCamo; 
            ctx.fillRect(6, 6, 20, 14); 
            ctx.fillStyle = gunColor;
            ctx.fillRect(4, 12, 8, 6);
            ctx.fillRect(12, 10, 16, 6);
            ctx.fillRect(28, 12, 8, 2); 
            ctx.fillRect(16, 16, 4, 4);
            ctx.fillStyle = skin;
            ctx.fillRect(8, -8, 14, 14); 
            ctx.fillStyle = camo; 
            ctx.beginPath();
            ctx.arc(15, -4, 11, Math.PI, 0); 
            ctx.fill();
            ctx.fillRect(4, -4, 22, 4); 
            ctx.fillStyle = "#000"; 
            ctx.fillRect(18, 0, 2, 2); 
            if (this.muzzleFlashTimer > 0) this.drawMuzzleFlash(ctx, 38, 13);
        } else {
            ctx.translate(-16, -48); 
            const walkCycle = Math.sin(frames * 0.4) * 8;
            const standing = Math.abs(this.velX) < 0.1;
            ctx.fillStyle = camo;
            ctx.fillRect(8 + (standing ? 0 : walkCycle), 28, 8, 20); 
            ctx.fillRect(18 - (standing ? 0 : walkCycle), 28, 8, 20); 
            ctx.fillStyle = "#111"; 
            ctx.fillRect(6 + (standing ? 0 : walkCycle), 44, 12, 4);
            ctx.fillRect(16 - (standing ? 0 : walkCycle), 44, 12, 4);
            ctx.fillStyle = darkCamo; 
            ctx.fillRect(6, 18, 20, 16);
            ctx.fillStyle = camo; 
            ctx.fillRect(10, 18, 14, 6); 
            ctx.fillStyle = gunColor;
            ctx.fillRect(4, 22, 8, 6);
            ctx.fillRect(12, 20, 16, 6);
            ctx.fillRect(28, 22, 8, 2); 
            ctx.fillRect(16, 26, 4, 6);
            ctx.fillStyle = skin;
            ctx.fillRect(18, 24, 4, 4); 
            ctx.fillStyle = skin;
            ctx.fillRect(8, 4, 14, 14);
            ctx.fillStyle = camo; 
            ctx.beginPath();
            ctx.arc(15, 8, 11, Math.PI, 0); 
            ctx.fill();
            ctx.fillRect(4, 8, 22, 4); 
            ctx.fillStyle = "#000"; 
            ctx.fillRect(18, 12, 2, 2); 
            if (this.muzzleFlashTimer > 0) this.drawMuzzleFlash(ctx, 38, 23);
        }
        ctx.restore();
    }

    drawMuzzleFlash(ctx, x, y) {
        ctx.fillStyle = "#fffaaa";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.muzzleRand * Math.PI * 2); 
        const scale = 1 + this.muzzleRand;
        ctx.scale(scale, scale);
        
        ctx.beginPath();
        for(let i=0; i<8; i++) {
            const angle = (i/8) * Math.PI * 2;
            const r = i%2===0 ? 14 : 6;
            ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
        }
        ctx.fill();
        
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, isBoss = false) {
        const w = isBoss ? 64 : 32;
        const h = isBoss ? 64 : 32;
        super(x, y, w, h);
        this.startX = x;
        this.velX = 0;
        this.velY = 0;
        this.facingRight = false;
        this.shootTimer = Math.random() * 100;
        this.bounceOffset = Math.random() * 100;
        this.hp = isBoss ? 12 : 3; 
        this.maxHp = this.hp;
        this.isActive = true; 
        this.isGrounded = false;
        this.isBoss = isBoss;
        this.flashTimer = 0;
    }

    takeDamage(amount, sourceX) {
        this.hp -= amount;
        this.flashTimer = 5;
        
        // Physics Knockback!
        const dir = Math.sign(this.x - sourceX) || 1;
        const force = this.isBoss ? 4 : 8; // Bosses are heavier
        this.velX = dir * force;
        this.velY = -4;
        this.isGrounded = false;
        
        // Blood Particles
        for(let i=0; i<5; i++) {
            particles.push(new Particle(
                this.x + this.width/2, this.y + this.height/2, 
                this.isBoss ? '#8b0000' : '#9b30ff',
                (Math.random() - 0.5) * 6 + dir * 2,
                (Math.random() - 0.5) * 6,
                3 + Math.random() * 3,
                0.3
            ));
        }
    }

    update(player, platforms) {
        // --- PHYSICS ---
        this.velY += GRAVITY;
        this.x += this.velX;
        this.y += this.velY;
        
        if (this.isGrounded) this.velX *= 0.85; // Stronger friction for realistic stop

        this.isGrounded = false;
        platforms.forEach(p => {
             if (this.x < p.x + p.width + 5 && this.x + this.width > p.x - 5) {
                 if (this.checkRectCollision(p)) {
                     if (this.velY > 0 && this.y + this.height - this.velY <= p.y + 15) {
                        this.y = p.y - this.height;
                        this.velY = 0;
                        this.isGrounded = true;
                     } 
                 }
             }
        });

        // AI Logic
        const dist = Math.abs(player.x - this.x);
        const dx = player.x - this.x;
        
        if (dist < (this.isBoss ? 800 : 600)) { 
            // Only turn if velocity is low (commits to movement)
            if (Math.abs(this.velX) < 1) {
                this.facingRight = dx > 0;
            }
            
            if (dist > 200) {
                if (this.isGrounded) {
                    const speed = this.isBoss ? ENEMY_SPEED * 0.8 : ENEMY_SPEED;
                    this.velX += this.facingRight ? 0.3 : -0.3; // Snappier movement
                    if (Math.abs(this.velX) > speed) this.velX = this.facingRight ? speed : -speed;
                }
            } else {
                if (this.isGrounded) this.velX *= 0.8;
            }
            
            // Ledge Logic
            if (this.isGrounded) {
                let aboutToFall = true;
                const lookAhead = this.facingRight ? this.width : 0;
                platforms.forEach(p => {
                    if (this.x + lookAhead + this.velX * 10 > p.x && 
                        this.x + lookAhead + this.velX * 10 < p.x + p.width && 
                        Math.abs((this.y + this.height) - p.y) < 5) {
                        aboutToFall = false;
                    }
                });
                
                // If hitting knockback, ignore ledge safety (fall off!)
                if (aboutToFall && Math.abs(this.velX) < 5) this.velX = 0;
            }

            // Shoot
            if (this.shootTimer <= 0 && Math.abs(player.y - this.y) < 200) {
                bullets.push(new Bullet(
                    this.facingRight ? this.x + this.width : this.x - 8,
                    this.y + this.height/2,
                    this.facingRight ? 1 : -1,
                    'enemy'
                ));
                // PLAY SOUND
                audio.playShoot(0.5); // Lower pitch for enemy
                
                // Recoil
                this.velX += this.facingRight ? -2 : 2;
                
                const cooldown = this.isBoss ? 20 + Math.random() * 20 : 60 + Math.random() * 40;
                this.shootTimer = cooldown;
            }
        }
        
        this.shootTimer--;
        
        if (this.x < cameraX - 500) this.markedForDeletion = true;
        if (this.y > GAME_HEIGHT) this.markedForDeletion = true;
        if (this.flashTimer > 0) this.flashTimer--;
    }

    draw(ctx, camX) {
        const x = this.x - camX;
        const y = this.y;

        // Flash disabled per request, physics reaction only
        // if (this.flashTimer > 0) ... 

        const cx = x + this.width/2;
        const cy = y + this.height/2;
        const radius = this.width/2 - 2;
        
        // Procedural Animation
        // Lean forward based on velocity
        const lean = (this.velX / MAX_SPEED) * 0.5;
        // Bob up and down
        const bob = Math.sin(frames * 0.2) * 2;
        // Squash on land (if just landed) - simplified to velocity stretch
        let sy = 1;
        if (!this.isGrounded) sy = 1.1; // Stretch in air
        
        ctx.save();
        ctx.translate(cx, cy + this.height/2); // Pivot at feet
        ctx.scale(1, sy);
        ctx.rotate(lean);
        ctx.translate(-cx, -(cy + this.height/2)); // Reset pivot

        ctx.save(); // Inner save for flipping
        if (this.facingRight) {
            ctx.translate(cx, cy);
            ctx.scale(-1, 1);
            ctx.translate(-cx, -cy);
        }

        // Spikes
        ctx.fillStyle = "#cccccc"; 
        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2 + frames * 0.05;
            const sx = cx + Math.cos(angle) * radius;
            const sy = cy + bob + Math.sin(angle) * radius;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle)*8, sy + Math.sin(angle)*8);
            ctx.lineTo(sx + Math.cos(angle+0.5)*4, sy + Math.sin(angle+0.5)*4);
            ctx.fill();
        }

        ctx.fillStyle = this.isBoss ? COLORS.bossRed : COLORS.enemyPurple;
        ctx.beginPath();
        ctx.arc(cx, cy + bob, radius, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = this.isBoss ? COLORS.bossDarkRed : COLORS.enemyDarkPurple;
        ctx.beginPath();
        ctx.arc(cx - 4, cy + bob + 4, radius*0.7, 0, Math.PI*2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx - 5, cy + bob - 2, 5, 0, Math.PI*2);
        ctx.arc(cx + 5, cy + bob - 2, 5, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = "#d32f2f";
        ctx.beginPath();
        ctx.arc(cx - 3, cy + bob - 2, 2, 0, Math.PI*2);
        ctx.arc(cx + 7, cy + bob - 2, 2, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + bob - 8);
        ctx.lineTo(cx, cy + bob - 4);
        ctx.lineTo(cx + 10, cy + bob - 8);
        ctx.stroke();

        ctx.fillStyle = "#444";
        ctx.fillRect(cx - 20, cy + bob + 4, 12, 6); 
        ctx.fillRect(cx - 14, cy + bob + 6, 4, 6); 
        ctx.fillStyle = "#000";
        ctx.fillRect(cx - 22, cy + bob + 5, 2, 4); 
        
        if (this.shootTimer > 10 && this.shootTimer < 20) {
             ctx.fillStyle = "#ffff00";
             ctx.beginPath();
             ctx.arc(cx - 25, cy + bob + 7, 5, 0, Math.PI*2);
             ctx.fill();
        }

        ctx.restore(); // Restore flip
        ctx.restore(); // Restore lean/squash
        
        // Health Bar for Boss
        if (this.isBoss) {
            ctx.fillStyle = "#000";
            ctx.fillRect(x, y - 15, this.width, 5);
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(x, y - 15, this.width * (this.hp / this.maxHp), 5);
        }
    }
}

class Decoration extends Entity {
    constructor(x, y, type) {
        super(x, y, 40, 60);
        this.type = type; // 'tree', 'ruin'
    }
    
    update() {
        if (this.x < cameraX - 500) this.markedForDeletion = true;
    }
    
    draw(ctx, camX) {
        const x = this.x - camX;
        const y = this.y;
        
        if (this.type === 'tree') {
            // Trunk
            ctx.fillStyle = "#8b4513";
            ctx.fillRect(x + 15, y + 20, 10, 40);
            // Leaves
            ctx.fillStyle = "#228b22";
            ctx.beginPath();
            ctx.arc(x + 20, y + 20, 25, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = "#32cd32";
            ctx.beginPath();
            ctx.arc(x + 15, y + 15, 10, 0, Math.PI*2);
            ctx.arc(x + 25, y + 25, 8, 0, Math.PI*2);
            ctx.fill();
        } else {
            // Ruin/Pillar
            ctx.fillStyle = "#777";
            ctx.fillRect(x + 10, y + 10, 20, 50);
            ctx.fillStyle = "#999";
            ctx.fillRect(x + 5, y + 10, 30, 5); // Cap
            ctx.fillRect(x + 5, y + 55, 30, 5); // Base
            // Cracks
            ctx.fillStyle = "#555";
            ctx.fillRect(x + 15, y + 25, 10, 2);
            ctx.fillRect(x + 18, y + 25, 2, 8);
        }
    }
}

class BackgroundScenery {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'hill', 'mushroom', 'castle', 'pipe'
        this.w = 100;
        this.h = 100;
        // Random variations
        this.scale = 0.8 + Math.random() * 0.8;
    }

    draw(ctx, camX, parallaxFactor) {
        // Calculate parallax position
        // We use a large virtual width for the background loop to simulate infinite world
        const virtualWidth = GAME_WIDTH * 2; 
        let renderX = (this.x - camX * parallaxFactor) % virtualWidth;
        // If it goes too far left, wrap it
        if (renderX < -200) renderX += virtualWidth;
        // If it's too far right, wrap (optional for bidirectional)
        
        const y = this.y;
        const s = this.scale;

        ctx.save();
        ctx.translate(renderX, y);
        ctx.scale(s, s);

        if (this.type === 'hill') {
            ctx.fillStyle = COLORS.hillGreen;
            ctx.strokeStyle = COLORS.hillDark;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(50, 100, 50, Math.PI, 0); // Semi circle
            ctx.fill();
            ctx.stroke();
            // Eyes
            ctx.fillStyle = "#000";
            ctx.fillRect(35, 70, 6, 12);
            ctx.fillRect(59, 70, 6, 12);
        } else if (this.type === 'mushroom') {
            // Stem
            ctx.fillStyle = COLORS.mushroomStem;
            ctx.fillRect(40, 50, 20, 50);
            // Cap
            ctx.fillStyle = COLORS.mushroomRed;
            ctx.beginPath();
            ctx.arc(50, 50, 40, Math.PI, 0);
            ctx.fill();
            // Spots
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(50, 30, 8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(25, 45, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(75, 45, 6, 0, Math.PI*2); ctx.fill();
        } else if (this.type === 'castle') {
            ctx.fillStyle = COLORS.castleGrey;
            ctx.fillRect(20, 40, 60, 60); // Main body
            ctx.fillStyle = COLORS.castleDark;
            ctx.fillRect(30, 20, 40, 20); // Tower
            // Battlements
            ctx.fillRect(30, 10, 8, 10);
            ctx.fillRect(46, 10, 8, 10);
            ctx.fillRect(62, 10, 8, 10);
            // Door
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(50, 100, 15, Math.PI, 0);
            ctx.fill();
        } else if (this.type === 'pipe') {
            ctx.fillStyle = COLORS.pipeGreen;
            ctx.strokeStyle = COLORS.pipeDark;
            ctx.lineWidth = 2;
            ctx.fillRect(30, 40, 40, 60); // Body
            ctx.strokeRect(30, 40, 40, 60);
            ctx.fillStyle = COLORS.pipeGreen;
            ctx.fillRect(25, 20, 50, 20); // Top
            ctx.strokeRect(25, 20, 50, 20);
        }

        ctx.restore();
    }
}

class Platform extends Entity {
    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.decorations = [];
        
        // Chance to add decoration
        if (w > 100) {
            if (Math.random() > 0.5) {
                const type = Math.random() > 0.5 ? 'tree' : 'ruin';
                this.decorations.push(new Decoration(x + Math.random() * (w-40), y - 60, type));
            }
        }
    }
    
    update() {
        if (this.x + this.width < cameraX - 500) this.markedForDeletion = true;
        this.decorations.forEach(d => d.update());
    }

    draw(ctx, camX) {
        // Draw decorations first so they are behind player but on platform
        this.decorations.forEach(d => d.draw(ctx, camX));
        
        const x = this.x - camX;
        
        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(x, this.y, this.width, this.height);

        ctx.fillStyle = COLORS.brick; 
        const brickW = 20;
        const brickH = 10;
        for (let py = this.y + 15; py < this.y + this.height; py += brickH) {
            const offset = ((py - this.y) / brickH) % 2 === 0 ? 0 : 10;
            for (let px = x + offset; px < x + this.width; px += brickW) {
                if (px + 10 < x + this.width) {
                    ctx.fillRect(px, py, 14, 4); 
                }
            }
        }
        
        ctx.fillStyle = COLORS.grassDark;
        ctx.fillRect(x, this.y, this.width, 14);
        ctx.fillStyle = COLORS.grassTop;
        ctx.fillRect(x, this.y, this.width, 10);
        
        for(let i=0; i<this.width; i+=15) {
            ctx.fillRect(x+i, this.y+10, 6, 4); 
        }
    }
}

// --- Global Variables ---
let player;
let platforms = [];
let enemies = [];
let bullets = [];
let particles = [];
let clouds = [];
let floatingTexts = [];
let backgroundObjects = []; // Replaces distantIslands

function init() {
    resize();
    resetGame();
}

function resize() {
    GAME_WIDTH = window.innerWidth;
    GAME_HEIGHT = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false; 
}

window.addEventListener('resize', resize);

function resetGame() {
    score = 0;
    cameraX = 0;
    shakeTimer = 0;
    generationX = 0;
    lastPlatformY = GAME_HEIGHT * 0.7;
    
    platforms = [];
    enemies = [];
    bullets = [];
    particles = [];
    floatingTexts = [];
    
    player = new Player();
    
    // Initial Generation
    extendLevel();
    
    // Cloud Generation
    clouds = [];
    for(let i=0; i<20; i++) {
        clouds.push({
            x: Math.random() * GAME_WIDTH * 4,
            y: 30 + Math.random() * 200,
            scale: 1 + Math.random()
        });
    }

    // Background Props Generation (Mushrooms, Hills, etc)
    backgroundObjects = [];
    const bgProps = ['hill', 'hill', 'mushroom', 'mushroom', 'pipe', 'castle'];
    for(let i=0; i<15; i++) {
        const type = bgProps[Math.floor(Math.random() * bgProps.length)];
        // Spread them out over a wide virtual area
        backgroundObjects.push(new BackgroundScenery(Math.random() * GAME_WIDTH * 3, GAME_HEIGHT - 60 - Math.random()*20, type));
    }
    
    document.getElementById('game-over-screen').classList.add('hidden');
}

function extendLevel() {
    // Generate platforms up to screen width + buffer
    const buffer = 2000;
    
    while (generationX < cameraX + GAME_WIDTH + buffer) {
        // Start Platform Logic
        if (platforms.length === 0) {
            platforms.push(new Platform(0, lastPlatformY, 400, 400));
            generationX = 400;
            continue;
        }

        const gap = 80 + Math.random() * 100;
        const width = 150 + Math.random() * 300;
        const height = 400;
        
        const minChange = -100;
        const maxChange = 100;
        let deltaY = Math.floor(Math.random() * (maxChange - minChange + 1)) + minChange;
        
        let y = lastPlatformY + deltaY;

        if (y > GAME_HEIGHT - 100) y = GAME_HEIGHT - 100; 
        if (y < GAME_HEIGHT * 0.3) y = GAME_HEIGHT * 0.3; 
        
        lastPlatformY = y;

        let platformX = generationX + gap;
        
        platforms.push(new Platform(platformX, y, width, height));
        generationX = platformX + width;
        
        // Spawn Enemy Logic - INCREASED DENSITY
        if (width > 100) {
            // Boss Chance: Every ~3000 score/distance or rare chance
            const isBoss = Math.random() < 0.05; // 5% chance per platform
            
            if (isBoss) {
                enemies.push(new Enemy(platformX + width/2 - 32, y - 64, true));
            } else {
                // 90% chance for an enemy (was 70%)
                if (Math.random() > 0.1) {
                    enemies.push(new Enemy(platformX + width/2, y - 32, false));
                }
                
                // If platform is wide, 50% chance to add a SECOND enemy
                if (width > 250 && Math.random() > 0.5) {
                    enemies.push(new Enemy(platformX + width/4, y - 32, false));
                }
            }
        }
        
        if (Math.random() > 0.7 && y > GAME_HEIGHT * 0.5) {
             platforms.push(new Platform(platformX + width/2 - 30, y - 100, 80, 20));
        }
    }
}

function createExplosion(x, y, color, count) {
    for(let i=0; i<count; i++) {
        // High physics debris
        particles.push(new Particle(
            x, y, color, 
            (Math.random() - 0.5) * 10, 
            (Math.random() - 0.5) * 10,
            4 + Math.random() * 4,
            0.3 // gravity
        ));
    }
}

function createDust(x, y, count) {
    for(let i=0; i<count; i++) {
        particles.push(new Particle(
            x, y, '#dddddd', 
            (Math.random() - 0.5) * 4, 
            Math.random() * -2,
            2 + Math.random() * 2,
            0.1
        ));
    }
}

function startGame() {
    audio.init();
    audio.playMusic();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    if (animationId) cancelAnimationFrame(animationId);
    resetGame();
    isPlaying = true;
    gameLoop();
}

function gameOver() {
    audio.stopMusic();
    isPlaying = false;
    if (animationId) cancelAnimationFrame(animationId);
    document.getElementById('final-score').innerText = "Score: " + score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function drawBackground() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Parallax Clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    clouds.forEach(c => {
        const x = (c.x - cameraX * 0.1) % (GAME_WIDTH + 800) - 400;
        ctx.beginPath();
        ctx.arc(x, c.y, 30*c.scale, 0, Math.PI*2);
        ctx.fill();
    });

    // Parallax Mario-Style Scenery (Background Objects)
    backgroundObjects.forEach(obj => {
        // Parallax factor 0.3 (slower than foreground)
        obj.draw(ctx, cameraX, 0.3);
    });

    // Water
    const waterY = GAME_HEIGHT - 60;
    ctx.fillStyle = COLORS.waterBody; 
    ctx.fillRect(0, waterY, GAME_WIDTH, 60);
    ctx.fillStyle = COLORS.waterSurface;
    ctx.fillRect(0, waterY, GAME_WIDTH, 10);
    
    ctx.fillStyle = "#fff";
    const offset = (frames * 0.5) % 40;
    for (let i = 0; i < GAME_WIDTH; i += 40) {
        if((i + frames)% 80 > 40) ctx.fillRect(i + offset - 20, waterY + 4, 10, 2);
    }
}

function gameLoop() {
    if (!isPlaying) return;

    frames++;

    // Endless Generation
    extendLevel();

    // Shake Logic
    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
        shakeX = (Math.random() - 0.5) * shakeTimer;
        shakeY = (Math.random() - 0.5) * shakeTimer;
        shakeTimer *= 0.9;
        if(shakeTimer < 0.5) shakeTimer = 0;
    }

    let targetCamX = player.x - GAME_WIDTH * 0.3; 
    if (player.facingRight) targetCamX += 150; 
    else targetCamX -= 50; 
    
    if (targetCamX < 0) targetCamX = 0;
    cameraX += (targetCamX - cameraX) * 0.05; 
    
    // Updates & Cleanup
    player.update(platforms, enemies, bullets);
    
    // Filter out entities far behind
    platforms = platforms.filter(e => !e.markedForDeletion);
    enemies = enemies.filter(e => !e.markedForDeletion);
    bullets = bullets.filter(b => !b.markedForDeletion);
    particles = particles.filter(p => !p.markedForDeletion);
    floatingTexts = floatingTexts.filter(t => !t.markedForDeletion);

    enemies.forEach(e => e.update(player, platforms));
    bullets.forEach(b => b.update(platforms));
    floatingTexts.forEach(t => t.update());
    particles.forEach(p => p.update());
    platforms.forEach(p => p.update());
    
    // Bullet-Enemy Collision
    bullets.forEach(b => {
        if (b.owner === 'player' && !b.markedForDeletion) {
            enemies.forEach(e => {
                if (!e.markedForDeletion && e.checkRectCollision(b)) {
                    b.markedForDeletion = true;
                    e.takeDamage(1, b.x); // Apply Physics Impulse!
                    
                    audio.playExplosion(); // Small thud
                    createExplosion(b.x, b.y, '#fff', 2);
                    
                    if (e.hp <= 0) {
                        e.markedForDeletion = true;
                        shakeScreen(e.isBoss ? 15 : 5);
                        // Big ragdoll explosion
                        createExplosion(e.x + e.width/2, e.y + e.height/2, e.isBoss ? '#d32f2f' : '#9b30ff', 16);
                        
                        const pts = e.isBoss ? 50 : 10;
                        score += pts;
                        floatingTexts.push(new FloatingText(e.x, e.y, `+${pts}`, "#ffff00"));
                    } else {
                        floatingTexts.push(new FloatingText(e.x, e.y, "HIT", "#ffffff"));
                    }
                }
            });
        }
    });

    // Draw
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    ctx.save();
    ctx.translate(shakeX, shakeY); 

    drawBackground();

    platforms.forEach(p => {
        if (p.x + p.width > cameraX && p.x < cameraX + GAME_WIDTH) p.draw(ctx, cameraX);
    });
    
    enemies.forEach(e => {
         if (e.x + e.width > cameraX && e.x < cameraX + GAME_WIDTH) e.draw(ctx, cameraX);
    });

    player.draw(ctx, cameraX);
    bullets.forEach(b => b.draw(ctx, cameraX));
    particles.forEach(p => p.draw(ctx, cameraX));
    floatingTexts.forEach(t => t.draw(ctx, cameraX));
    
    ctx.restore();

    document.getElementById('score-display').innerText = `SCORE: ${score}`;
    document.getElementById('health-display').innerText = `HP: ${Math.max(0, player.hp)}%`;

    animationId = requestAnimationFrame(gameLoop);
}

// Start
init();


if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("Service Worker Registered"));
}
