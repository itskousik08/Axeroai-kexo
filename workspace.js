/* ============================================
   KEXO AI — WORKSPACE JS
   Infinite canvas, nodes, connections, undo/redo
   Project-based localStorage persistence
   ============================================ */

'use strict';

// ===== PROJECT ID (from URL) =====
const urlParams = new URLSearchParams(window.location.search);
const PROJECT_ID = urlParams.get('project') || 'default';
const CANVAS_KEY = `kexo_canvas_${PROJECT_ID}`;
const THEME_KEY  = 'kexo_theme';

// ===== STATE =====
let state = {
    nodes: {},
    connections: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    gridVisible: true,
    selectedNode: null,
    selectedConnection: null,
    connectMode: false,
    connectSource: null,
    undoStack: [],
    redoStack: [],
    nextNodeId: 1,
    nextConnId: 1,
};

// ===== DOM REFS =====
let viewport, transform, nodesLayer, svg;

// ===== INIT =====
window.addEventListener('load', () => {
    viewport   = document.getElementById('canvasViewport');
    transform  = document.getElementById('canvasTransform');
    nodesLayer = document.getElementById('nodesLayer');
    svg        = document.getElementById('connectionsSvg');

    applyTheme();
    loadProjectName();
    loadData();

    if (Object.keys(state.nodes).length === 0) {
        createWelcomeNodes();
    }

    applyTransform();
    renderAllConnections();
    updateUndoButtons();
    scheduleMinimapUpdate();
    setupEvents();
});

// ===== THEME =====
function applyTheme() {
    const theme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

// ===== PROJECT NAME =====
function loadProjectName() {
    try {
        const projects = JSON.parse(localStorage.getItem('kexo_projects') || '[]');
        const p = projects.find(p => p.id === PROJECT_ID);
        if (p) document.getElementById('projectNameDisplay').textContent = p.name;
    } catch(e) {}
}

// ===== CANVAS TRANSFORM (Infinite Pan/Zoom) =====
function applyTransform() {
    transform.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    updateGridOffset();
    scheduleMinimapUpdate();
}

function updateGridOffset() {
    viewport.style.setProperty('--grid-ox', (state.panX % 40) + 'px');
    viewport.style.setProperty('--grid-oy', (state.panY % 40) + 'px');
}

// ===== ZOOM =====
function zoomIn()    { setZoomAt(state.zoom + 0.1, viewport.clientWidth / 2, viewport.clientHeight / 2); }
function zoomOut()   { setZoomAt(state.zoom - 0.1, viewport.clientWidth / 2, viewport.clientHeight / 2); }
function resetZoom() { state.panX = 0; state.panY = 0; setZoomAt(1, 0, 0); }

function setZoomAt(newZoom, cx, cy) {
    newZoom = Math.max(0.1, Math.min(3, Math.round(newZoom * 20) / 20));
    const scale = newZoom / state.zoom;
    state.panX = cx - scale * (cx - state.panX);
    state.panY = cy - scale * (cy - state.panY);
    state.zoom = newZoom;
    applyTransform();
}

// ===== PAN =====
let isPanning = false, panStartX, panStartY, panStartPX, panStartPY;
let spaceDown = false;

function setupEvents() {
    // Wheel zoom (cursor-centered)
    viewport.addEventListener('wheel', onWheel, { passive: false });

    // Middle mouse or space+drag pan
    viewport.addEventListener('mousedown', onViewportMousedown);
    document.addEventListener('mousemove', onGlobalMousemove);
    document.addEventListener('mouseup', onGlobalMouseup);

    // Click canvas background to deselect
    viewport.addEventListener('click', (e) => {
        if (e.target === viewport || e.target === transform || e.target === nodesLayer) {
            deselectAll();
        }
    });

    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spaceDown = false;
            if (!isPanning) viewport.classList.remove('space-pan');
        }
    });
}

function onWheel(e) {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const delta = e.deltaY * -0.001;
    setZoomAt(state.zoom + delta, cx, cy);
}

function onViewportMousedown(e) {
    // Middle mouse or space+left drag = pan
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartPX = state.panX;
        panStartPY = state.panY;
        viewport.classList.add('grabbing');
    }
}

