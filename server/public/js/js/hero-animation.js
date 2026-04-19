// Hero Section Animations - Enhanced Premium Version

// Animated Gradient Background
function initAnimatedGradient() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    // Create animated gradient overlay
    const gradientOverlay = document.createElement('div');
    gradientOverlay.className = 'animated-gradient-overlay';
    gradientOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background: linear-gradient(
            135deg,
            rgba(124, 58, 237, 0.8) 0%,
            rgba(217, 70, 239, 0.6) 25%,
            rgba(99, 102, 241, 0.7) 50%,
            rgba(139, 92, 246, 0.6) 75%,
            rgba(124, 58, 237, 0.8) 100%
        );
        background-size: 400% 400%;
        animation: gradientShift 15s ease infinite;
        mix-blend-mode: overlay;
    `;
    hero.insertBefore(gradientOverlay, hero.firstChild);
}

// Particle System
class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 50;
        this.connectionDistance = 150;
        this.mouse = { x: null, y: null, radius: 150 };

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        this.particles.forEach((particle, i) => {
            // Move particle
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;

            // Mouse interaction
            if (this.mouse.x && this.mouse.y) {
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.mouse.radius) {
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    particle.x -= dx * force * 0.03;
                    particle.y -= dy * force * 0.03;
                }
            }

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.fill();

            // Draw connections
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[j].x - particle.x;
                const dy = this.particles[j].y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.connectionDistance) {
                    const opacity = (1 - distance / this.connectionDistance) * 0.3;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Number Counter Animation
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (easeOutExpo)
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

        const current = Math.floor(start + (target - start) * easeProgress);
        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target.toLocaleString();
        }
    }

    requestAnimationFrame(update);
}

// Dashboard Stats Animation
function initDashboardStats() {
    const statValues = document.querySelectorAll('.stat-value[data-target]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                entry.target.classList.add('animated');
                const target = parseInt(entry.target.dataset.target);
                animateCounter(entry.target, target);
            }
        });
    }, { threshold: 0.5 });

    statValues.forEach(stat => observer.observe(stat));
}

// Chart Bars Animation
function initChartAnimation() {
    const chartBars = document.querySelectorAll('.chart-bar');

    chartBars.forEach((bar, index) => {
        const height = Math.random() * 60 + 20; // Random height between 20-80
        bar.style.height = '0px';
        bar.style.transition = 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';

        setTimeout(() => {
            bar.style.height = `${height}px`;
        }, 500 + index * 100);
    });
}

// Scroll Reveal Animation
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(reveal => observer.observe(reveal));
}

// Shimmer Effect for Text
function initTextShimmer() {
    const shimmerElements = document.querySelectorAll('.text-gradient');

    shimmerElements.forEach(element => {
        element.style.backgroundSize = '200% auto';
        element.style.animation = 'shimmer 3s linear infinite';
    });
}

// Floating Animation for Dashboard
function initFloatingAnimation() {
    const dashboard = document.querySelector('.dashboard-mockup');
    if (!dashboard) return;

    let offset = 0;

    function float() {
        offset += 0.01;
        const y = Math.sin(offset) * 10;
        dashboard.style.transform = `translateY(${y}px)`;
        requestAnimationFrame(float);
    }

    float();
}

// Initialize all animations
document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
        initAnimatedGradient();

        // Initialize particle system if canvas exists
        const canvas = document.getElementById('hero-network-canvas');
        if (canvas) {
            new ParticleSystem('hero-network-canvas');
        }

        initDashboardStats();
        initChartAnimation();
        initTextShimmer();
        initFloatingAnimation();
    }

    // Always init scroll reveal (it's subtle)
    initScrollReveal();
});

// Add CSS animations via style injection
const style = document.createElement('style');
style.textContent = `
    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    
    @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .reveal {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                    transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    .reveal.visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* Staggered animation for multiple reveals */
    .reveal:nth-child(1) { transition-delay: 0.1s; }
    .reveal:nth-child(2) { transition-delay: 0.2s; }
    .reveal:nth-child(3) { transition-delay: 0.3s; }
    .reveal:nth-child(4) { transition-delay: 0.4s; }
    
    /* Enhanced button hover with shine effect */
    .btn-primary {
        position: relative;
        overflow: hidden;
    }
    
    .btn-primary::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
        );
        transition: left 0.5s;
    }
    
    .btn-primary:hover::before {
        left: 100%;
    }
    
    /* Pulse animation for live indicators */
    @keyframes pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.7;
            transform: scale(1.05);
        }
    }
    
    .badge-live {
        animation: pulse 2s ease-in-out infinite;
    }
    
    /* Enhanced glassmorphism */
    .glass-panel {
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        background-color: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
    }
    
    /* Smooth transitions for all interactive elements */
    * {
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Performance optimizations */
    .dashboard-mockup,
    .chart-bar,
    .btn,
    .feature-card,
    .flow-node {
        will-change: transform;
        transform: translateZ(0);
        backface-visibility: hidden;
    }
`;
document.head.appendChild(style);
