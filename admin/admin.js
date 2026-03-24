/**
 * KEXO AI — admin.js
 * Full admin panel logic
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc,
  setDoc, updateDoc, deleteDoc, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(KEXO_CONFIG.firebase);
const auth = getAuth(app);
const db   = getFirestore(app);

let allUsers    = [];
let allProjects = [];

// ─── AUTH ─────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "../login.html"; return; }
  if (user.uid !== KEXO_CONFIG.adminUID) {
    document.getElementById("accessDenied").style.display = "flex";
    return;
  }
  // Admin verified
  document.getElementById("topbar").style.display = "flex";
  document.querySelectorAll(".section").forEach(s => s.style.display = "block");
  document.getElementById("adminUIDDisplay").value = user.uid;
  switchTab("analytics");
  await loadAll();
});

// ─── LOAD DATA ────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadUsers(), loadProjects(), loadSettings()]);
  renderAnalytics();
}

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadProjects() {
  const snap = await getDocs(collection(db, "projects"));
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.cloudinary) {
      document.getElementById("cloudName").value    = data.cloudinary.cloud_name    || "";
      document.getElementById("uploadPreset").value = data.cloudinary.upload_preset || "";
    }
    if (data.features) {
      Object.entries(data.features).forEach(([k, v]) => {
        const el = document.getElementById(`feat-${k.toLowerCase().replace(/([A-Z])/g, m => m[0].toLowerCase())}`);
        if (el) el.checked = v;
      });
    }
  } catch(_) {}
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────
function renderAnalytics() {
  const blocked = allUsers.filter(u => u.blocked).length;
  document.getElementById("statUsers").textContent    = allUsers.length;
  document.getElementById("statProjects").textContent = allProjects.length;
  document.getElementById("statBlocked").textContent  = blocked;
  document.getElementById("statActive").textContent   = allUsers.length - blocked;
  document.getElementById("statUsersDelta").textContent = `${allUsers.length} registered`;

  // Recent users table (last 5)
  const recent = [...allUsers].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  }).slice(0, 5);

  document.getElementById("recentUsersTable").innerHTML = recent.map(u => userRow(u, false)).join("") || emptyRow(5);
}

// ─── USERS TABLE ──────────────────────────────────────────────────────────
function renderUsers() {
  document.getElementById("userCountBadge").textContent = `${allUsers.length} users`;
  document.getElementById("usersTable").innerHTML =
    allUsers.map(u => userRow(u, true)).join("") || emptyRow(6);
}

function userRow(u, showActions) {
  const name = `${u.firstName||""} ${u.lastName||""}`.trim() || "—";
  const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const joined = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
  return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="user-avatar">${u.photoURL?`<img src="${u.photoURL}">`:initials}</div>
        <span>${escHtml(name)}</span>
      </div>
    </td>
    <td style="font-family:monospace;font-size:12px;color:var(--muted)">${u.kexoUID||"—"}</td>
    <td style="color:var(--text2)">${escHtml(u.email||"—")}</td>
    <td><span class="badge ${u.blocked?"badge-red":"badge-green"}">${u.blocked?"Blocked":"Active"}</span></td>
    <td style="color:var(--muted)">${joined}</td>
    ${showActions ? `<td>
      <div style="display:flex;gap:6px">
        <button class="btn-sm ${u.blocked?"btn-outline":"btn-danger"}" onclick="toggleBlock('${u.id}',${!u.blocked})">
          ${u.blocked?"Unblock":"Block"}
        </button>
        <button class="btn-sm btn-danger" onclick="confirmDeleteUser('${u.id}','${escHtml(name)}')">Delete</button>
      </div>
    </td>` : ""}
  </tr>`;
}

// ─── PROJECTS TABLE ───────────────────────────────────────────────────────
function renderProjects() {
  document.getElementById("projectCountBadge").textContent = `${allProjects.length} projects`;
  document.getElementById("projectsTable").innerHTML =
    allProjects.map(p => {
      const updated = p.updatedAt?.toDate ? timeAgo(p.updatedAt.toDate()) : "—";
      const ownerUID = Object.entries(p.roles||{}).find(([,v])=>v==="owner")?.[0] || "—";
      const ownerUser = allUsers.find(u=>u.id===ownerUID);
      const ownerName = ownerUser ? `${ownerUser.firstName||""} ${ownerUser.lastName||""}`.trim() : ownerUID.substring(0,8)+"…";
      return `<tr>
        <td><strong>${escHtml(p.name||"Untitled")}</strong></td>
        <td><span class="badge badge-blue">${(p.members||[]).length} member${(p.members||[]).length!==1?"s":""}</span></td>
        <td style="color:var(--text2)">${escHtml(ownerName)}</td>
        <td style="color:var(--muted)">${updated}</td>
        <td>
          <button class="btn-sm btn-danger" onclick="confirmDeleteProject('${p.id}','${escHtml(p.name||"Untitled")}')">Delete</button>
        </td>
      </tr>`;
    }).join("") || emptyRow(5);
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────
window.toggleBlock = async (uid, block) => {
  try {
    await updateDoc(doc(db, "users", uid), { blocked: block });
    allUsers = allUsers.map(u => u.id === uid ? { ...u, blocked: block } : u);
    renderUsers(); renderAnalytics();
    toast(block ? "User blocked." : "User unblocked.", block ? "warn" : "success");
  } catch(e) { toast("Error: " + e.message, "error"); }
};

window.confirmDeleteUser = (uid, name) => {
  showConfirm(`Delete user "${name}"?`, "This will permanently delete the user account. This cannot be undone.",
    async () => {
      try {
        await deleteDoc(doc(db, "users", uid));
        allUsers = allUsers.filter(u => u.id !== uid);
        renderUsers(); renderAnalytics();
        toast("User deleted.", "success");
      } catch(e) { toast("Error: " + e.message, "error"); }
    });
};

window.confirmDeleteProject = (id, name) => {
  showConfirm(`Delete project "${name}"?`, "All project data will be permanently deleted.",
    async () => {
      try {
        await deleteDoc(doc(db, "projects", id));
        allProjects = allProjects.filter(p => p.id !== id);
        renderProjects(); renderAnalytics();
        toast("Project deleted.", "success");
      } catch(e) { toast("Error: " + e.message, "error"); }
    });
};

// ─── CLOUDINARY ───────────────────────────────────────────────────────────
window.saveCloudinary = async () => {
  const cloud_name    = document.getElementById("cloudName").value.trim();
  const upload_preset = document.getElementById("uploadPreset").value.trim();
  if (!cloud_name || !upload_preset) { toast("Fill in both fields.", "error"); return; }
  try {
    await setDoc(doc(db, "settings", "global"), { cloudinary: { cloud_name, upload_preset } }, { merge:true });
    const msg = document.getElementById("cloudSaveMsg");
    msg.style.display = "block";
    setTimeout(() => msg.style.display = "none", 3000);
    toast("Cloudinary config saved!", "success");
  } catch(e) { toast("Error: " + e.message, "error"); }
};

// ─── FEATURE TOGGLES ──────────────────────────────────────────────────────
window.saveFeatureToggle = async (feature, value) => {
  try {
    await setDoc(doc(db, "settings", "global"), { features: { [feature]: value } }, { merge:true });
    toast(`${feature} ${value?"enabled":"disabled"}`, "info");
  } catch(e) { toast("Error: " + e.message, "error"); }
};

// ─── TAB SWITCHING ────────────────────────────────────────────────────────
const tabTitles = {
  analytics: ["Analytics", "Platform overview"],
  users:     ["Users", "Manage user accounts"],
  projects:  ["Projects", "Manage all workspaces"],
  settings:  ["Settings", "Configure platform"],
};

window.switchTab = (tab) => {
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  document.getElementById("nav-"+tab)?.classList.add("active");
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById("section-"+tab)?.classList.add("active");
  const [title, sub] = tabTitles[tab] || [tab, ""];
  document.getElementById("topbarTitle").textContent = title;
  document.getElementById("topbarSub").textContent   = sub;

  if (tab === "users")    renderUsers();
  if (tab === "projects") renderProjects();
  if (tab === "analytics") renderAnalytics();
};

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────
let confirmCallback = null;
function showConfirm(title, msg, cb) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent   = msg;
  document.getElementById("confirmModal").style.display = "flex";
  confirmCallback = cb;
  document.getElementById("confirmOk").onclick = async () => {
    closeConfirm(); if (confirmCallback) await confirmCallback();
  };
}
window.closeConfirm = () => {
  document.getElementById("confirmModal").style.display = "none";
  confirmCallback = null;
};

// ─── TOAST ────────────────────────────────────────────────────────────────
function toast(msg, type="info") {
  const c = document.getElementById("toast-wrap");
  const t = document.createElement("div");
  const colors = { info:"#4F46E5", success:"#22C55E", error:"#EF4444", warn:"#F59E0B" };
  t.style.cssText = `display:flex;align-items:center;gap:10px;background:#111827;
    border:1px solid #1F2937;border-left:3px solid ${colors[type]||colors.info};
    color:#F9FAFB;padding:12px 16px;border-radius:10px;font-size:13px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;cursor:pointer;
    font-family:'Inter',sans-serif;max-width:300px`;
  t.textContent = msg; t.onclick = () => t.remove();
  c.appendChild(t); setTimeout(() => t.remove(), 4000);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
function escHtml(s) { const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
function emptyRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:var(--muted)">No data found</td></tr>`;
}
function timeAgo(d) {
  const s=Math.floor((Date.now()-d.getTime())/1000);
  if(s<60)return"just now"; if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`;
}
