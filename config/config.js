/**
 * KEXO AI — Global Config
 * Replace firebaseConfig values with your Firebase project credentials
 */

const KEXO_CONFIG = {
  // ─── FIREBASE ────────────────────────────────────────────────
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // ─── ADMIN ───────────────────────────────────────────────────
  // Add your Firebase UID here to grant admin access
  adminUID: "YOUR_ADMIN_UID_HERE",

  // ─── APP META ────────────────────────────────────────────────
  appName: "Kexo AI",
  version: "2.0.0",
  baseURL: window.location.origin
};
