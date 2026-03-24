/**
 * KEXO AI — auth.js
 * Auth guard + shared auth utilities
 */

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
// Call on protected pages: redirects to login if not signed in
function requireAuth(callback) {
  const { auth, onAuthStateChanged, getUserData } = window.KexoFirebase;
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    const userData = await getUserData(user.uid);
    if (userData?.blocked) {
      await window.KexoFirebase.signOut(auth);
      showToast("Your account has been suspended.", "error");
      setTimeout(() => window.location.href = "/login.html", 1500);
      return;
    }
    if (callback) callback(user, userData);
  });
}

// ─── REDIRECT IF AUTHED ──────────────────────────────────────────────────────
function redirectIfAuthed() {
  const { auth, onAuthStateChanged } = window.KexoFirebase;
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "/dashboard.html";
  });
}

// ─── SIGN OUT ────────────────────────────────────────────────────────────────
async function handleSignOut() {
  await window.KexoFirebase.signOut(window.KexoFirebase.auth);
  window.location.href = "/login.html";
}

// ─── CURRENT USER ────────────────────────────────────────────────────────────
function currentUser() {
  return window.KexoFirebase.auth.currentUser;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      display:flex; flex-direction:column; gap:10px; pointer-events:none;
    `;
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const colors = { info:"#4F46E5", success:"#22C55E", error:"#EF4444", warn:"#F59E0B" };
  const icons  = {
    info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warn:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  toast.style.cssText = `
    display:flex; align-items:center; gap:10px;
    background:#111827; border:1px solid #1F2937;
    border-left:3px solid ${colors[type]||colors.info};
    color:#F9FAFB; padding:12px 16px; border-radius:10px;
    font-family:'DM Sans',sans-serif; font-size:13px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    pointer-events:auto; cursor:pointer;
    animation:slideInToast 0.3s ease;
    max-width:320px;
  `;
  toast.innerHTML = `
    <span style="color:${colors[type]||colors.info};flex-shrink:0">${icons[type]||icons.info}</span>
    <span>${msg}</span>
  `;
  toast.onclick = () => toast.remove();
  container.appendChild(toast);
  if (!document.getElementById("toast-keyframes")) {
    const s = document.createElement("style");
    s.id = "toast-keyframes";
    s.textContent = `@keyframes slideInToast{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`;
    document.head.appendChild(s);
  }
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────
function showSkeleton(containerId, count = 3) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(count).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line" style="width:60%;height:16px;margin-bottom:10px"></div>
      <div class="skeleton-line" style="width:90%;height:12px;margin-bottom:6px"></div>
      <div class="skeleton-line" style="width:75%;height:12px"></div>
    </div>
  `).join("");
}

window.KexoAuth = { requireAuth, redirectIfAuthed, handleSignOut, currentUser, showToast, showSkeleton };
window.showToast = showToast;
