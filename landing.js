/* ============================================
   KEXO AI — LANDING.JS
   Nav scroll, theme toggle, scroll animations
   ============================================ */

'use strict';

const THEME_KEY = 'kexo_theme';

// ===== THEME =====
function applyTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
}

// ===== NAV SCROLL =====
function initNav() {
    const nav = document.getElementById('lNav');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    initNav();
    initScrollAnimations();
});
