/* ============================================
   KEXO AI — DASHBOARD JS
   Project management system
   ============================================ */

'use strict';

// ===== CONSTANTS =====
const PROJECTS_KEY = 'kexo_projects';
const THEME_KEY    = 'kexo_theme';

const COLOR_MAP = {
    indigo:  '#6366f1',
    violet:  '#8b5cf6',
    cyan:    '#06b6d4',
    emerald: '#10b981',
    amber:   '#f59e0b',
    rose:    '#f43f5e',
};

// ===== STATE =====
let projects = [];
let currentFilter = 'all';
let pendingDeleteId = null;
let pendingRenameId = null;
let selectedCreateColor = 'indigo';

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadProjects();
    renderProjects();
    updateStats();
    document.addEventListener('click', handleGlobalClick);
});

// ===== THEME =====
function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
}

// ===== PROJECT DATA =====
function loadProjects() {
    try {
        projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    } catch(e) {
        projects = [];
    }
}

function saveProjects() {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function setFilter(filter, el) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderProjects();
}

function getFilteredProjects() {
    if (currentFilter === 'recent') {
        return [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8);
    }
    return [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ===== RENDER =====
function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    const empty = document.getElementById('emptyState');
    const filtered = getFilteredProjects();

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = filtered.map((p, i) => buildCard(p, i)).join('');
}

function buildCard(p, idx) {
    const color = COLOR_MAP[p.color] || COLOR_MAP.indigo;
    const nodeCount = getProjectNodeCount(p.id);
    const connCount = getProjectConnCount(p.id);
    const date = p.updatedAt ? timeAgo(p.updatedAt) : 'Just created';

    return `
    <div class="project-card" style="--proj-color:${color}; animation-delay:${idx * 0.05}s"
         onclick="openProject('${p.id}')">
        <div class="card-canvas-preview">
            <div class="canvas-preview-nodes">
                <div class="preview-node preview-node-1" style="border-color:${color}30; background:${color}10"></div>
                <div class="preview-node preview-node-2" style="border-color:${color}30; background:${color}08"></div>
                <div class="preview-node preview-node-3" style="border-color:${color}30; background:${color}10"></div>
                <div class="preview-node preview-node-4" style="border-color:${color}30; background:${color}08"></div>
                <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 60 37 C 80 37, 90 32, 110 32" stroke="${color}" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
                    <path d="M 85 55 C 95 55, 105 60, 120 63" stroke="${color}" stroke-opacity="0.2" stroke-width="1.5" fill="none"/>
                </svg>
            </div>
        </div>
        <div class="card-body">
            <div class="card-name">${escHtml(p.name)}</div>
            <div class="card-meta">
                <span>${date}</span>
                <div class="card-dot"></div>
                <div class="card-stats">
                    <span class="card-stat">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>
                        ${nodeCount} nodes
                    </span>
                    <span class="card-stat">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        ${connCount} links
                    </span>
                </div>
            </div>
        </div>
        <div class="card-footer">
            <button class="card-open-btn" onclick="openProject('${p.id}'); event.stopPropagation()">
                Open Canvas
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <div style="position:relative">
                <button class="card-menu-btn" data-menu="${p.id}" onclick="toggleMenu('${p.id}', event)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
                </button>
                <div class="card-dropdown" id="menu-${p.id}">
                    <button class="dd-item" onclick="openProject('${p.id}'); event.stopPropagation()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Open
                    </button>
                    <button class="dd-item" onclick="openRenameModal('${p.id}'); event.stopPropagation()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Rename
                    </button>
                    <button class="dd-item" onclick="duplicateProject('${p.id}'); event.stopPropagation()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Duplicate
                    </button>
                    <button class="dd-item danger" onclick="openDeleteModal('${p.id}'); event.stopPropagation()">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

// ===== PROJECT ACTIONS =====
function openProject(id) {
    localStorage.setItem('kexo_active_project', id);
    window.location.href = `workspace.html?project=${id}`;
}

function duplicateProject(id) {
    closeAllMenus();
    const original = projects.find(p => p.id === id);
    if (!original) return;

    const newId = 'proj_' + Date.now();
    const copy = { ...original, id: newId, name: original.name + ' (Copy)', createdAt: Date.now(), updatedAt: Date.now() };
    projects.push(copy);

    // Copy canvas data
    const canvasData = localStorage.getItem(`kexo_canvas_${id}`);
    if (canvasData) localStorage.setItem(`kexo_canvas_${newId}`, canvasData);

    saveProjects();
    renderProjects();
    updateStats();
    showToast('Project duplicated');
}

// ===== CREATE MODAL =====
function openCreateModal() {
    document.getElementById('projectNameInput').value = '';
    selectedCreateColor = 'indigo';
    document.querySelectorAll('.cp-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === 'indigo');
    });
    document.getElementById('createModal').classList.add('open');
    setTimeout(() => document.getElementById('projectNameInput').focus(), 100);
}

function closeCreateModal(e) {
    if (e && e.target !== document.getElementById('createModal')) return;
    document.getElementById('createModal').classList.remove('open');
}

function selectColor(el, color) {
    selectedCreateColor = color;
    document.querySelectorAll('.cp-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
}

function confirmCreate() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) {
        document.getElementById('projectNameInput').focus();
        return;
    }

    const id = 'proj_' + Date.now();
    const project = {
        id,
        name,
        color: selectedCreateColor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeCount: 0,
        connectionCount: 0,
    };

    projects.unshift(project);
    saveProjects();
    document.getElementById('createModal').classList.remove('open');
    renderProjects();
    updateStats();
    showToast('Project created!');

    // Auto-open the new project
    setTimeout(() => openProject(id), 300);
}

// ===== RENAME MODAL =====
function openRenameModal(id) {
    closeAllMenus();
    pendingRenameId = id;
    const project = projects.find(p => p.id === id);
    if (!project) return;
    document.getElementById('renameInput').value = project.name;
    document.getElementById('renameModal').classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('renameInput');
        input.focus();
        input.select();
    }, 100);
}

function closeRenameModal(e) {
    if (e && e.target !== document.getElementById('renameModal')) return;
    document.getElementById('renameModal').classList.remove('open');
    pendingRenameId = null;
}

function confirmRename() {
    const name = document.getElementById('renameInput').value.trim();
    if (!name || !pendingRenameId) return;
    const idx = projects.findIndex(p => p.id === pendingRenameId);
    if (idx === -1) return;
    projects[idx].name = name;
    projects[idx].updatedAt = Date.now();
    saveProjects();
    document.getElementById('renameModal').classList.remove('open');
    pendingRenameId = null;
    renderProjects();
    showToast('Project renamed');
}

// ===== DELETE MODAL =====
function openDeleteModal(id) {
    closeAllMenus();
    pendingDeleteId = id;
    const project = projects.find(p => p.id === id);
    if (!project) return;
    document.getElementById('deleteProjectName').textContent = `"${project.name}"`;
    document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal(e) {
    if (e && e.target !== document.getElementById('deleteModal')) return;
    document.getElementById('deleteModal').classList.remove('open');
    pendingDeleteId = null;
}

function confirmDelete() {
    if (!pendingDeleteId) return;
    localStorage.removeItem(`kexo_canvas_${pendingDeleteId}`);
    projects = projects.filter(p => p.id !== pendingDeleteId);
    saveProjects();
    document.getElementById('deleteModal').classList.remove('open');
    pendingDeleteId = null;
    renderProjects();
    updateStats();
    showToast('Project deleted');
}

// ===== DROPDOWN MENUS =====
function toggleMenu(id, e) {
    e.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    const isOpen = menu.classList.contains('open');
    closeAllMenus();
    if (!isOpen) menu.classList.add('open');
}

function closeAllMenus() {
    document.querySelectorAll('.card-dropdown.open').forEach(m => m.classList.remove('open'));
}

function handleGlobalClick() {
    closeAllMenus();
}

// ===== STATS =====
function updateStats() {
    const total = projects.length;
    let totalNodes = 0, totalConns = 0;

    projects.forEach(p => {
        try {
            const data = JSON.parse(localStorage.getItem(`kexo_canvas_${p.id}`) || '{}');
            totalNodes += Object.keys(data.nodes || {}).length;
            totalConns += (data.connections || []).length;
        } catch(e) {}
    });

    animateNumber('statProjects', total);
    animateNumber('statNodes', totalNodes);
    animateNumber('statConns', totalConns);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(start + (target - start) * ease);
        if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ===== CANVAS DATA HELPERS =====
function getProjectNodeCount(id) {
    try {
        const data = JSON.parse(localStorage.getItem(`kexo_canvas_${id}`) || '{}');
        return Object.keys(data.nodes || {}).length;
    } catch(e) { return 0; }
}

function getProjectConnCount(id) {
    try {
        const data = JSON.parse(localStorage.getItem(`kexo_canvas_${id}`) || '{}');
        return (data.connections || []).length;
    } catch(e) { return 0; }
}

// ===== HELPERS =====
function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
