/**
 * KEXO AI — api.js
 * Cloudinary + misc API helpers
 */

// ─── CLOUDINARY UPLOAD (reusable) ────────────────────────────────────────────
async function cloudinaryUpload(file, onProgress) {
  const { uploadToCloudinary } = window.KexoFirebase;
  if (!file) throw new Error("No file provided");

  // Size limit: 25MB
  if (file.size > 25 * 1024 * 1024) throw new Error("File too large (max 25 MB)");

  return await uploadToCloudinary(file);
}

// ─── PICK FILE ───────────────────────────────────────────────────────────────
function pickFile(accept = "*/*") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

// ─── EXPORT PROJECT JSON ─────────────────────────────────────────────────────
function exportProjectJSON(project) {
  const data = {
    _export_version: "2.0",
    _exported_at:    new Date().toISOString(),
    id:              project.id,
    name:            project.name,
    nodes:           project.nodes  || {},
    links:           project.links  || [],
    metadata: {
      createdAt: project.createdAt,
      createdBy: project.createdBy,
      members:   project.members,
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${(project.name || "project").replace(/\s+/g,"-")}-kexo.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── FORMAT DATE ─────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function timeAgo(ts) {
  if (!ts) return "—";
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)   return "just now";
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400)return `${Math.floor(sec/3600)}h ago`;
  return `${Math.floor(sec/86400)}d ago`;
}

window.KexoAPI = { cloudinaryUpload, pickFile, exportProjectJSON, formatDate, timeAgo };