function onGlobalMousemove(e) {
    if (isPanning) {
        state.panX = panStartPX + (e.clientX - panStartX);
        state.panY = panStartPY + (e.clientY - panStartY);
        applyTransform();
    }
    if (connDragActive) connDragMove(e);
}

function onGlobalMouseup(e) {
    if (isPanning) {
        isPanning = false;
        viewport.classList.remove('grabbing');
    }
    if (connDragActive) connDragUp(e);
}

function onKeyDown(e) {
    if (e.code === 'Space' && !e.target.closest('[contenteditable]')) {
        e.preventDefault();
        spaceDown = true;
        if (!isPanning) viewport.classList.add('space-pan');
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('[contenteditable]')) {
        if (state.selectedNode) deleteNode(state.selectedNode);
        else if (state.selectedConnection) deleteConnection(state.selectedConnection);
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    // Shortcut keys to add nodes
    if (!e.ctrlKey && !e.metaKey && !e.target.closest('[contenteditable]')) {
        if (e.key === 'n' || e.key === 'N') addNode('note');
        if (e.key === 'c' || e.key === 'C') addNode('concept');
        if (e.key === 'q' || e.key === 'Q') addNode('question');
    }
}

// ===== GRID TOGGLE =====
function toggleGrid() {
    state.gridVisible = !state.gridVisible;
    viewport.classList.toggle('grid-off', !state.gridVisible);
    document.getElementById('gridBtn').classList.toggle('active', state.gridVisible);
}

// ===== ADD NODE =====
function addNode(type = 'concept', title = null, desc = '', x = null, y = null, imageUrl = null) {
    pushUndo();
    const id = 'node_' + state.nextNodeId++;

    // Center in current viewport if no coords given
    if (x === null) {
        x = (-state.panX + viewport.clientWidth  / 2) / state.zoom - 120 + (Math.random() - 0.5) * 100;
        y = (-state.panY + viewport.clientHeight / 2) / state.zoom - 60  + (Math.random() - 0.5) * 80;
    }

    const defaultTitles = { note: 'New Note', concept: 'New Concept', question: 'New Question', image: 'Image' };
    state.nodes[id] = {
        id, type,
        title: title || defaultTitles[type] || 'Node',
        desc, x, y, w: 250, color: 'default', imageUrl
    };

    renderNode(id);
    debouncedSave();
    closeFab();
    scheduleMinimapUpdate();
    return id;
}

// ===== RENDER NODE =====
function renderNode(id) {
    const n = state.nodes[id];
    const layer = nodesLayer;

    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = id;
    const colorClass = n.color !== 'default' ? ` color-${n.color}` : '';
    const selectedClass = state.selectedNode === id ? ' selected' : '';
    el.className = `node${colorClass}${selectedClass}`;
    el.style.cssText = `left:${n.x}px; top:${n.y}px; width:${n.w}px; z-index:10;`;

    const imgHtml = n.imageUrl
        ? `<img class="node-img" src="${n.imageUrl}" alt="node image" draggable="false" onerror="this.style.display='none'">`
        : '';

    el.innerHTML = `
        <div class="node-header">
            <span class="node-type ${n.type}">${n.type}</span>
            <div class="node-actions-top">
                <button class="node-btn connect" onclick="startConnect('${id}')" title="Connect">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button class="node-btn" onclick="openColorPicker('${id}', event)" title="Color">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                </button>
                <button class="node-btn danger" onclick="deleteNode('${id}')" title="Delete">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
            </div>
        </div>
        ${imgHtml}
        <div class="node-body">
            <div class="node-title" contenteditable="true" placeholder="Node title…"
                oninput="onNodeFieldInput('${id}','title',this)"
                onmousedown="event.stopPropagation()">${escHtml(n.title)}</div>
            <div class="node-desc" contenteditable="true" placeholder="Add notes…"
                oninput="onNodeFieldInput('${id}','desc',this)"
                onmousedown="event.stopPropagation()">${escHtml(n.desc)}</div>
        </div>
        <div class="node-connectors">
            <div class="connector-dot top"    data-node="${id}" data-side="top"    onmousedown="connectorDown(event,'${id}','top')"></div>
            <div class="connector-dot bottom" data-node="${id}" data-side="bottom" onmousedown="connectorDown(event,'${id}','bottom')"></div>
            <div class="connector-dot left"   data-node="${id}" data-side="left"   onmousedown="connectorDown(event,'${id}','left')"></div>
            <div class="connector-dot right"  data-node="${id}" data-side="right"  onmousedown="connectorDown(event,'${id}','right')"></div>
        </div>
        <div class="node-resize" onmousedown="resizeStart(event,'${id}')"></div>
    `;

    layer.appendChild(el);
    makeDraggable(el, id);
    el.addEventListener('click', (e) => {
        if (e.target.closest('[contenteditable]') || e.target.closest('.node-btn') ||
            e.target.closest('.connector-dot') || e.target.closest('.node-resize')) return;
        if (state.connectMode && state.connectSource) { finishConnect(id); return; }
        selectNode(id);
    });
}

function onNodeFieldInput(id, field, el) {
    if (state.nodes[id]) {
        state.nodes[id][field] = el.innerText;
        debouncedSave();
    }
}

// ===== SELECT / DESELECT =====
function selectNode(id) {
    if (state.selectedNode && state.selectedNode !== id) {
        const prev = document.getElementById(state.selectedNode);
        if (prev) prev.classList.remove('selected');
    }
    deselectConnection();
    state.selectedNode = id;
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
}

function deselectAll() {
    if (state.selectedNode) {
        const el = document.getElementById(state.selectedNode);
        if (el) el.classList.remove('selected');
        state.selectedNode = null;
    }
    deselectConnection();
    if (state.connectMode) cancelConnect();
}

// ===== DRAG NODES =====
function makeDraggable(el, id) {
    let dragging = false, ox, oy, ex, ey;

    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('[contenteditable]') || e.target.closest('.node-btn') ||
            e.target.closest('.connector-dot') || e.target.closest('.node-resize')) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        ox = state.nodes[id].x; oy = state.nodes[id].y;
        ex = e.clientX; ey = e.clientY;
        el.classList.add('dragging');
        el.style.zIndex = 100;
        pushUndo();

        function onMove(ev) {
            if (!dragging) return;
            const dx = (ev.clientX - ex) / state.zoom;
            const dy = (ev.clientY - ey) / state.zoom;
            state.nodes[id].x = ox + dx;
            state.nodes[id].y = oy + dy;
            el.style.left = state.nodes[id].x + 'px';
            el.style.top  = state.nodes[id].y + 'px';
            renderAllConnections();
            scheduleMinimapUpdate();
        }

        function onUp() {
            dragging = false;
            el.classList.remove('dragging');
            el.style.zIndex = 10;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            debouncedSave();
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ===== RESIZE =====
function resizeStart(e, id) {
    e.stopPropagation();
    e.preventDefault();
    const startW = state.nodes[id].w;
    const startX = e.clientX;
    const el = document.getElementById(id);

    function onMove(ev) {
        const newW = Math.max(180, startW + (ev.clientX - startX) / state.zoom);
        state.nodes[id].w = newW;
        el.style.width = newW + 'px';
        renderAllConnections();
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        debouncedSave();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// ===== DELETE NODE =====
function deleteNode(id) {
    pushUndo();
    state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
    delete state.nodes[id];
    const el = document.getElementById(id);
    if (el) el.remove();
    if (state.selectedNode === id) state.selectedNode = null;
    renderAllConnections();
    debouncedSave();
    scheduleMinimapUpdate();
    showToast('Node deleted');
}

// ===== CONNECTIONS =====
let connDragActive = false, connTempPath = null, connDragSource = null;

function connectorDown(e, nodeId, side) {
    e.stopPropagation();
    e.preventDefault();
    connDragActive = true;
    connDragSource = { nodeId, side };

    connTempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connTempPath.setAttribute('class', 'connection-path temp');
    svg.appendChild(connTempPath);
}

function connDragMove(e) {
    if (!connDragActive || !connTempPath) return;
    const rect = viewport.getBoundingClientRect();
    const tx = (e.clientX - rect.left - state.panX) / state.zoom;
    const ty = (e.clientY - rect.top  - state.panY) / state.zoom;
    const sp = getConnectorPos(connDragSource.nodeId, connDragSource.side);
    connTempPath.setAttribute('d', buildCurve(sp.x, sp.y, tx, ty));
}

function connDragUp(e) {
    connDragActive = false;
    if (connTempPath) { connTempPath.remove(); connTempPath = null; }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('connector-dot')) {
        const toNode = target.dataset.node;
        const toSide = target.dataset.side;
        if (toNode && toNode !== connDragSource.nodeId) {
            createConnection(connDragSource.nodeId, connDragSource.side, toNode, toSide);
        }
    }
    connDragSource = null;
}

function startConnect(id) {
    if (state.connectMode && state.connectSource === id) { cancelConnect(); return; }
    state.connectMode = true;
    state.connectSource = id;
    const ind = document.getElementById('connectIndicator');
    ind.style.display = 'flex';
    selectNode(id);
}

function finishConnect(toId) {
    if (!state.connectSource || toId === state.connectSource) { cancelConnect(); return; }
    createConnection(state.connectSource, 'right', toId, 'left');
    cancelConnect();
}

function cancelConnect() {
    state.connectMode = false;
    state.connectSource = null;
    document.getElementById('connectIndicator').style.display = 'none';
}

function createConnection(fromId, fromSide, toId, toSide) {
    const exists = state.connections.find(c =>
        (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
    if (exists) { showToast('Already connected'); return; }

    pushUndo();
    const id = 'conn_' + state.nextConnId++;
    state.connections.push({ id, from: fromId, fromSide, to: toId, toSide });
    renderAllConnections();
    debouncedSave();
}

function renderAllConnections() {
    // Remove all non-temp paths
    svg.querySelectorAll('.connection-path:not(.temp), .connection-hit').forEach(p => p.remove());

    state.connections.forEach(c => {
        if (!state.nodes[c.from] || !state.nodes[c.to]) return;
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        const d = buildCurve(sp.x, sp.y, ep.x, ep.y);

        // Hit area (invisible, wider)
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'connection-hit');
        hit.setAttribute('d', d);
        hit.dataset.connId = c.id;
        hit.addEventListener('click', (e) => { e.stopPropagation(); selectConnection(c.id); });
        svg.appendChild(hit);

        // Visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path' + (state.selectedConnection === c.id ? ' selected' : ''));
        path.setAttribute('d', d);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.dataset.connId = c.id;
        svg.appendChild(path);
    });
}

function selectConnection(connId) {
    deselectAll();
    state.selectedConnection = connId;
    renderAllConnections();
    const ind = document.getElementById('unlinkIndicator');
    ind.style.display = 'flex';
}

function deselectConnection() {
    if (state.selectedConnection) {
        state.selectedConnection = null;
        renderAllConnections();
    }
    document.getElementById('unlinkIndicator').style.display = 'none';
}

function deleteConnection(connId) {
    pushUndo();
    state.connections = state.connections.filter(c => c.id !== connId);
    state.selectedConnection = null;
    renderAllConnections();
    document.getElementById('unlinkIndicator').style.display = 'none';
    debouncedSave();
    showToast('Connection removed');
}

function unlinkSelected() {
    if (state.selectedConnection) deleteConnection(state.selectedConnection);
}

function getConnectorPos(nodeId, side) {
    const n = state.nodes[nodeId];
    if (!n) return { x: 0, y: 0 };
    const el = document.getElementById(nodeId);
    const h = el ? el.offsetHeight : 100;
    const w = n.w;
    switch(side) {
        case 'top':    return { x: n.x + w / 2, y: n.y };
        case 'bottom': return { x: n.x + w / 2, y: n.y + h };
        case 'left':   return { x: n.x,         y: n.y + h / 2 };
        case 'right':  return { x: n.x + w,     y: n.y + h / 2 };
        default:       return { x: n.x + w / 2, y: n.y + h };
    }
}

function buildCurve(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const curve = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.4, 140);
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

// ===== COLOR PICKER =====
let colorTarget = null;

function openColorPicker(nodeId, e) {
    e.stopPropagation();
    colorTarget = nodeId;
    const popup = document.getElementById('colorPopup');
    popup.style.top  = (e.clientY - 50) + 'px';
    popup.style.left = (e.clientX - 10) + 'px';
    popup.classList.add('visible');
    setTimeout(() => document.addEventListener('click', closeColorPicker, { once: true }), 10);
}

function closeColorPicker() {
    document.getElementById('colorPopup').classList.remove('visible');
    colorTarget = null;
}

function setNodeColor(color) {
    if (!colorTarget) return;
    pushUndo();
    state.nodes[colorTarget].color = color;
    renderNode(colorTarget);
    closeColorPicker();
    debouncedSave();
}

// ===== FAB =====
function toggleFab() {
    const menu = document.getElementById('fabMenu');
    const btn  = document.getElementById('fabMain');
    const open = menu.classList.toggle('visible');
    btn.classList.toggle('open', open);
}

function closeFab() {
    document.getElementById('fabMenu').classList.remove('visible');
    document.getElementById('fabMain').classList.remove('open');
}

// ===== IMAGE UPLOAD =====
function uploadImageNode(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => addNode('image', 'Image', '', null, null, e.target.result);
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.getElementById('wsSidebar');
    sidebar.classList.toggle('collapsed');
}

// ===== UNDO / REDO =====
function pushUndo() {
    const snap = JSON.stringify({
        nodes: state.nodes,
        connections: state.connections,
        nextNodeId: state.nextNodeId,
        nextConnId: state.nextConnId,
    });
    state.undoStack.push(snap);
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoButtons();
}

function undo() {
    if (!state.undoStack.length) return;
    const cur = JSON.stringify({ nodes: state.nodes, connections: state.connections, nextNodeId: state.nextNodeId, nextConnId: state.nextConnId });
    state.redoStack.push(cur);
    applySnapshot(JSON.parse(state.undoStack.pop()));
    updateUndoButtons();
    showToast('Undo');
}

function redo() {
    if (!state.redoStack.length) return;
    const cur = JSON.stringify({ nodes: state.nodes, connections: state.connections, nextNodeId: state.nextNodeId, nextConnId: state.nextConnId });
    state.undoStack.push(cur);
    applySnapshot(JSON.parse(state.redoStack.pop()));
    updateUndoButtons();
    showToast('Redo');
}

function applySnapshot(snap) {
    state.nodes = snap.nodes;
    state.connections = snap.connections;
    state.nextNodeId = snap.nextNodeId;
    state.nextConnId = snap.nextConnId;
    nodesLayer.innerHTML = '';
    Object.keys(state.nodes).forEach(id => renderNode(id));
    renderAllConnections();
    scheduleMinimapUpdate();
}

function updateUndoButtons() {
    document.getElementById('undoBtn').disabled = state.undoStack.length === 0;
    document.getElementById('redoBtn').disabled = state.redoStack.length === 0;
}

// ===== MINIMAP =====
let minimapTimer = null;
function scheduleMinimapUpdate() {
    clearTimeout(minimapTimer);
    minimapTimer = setTimeout(updateMinimap, 40);
}

function updateMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#0f0f1a';
    ctx.fillRect(0, 0, W, H);

    // Find bounds of all nodes
    const ns = Object.values(state.nodes);
    if (ns.length === 0) return;

    const minX = Math.min(...ns.map(n => n.x)) - 50;
    const minY = Math.min(...ns.map(n => n.y)) - 50;
    const maxX = Math.max(...ns.map(n => n.x + n.w)) + 50;
    const maxY = Math.max(...ns.map(n => n.y + (document.getElementById(n.id)?.offsetHeight || 100))) + 50;

    const rangeX = Math.max(maxX - minX, 400);
    const rangeY = Math.max(maxY - minY, 300);
    const scaleX = W / rangeX;
    const scaleY = H / rangeY;

    // Draw connections
    ctx.strokeStyle = 'rgba(130,130,200,0.3)';
    ctx.lineWidth = 1;
    state.connections.forEach(c => {
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        ctx.beginPath();
        ctx.moveTo((sp.x - minX) * scaleX, (sp.y - minY) * scaleY);
        ctx.lineTo((ep.x - minX) * scaleX, (ep.y - minY) * scaleY);
        ctx.stroke();
    });

    // Draw nodes
    ns.forEach(n => {
        const el = document.getElementById(n.id);
        const h = el ? el.offsetHeight : 80;
        ctx.fillStyle = n.id === state.selectedNode ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)';
        ctx.strokeStyle = n.id === state.selectedNode ? '#6366f1' : 'rgba(130,130,200,0.3)';
        ctx.lineWidth = 0.5;
        const rx = (n.x - minX) * scaleX;
        const ry = (n.y - minY) * scaleY;
        const rw = n.w * scaleX;
        const rh = h * scaleY;
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 2);
        ctx.fill();
        ctx.stroke();
    });

    // Viewport rect
    const vx = (-state.panX / state.zoom - minX) * scaleX;
    const vy = (-state.panY / state.zoom - minY) * scaleY;
    const vw = (viewport.clientWidth  / state.zoom) * scaleX;
    const vh = (viewport.clientHeight / state.zoom) * scaleY;
    ctx.strokeStyle = 'rgba(99,102,241,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
}

// ===== EXPORT =====
async function exportCanvas() {
    showSaveStatus('saving');
    try {
        const target = nodesLayer.parentElement;
        const canvas = await html2canvas(target, {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
            scale: 1.5, useCORS: true, logging: false
        });
        const link = document.createElement('a');
        link.download = `kexo-canvas-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Canvas exported!');
    } catch(e) { showToast('Export failed'); }
    showSaveStatus('saved');
}

// ===== PERSISTENCE =====
let saveTimer = null;
function debouncedSave() {
    showSaveStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveData(); showSaveStatus('saved'); }, 800);
}

function saveData() {
    try {
        const data = {
            nodes: state.nodes,
            connections: state.connections,
            nextNodeId: state.nextNodeId,
            nextConnId: state.nextConnId,
            zoom: state.zoom,
            panX: state.panX,
            panY: state.panY,
        };
        localStorage.setItem(CANVAS_KEY, JSON.stringify(data));
        updateProjectStats();
    } catch(e) {}
}

function loadData() {
    try {
        const raw = localStorage.getItem(CANVAS_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        state.nodes = data.nodes || {};
        state.connections = data.connections || [];
        state.nextNodeId = data.nextNodeId || 1;
        state.nextConnId = data.nextConnId || 1;
        if (data.zoom) state.zoom = data.zoom;
        if (data.panX !== undefined) state.panX = data.panX;
        if (data.panY !== undefined) state.panY = data.panY;
        Object.keys(state.nodes).forEach(id => renderNode(id));
    } catch(e) {}
}

function updateProjectStats() {
    try {
        const projects = JSON.parse(localStorage.getItem('kexo_projects') || '[]');
        const idx = projects.findIndex(p => p.id === PROJECT_ID);
        if (idx !== -1) {
            projects[idx].nodeCount = Object.keys(state.nodes).length;
            projects[idx].connectionCount = state.connections.length;
            projects[idx].updatedAt = Date.now();
            localStorage.setItem('kexo_projects', JSON.stringify(projects));
        }
    } catch(e) {}
}

function createWelcomeNodes() {
    const vw = viewport.clientWidth || 800;
    const vh = viewport.clientHeight || 600;
    const cx = vw / 2;
    const cy = vh / 2;

    const id1 = addNode('concept', 'Welcome to Kexo AI', 'This is your infinite canvas. Drag nodes, zoom with scroll, connect ideas with the dots on each node.', cx - 280, cy - 80);
    const id2 = addNode('question', 'How to start?', 'Click the + button or use keyboard shortcuts N, C, Q to add new nodes.', cx + 50, cy - 60);
    const id3 = addNode('note', 'Pro tip', 'Use Space + drag to pan. Connect nodes by dragging from the colored dots. Select a connection to unlink.', cx - 150, cy + 120);

    setTimeout(() => {
        if (state.nodes[id1] && state.nodes[id2]) createConnection(id1, 'right', id2, 'left');
        if (state.nodes[id1] && state.nodes[id3]) createConnection(id1, 'bottom', id3, 'top');
        saveData();
    }, 100);
}

// ===== SAVE STATUS =====
function showSaveStatus(status) {
    const el = document.getElementById('saveStatus');
    el.className = 'save-status ' + status;
    el.innerHTML = status === 'saving'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Saving…</span>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Saved</span>';
}

// ===== HELPERS =====
function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
