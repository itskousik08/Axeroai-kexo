/**
 * KEXO AI — firebase.js
 * Firebase initialization + shared DB helpers
 */

// ─── INIT ────────────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc, orderBy,
  serverTimestamp, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app    = initializeApp(KEXO_CONFIG.firebase);
const auth   = getAuth(app);
const db     = getFirestore(app);
const gProvider = new GoogleAuthProvider();

// ─── UID GENERATOR ───────────────────────────────────────────────────────────
function generateKexoUID() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// ─── USER HELPERS ─────────────────────────────────────────────────────────────
async function getUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function createUserDoc(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const kexoUID = generateKexoUID();
    await setDoc(ref, {
      firstName:  extra.firstName || user.displayName?.split(" ")[0] || "",
      lastName:   extra.lastName  || user.displayName?.split(" ").slice(1).join(" ") || "",
      email:      user.email,
      photoURL:   user.photoURL || "",
      kexoUID,
      createdAt:  serverTimestamp(),
      blocked:    false,
    });
    return kexoUID;
  }
  return snap.data().kexoUID;
}

// ─── CLOUDINARY HELPERS ──────────────────────────────────────────────────────
async function getCloudinaryConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) return snap.data().cloudinary || null;
  } catch (_) {}
  return null;
}

async function uploadToCloudinary(file) {
  const cfg = await getCloudinaryConfig();
  if (!cfg || !cfg.cloud_name || !cfg.upload_preset) {
    throw new Error("Cloudinary not configured. Ask admin to set it up.");
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", cfg.upload_preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud_name}/auto/upload`, {
    method: "POST", body: fd
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}

// ─── PROJECT HELPERS ─────────────────────────────────────────────────────────
async function getProjects(uid) {
  const q = query(
    collection(db, "projects"),
    where("members", "array-contains", uid),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createProject(uid, name) {
  const ref = await addDoc(collection(db, "projects"), {
    name,
    members:   [uid],
    roles:     { [uid]: "owner" },
    nodes:     {},
    links:     [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
  return ref.id;
}

async function deleteProject(projectId) {
  await deleteDoc(doc(db, "projects", projectId));
}

async function saveProject(projectId, data) {
  await updateDoc(doc(db, "projects", projectId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// ─── INVITE HELPERS ──────────────────────────────────────────────────────────
async function findUserByKexoUID(kexoUID) {
  const q = query(collection(db, "users"), where("kexoUID", "==", kexoUID), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function sendInvite(toUID, projectId, fromUID) {
  await addDoc(collection(db, "invites"), {
    toUID, projectId, fromUID,
    status:    "pending",
    createdAt: serverTimestamp()
  });
}

async function getMyInvites(uid) {
  const q = query(collection(db, "invites"), where("toUID", "==", uid), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function acceptInvite(inviteId, projectId, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, "invites", inviteId), { status: "accepted" });
  const pRef = doc(db, "projects", projectId);
  const pSnap = await getDoc(pRef);
  if (pSnap.exists()) {
    const d = pSnap.data();
    const members = [...(d.members || [])];
    if (!members.includes(uid)) members.push(uid);
    const roles = { ...(d.roles || {}), [uid]: "editor" };
    batch.update(pRef, { members, roles });
  }
  await batch.commit();
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────
window.KexoFirebase = {
  auth, db, gProvider,
  onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, getDocs, addDoc, orderBy, serverTimestamp, limit, writeBatch,
  // helpers
  getUserData, createUserDoc, generateKexoUID,
  uploadToCloudinary, getCloudinaryConfig,
  getProjects, createProject, deleteProject, saveProject,
  findUserByKexoUID, sendInvite, getMyInvites, acceptInvite,
};
