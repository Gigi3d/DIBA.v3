/**
 * DIBA Landing Page Interactions
 * Dynamic animations for metrics and scroll reveals
 */

document.addEventListener('DOMContentLoaded', () => {
    initMetricCounter();
    initScrollReveal();
    initHoverParallax();
});

/**
 * Animate numbers when they entering the viewport
 */
function initMetricCounter() {
    const metrics = document.querySelectorAll('.metric-value[data-target]');
    
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const countTo = parseFloat(target.getAttribute('data-target'));
                animateValue(target, 0, countTo, 2000);
                observer.unobserve(target);
            }
        });
    }, observerOptions);

    metrics.forEach(metric => observer.observe(metric));
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = value;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Subtle scroll reveal for sections
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.glass-card, .section-header, .trust-grid, .hero-container > *');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

/**
 * Mouse parallax for the background glows
 */
function initHoverParallax() {
    const glows = document.querySelectorAll('.glow');
    
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        glows.forEach((glow, idx) => {
            const speed = (idx + 1) * 20;
            const xOffset = (x - 0.5) * speed;
            const yOffset = (y - 0.5) * speed;
            glow.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });
}

/**
 * Smooth nav reveal on scroll
 */
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
        nav.style.background = 'rgba(3, 5, 9, 0.85)';
        nav.style.padding = '1rem 0';
    } else {
        nav.style.background = 'rgba(3, 5, 9, 0.4)';
        nav.style.padding = '1.5rem 0';
    }
    
    lastScroll = currentScroll;
});
