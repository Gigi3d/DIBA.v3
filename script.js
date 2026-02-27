// ===================================
// DIBA × BitMask — Institutional Deck v3
// 16 slides, premium dark theme
// ===================================

// ===================================
// State
// ===================================
let currentSlide = 1;
const totalSlides = 16;

// ===================================
// Session & Email Gate
// ===================================
const SESSION_KEY = 'deck_session_id';
const EMAIL_KEY = 'deck_viewer_email';
const ACCESS_KEY = 'deck_access_granted';
const SESSIONS_KEY = 'deck_sessions';

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function initSession() {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    sessions.push({
      id: sessionId,
      started: new Date().toISOString(),
      email: localStorage.getItem(EMAIL_KEY) || null,
      version: 'v3-institutional'
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
  return sessionId;
}

function hasAccess() {
  return localStorage.getItem(ACCESS_KEY) === 'true';
}

function grantAccess(email) {
  localStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(ACCESS_KEY, 'true');
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.email = email;
    session.emailSubmittedAt = new Date().toISOString();
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ===================================
// API Sync
// ===================================
async function syncSessionToAPI(sessionData) {
  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return true;
  } catch {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    const idx = sessions.findIndex(s => s.id === sessionData.id);
    if (idx >= 0) sessions[idx] = sessionData;
    else sessions.push(sessionData);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return false;
  }
}

const currentSessionId = initSession();

// ===================================
// Time Tracking
// ===================================
let slideStartTime = Date.now();

function updateTimeSpent() {
  const now = Date.now();
  const timeOnSlide = now - slideStartTime;
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.totalTimeSpentMs = (session.totalTimeSpentMs || 0) + timeOnSlide;
    if (!session.slideTimeMs) session.slideTimeMs = {};
    session.slideTimeMs[currentSlide] = (session.slideTimeMs[currentSlide] || 0) + timeOnSlide;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    syncSessionToAPI(session);
  }
  slideStartTime = now;
}

window.addEventListener('beforeunload', updateTimeSpent);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) updateTimeSpent();
  else slideStartTime = Date.now();
});

// ===================================
// DOM
// ===================================
const slides = document.querySelectorAll('.slide');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentSlideEl = document.getElementById('currentSlide');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// ===================================
// Navigation
// ===================================
function goToSlide(n) {
  if (n < 1 || n > totalSlides) return;
  if (n >= 2 && !hasAccess()) { showEmailGate(); return; }

  updateTimeSpent();
  
  // Remove active from all slides
  slides.forEach(s => {
    s.classList.remove('active');
  });
  
  const target = document.querySelector(`[data-slide="${n}"]`);
  if (target) {
    // Small delay for transition effect
    requestAnimationFrame(() => {
      target.classList.add('active');
      currentSlide = n;
      updateUI();
      updateURL();
      trackSlideView(n);
    });
  }
}

function trackSlideView(n) {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    if (!session.slidesViewed) session.slidesViewed = [];
    if (!session.slidesViewed.includes(n)) session.slidesViewed.push(n);
    session.lastSlide = n;
    session.lastActivity = new Date().toISOString();
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    syncSessionToAPI(session);
  }
}

function nextSlide() { if (currentSlide < totalSlides) goToSlide(currentSlide + 1); }
function prevSlide() { if (currentSlide > 1) goToSlide(currentSlide - 1); }

function updateUI() {
  const displaySlide = currentSlide - 1;
  currentSlideEl.textContent = displaySlide < 10 ? '0' + displaySlide : displaySlide;
  prevBtn.disabled = currentSlide === 1;
  nextBtn.disabled = currentSlide === totalSlides;
}

function updateURL() {
  history.replaceState(null, null, `#slide-${currentSlide}`);
}

// ===================================
// Events
// ===================================
prevBtn.addEventListener('click', prevSlide);
nextBtn.addEventListener('click', nextSlide);

document.addEventListener('keydown', (e) => {
  // Don't handle keys if email gate is open
  if (emailGateOverlay.classList.contains('active') && e.key !== 'Escape') return;
  
  switch (e.key) {
    case 'ArrowRight': case ' ': case 'PageDown':
      e.preventDefault(); nextSlide(); break;
    case 'ArrowLeft': case 'PageUp':
      e.preventDefault(); prevSlide(); break;
    case 'Home': e.preventDefault(); goToSlide(1); break;
    case 'End': e.preventDefault(); goToSlide(totalSlides); break;
  }
});

// Touch navigation
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(diff) > 50) diff > 0 ? nextSlide() : prevSlide();
});

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
  const doc = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (doc.requestFullscreen) doc.requestFullscreen();
    else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
    else if (doc.msRequestFullscreen) doc.msRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
});

// Hash navigation
window.addEventListener('load', () => {
  const hash = window.location.hash;
  if (hash) {
    const n = parseInt(hash.replace('#slide-', ''));
    if (n >= 1 && n <= totalSlides) goToSlide(n);
  }
  updateUI();
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash;
  if (hash) {
    const n = parseInt(hash.replace('#slide-', ''));
    if (n >= 1 && n <= totalSlides) goToSlide(n);
  }
});

// ===================================
// Email Gate
// ===================================
const emailGateOverlay = document.getElementById('emailGateOverlay');
const emailGateForm = document.getElementById('emailGateForm');
const emailInput = document.getElementById('emailInput');
const emailError = document.getElementById('emailError');

function showEmailGate() {
  emailGateOverlay.classList.add('active');
  emailInput.focus();
}

function hideEmailGate() {
  emailGateOverlay.classList.remove('active');
  emailInput.value = '';
  emailError.textContent = '';
}

emailGateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!isValidEmail(email)) {
    emailError.textContent = 'Please enter a valid email';
    emailInput.focus();
    return;
  }
  grantAccess(email);
  hideEmailGate();
  goToSlide(2);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emailGateOverlay.classList.contains('active')) hideEmailGate();
});

emailGateOverlay.addEventListener('click', (e) => {
  if (e.target === emailGateOverlay) {
    emailInput.focus();
    emailError.textContent = 'Please enter your email to continue';
  }
});

// ===================================
// Init
// ===================================
updateUI();
