/**
 * Typejoy Framework — Canvas Particle System
 *
 * Manages particle effects, screen shake, RGB glow, and screen-edge glow
 * on a stacked canvas overlay. All effects are rendered with `pointer-events: none`
 * so keystrokes always reach the input layer.
 */
export class ParticleSystem {
    canvas;
    ctx;
    particles = [];
    shoves = [];
    edgeGlows = [];
    animationId = null;
    theme = null;
    reducedMotion = false;
    width = 0;
    height = 0;
    lastTime = 0;
    constructor(canvas) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('Could not get 2d context from canvas');
        this.ctx = ctx;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
    }
    /** Set theme for particle colors */
    setTheme(theme) {
        this.theme = theme;
    }
    /** Enable/disable reduced motion */
    setReducedMotion(reduced) {
        this.reducedMotion = reduced;
    }
    /** Resize the canvas */
    resize(width, height) {
        this.width = width;
        this.height = height;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
    }
    /** Emit a particle burst at a position */
    emitBurst(x, y, judgment, style, density = 1.0) {
        if (this.reducedMotion && judgment !== 'perfect')
            return;
        if (style === 'none')
            return;
        const colors = this.getJudgmentColors(judgment);
        const count = this.getParticleCount(judgment) * density;
        const intensity = this.theme?.intensity ?? 0.8;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = (2 + Math.random() * 4) * intensity;
            const life = 300 + Math.random() * 400;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life,
                maxLife: life,
                size: 2 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                style,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                gravity: 0.02,
                opacity: 1,
            });
        }
    }
    /** Emit a small muted flash for bad timing */
    emitMutedFlash(x, y) {
        if (this.reducedMotion)
            return;
        const colors = this.getJudgmentColors('good');
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 1.5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 200,
                maxLife: 200,
                size: 1.5,
                color: colors[0],
                style: 'spark',
                rotation: 0,
                rotationSpeed: 0,
                gravity: 0.01,
                opacity: 0.6,
            });
        }
    }
    /** Emit a small burst for wrong key */
    emitWrongKeyBurst(x, y) {
        if (this.reducedMotion)
            return;
        const color = this.theme?.colors.danger ?? '#ff1744';
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 150,
                maxLife: 150,
                size: 1.5,
                color,
                style: 'spark',
                rotation: 0,
                rotationSpeed: 0,
                gravity: 0,
                opacity: 0.5,
            });
        }
    }
    /** Add screen shake */
    addShake(intensity, duration = 200) {
        if (this.reducedMotion)
            return;
        this.shoves.push({
            intensity,
            duration,
            startTime: performance.now(),
            decay: 0.02,
        });
    }
    /** Add screen-edge glow */
    addEdgeGlow(color, intensity, duration = 300) {
        if (this.reducedMotion)
            return;
        this.edgeGlows.push({
            color,
            intensity,
            duration,
            startTime: performance.now(),
        });
    }
    /** Get total shake offset */
    getShakeOffset() {
        let x = 0;
        let y = 0;
        const now = performance.now();
        for (let i = this.shoves.length - 1; i >= 0; i--) {
            const s = this.shoves[i];
            const elapsed = now - s.startTime;
            if (elapsed > s.duration) {
                this.shoves.splice(i, 1);
                continue;
            }
            const progress = elapsed / s.duration;
            const decay = 1 - progress;
            x += (Math.random() - 0.5) * s.intensity * decay * 2;
            y += (Math.random() - 0.5) * s.intensity * decay * 2;
        }
        return { x, y };
    }
    /** Start the animation loop */
    start() {
        this.lastTime = performance.now();
        const loop = (time) => {
            const dt = time - this.lastTime;
            this.lastTime = time;
            this.update(dt);
            this.render();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }
    /** Stop the animation loop */
    stop() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    /** Update particles */
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life -= dt;
            p.rotation += p.rotationSpeed;
            p.opacity = Math.max(0, p.life / p.maxLife);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    /** Render all particles and effects */
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        // Apply screen shake
        const shake = this.getShakeOffset();
        ctx.save();
        ctx.translate(shake.x, shake.y);
        // Render edge glows
        this.renderEdgeGlows(ctx);
        // Render particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            switch (p.style) {
                case 'spark':
                    this.renderSpark(ctx, p);
                    break;
                case 'ring':
                    this.renderRing(ctx, p);
                    break;
                case 'star':
                    this.renderStar(ctx, p);
                    break;
                case 'confetti':
                    this.renderConfetti(ctx, p);
                    break;
            }
            ctx.restore();
        }
        ctx.restore();
    }
    renderSpark(ctx, p) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    renderRing(ctx, p) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
        ctx.stroke();
    }
    renderStar(ctx, p) {
        const spikes = 5;
        const outerRadius = p.size * 2;
        const innerRadius = p.size;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }
    renderConfetti(ctx, p) {
        ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
    }
    renderEdgeGlows(ctx) {
        const now = performance.now();
        for (let i = this.edgeGlows.length - 1; i >= 0; i--) {
            const g = this.edgeGlows[i];
            const elapsed = now - g.startTime;
            if (elapsed > g.duration) {
                this.edgeGlows.splice(i, 1);
                continue;
            }
            const progress = elapsed / g.duration;
            const alpha = g.intensity * (1 - progress);
            // Create gradient from edges
            const gradient = ctx.createRadialGradient(this.width / 2, this.height / 2, this.width * 0.3, this.width / 2, this.height / 2, this.width * 0.7);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, this.hexToRgba(g.color, alpha * 0.3));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    }
    getJudgmentColors(judgment) {
        const c = this.theme?.colors ?? {
            primary: '#00e5ff',
            secondary: '#76ff03',
            tertiary: '#ffea00',
            danger: '#ff1744',
        };
        switch (judgment) {
            case 'perfect': return [c.primary, '#ffffff', c.primary];
            case 'great': return [c.secondary, '#ffffff'];
            case 'good': return [c.tertiary];
        }
    }
    getParticleCount(judgment) {
        const base = this.theme?.particleDensity ?? 1.0;
        switch (judgment) {
            case 'perfect': return Math.floor(20 * base);
            case 'great': return Math.floor(12 * base);
            case 'good': return Math.floor(6 * base);
        }
    }
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    /** Clear all particles and effects */
    clear() {
        this.particles = [];
        this.shoves = [];
        this.edgeGlows = [];
    }
}
//# sourceMappingURL=particle-system.js.map