/* ============================================
   VIDFLOW AI — app.js
   Full canvas, nodes, connections, undo/redo
   ============================================ */

'use strict';

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
    snapToGrid: false,
    snapSize: 30,
};

// ===== YT PLAYER =====
let ytPlayer = null;
let tsInterval = null;

window.onYouTubeIframeAPIReady = function() {};

function loadVideo() {
    const url = document.getElementById('ytUrl').value.trim();
    const vid = extractVideoId(url);
    if (!vid) { showToast('Invalid YouTube URL'); return; }

    document.getElementById('videoEmpty').style.display = 'none';

    if (ytPlayer) {
        ytPlayer.loadVideoById(vid);
    } else {
        ytPlayer = new YT.Player('player', {
            height: '100%', width: '100%',
            videoId: vid,
            playerVars: { rel: 0, modestbranding: 1 },
            events: { onReady: onPlayerReady }
        });
    }
    document.getElementById('videoControls').style.display = 'flex';
}

function onPlayerReady(event) {
    tsInterval = setInterval(updateTimestamp, 500);
}

function updateTimestamp() {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    const t = Math.floor(ytPlayer.getCurrentTime());
    document.getElementById('timestampDisplay').textContent = formatTime(t);
}

function extractVideoId(url) {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
}

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function captureTimestamp() {
    const t = ytPlayer ? Math.floor(ytPlayer.getCurrentTime()) : 0;
    const vidId = ytPlayer ? ytPlayer.getVideoData().video_id : null;
    const thumb = vidId ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : null;
    addNode('snapshot', 'Video Snapshot', 'Captured from video. Click timestamp to jump back.', t, thumb);
    showToast('Snapshot captured!');
}

function jumpToTimestamp(secs) {
    if (!ytPlayer) return;
    ytPlayer.seekTo(secs, true);
    ytPlayer.playVideo();
}

// ===== NODES =====
function addNode(type = 'concept', title = 'New Concept', desc = '', timestamp = 0, imageUrl = null) {
    pushUndo();
    const id = 'node_' + (state.nextNodeId++);
    const scroll = document.getElementById('canvasScroll');
    const x = (scroll.scrollLeft / state.zoom) + 80 + Math.random() * 120;
    const y = (scroll.scrollTop / state.zoom) + 80 + Math.random() * 120;

    state.nodes[id] = { id, type, title, desc, x, y, w: 240, timestamp, imageUrl, color: 'default' };
    renderNode(id);
    saveData();
    closeFab();
}

function renderNode(id) {
    const n = state.nodes[id];
    const layer = document.getElementById('nodesLayer');

    let existing = document.getElementById(id);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = id;
    el.className = `node${n.color !== 'default' ? ' color-' + n.color : ''}${state.selectedNode === id ? ' selected' : ''}`;
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.width = n.w + 'px';

    const imgHtml = n.imageUrl ? `<img class="node-img" src="${n.imageUrl}" alt="capture" draggable="false" onerror="this.style.display='none'">` : '';

    el.innerHTML = `
        <div class="node-header">
            <span class="node-type ${n.type}">${n.type}</span>
            ${n.timestamp > 0 ? `<span class="node-timestamp" onclick="jumpToTimestamp(${n.timestamp})" title="Jump to ${formatTime(n.timestamp)}">⏱ ${formatTime(n.timestamp)}</span>` : ''}
            <div class="node-actions-top">
                <button class="node-btn connect-btn" onclick="startConnect('${id}')" title="Connect to another node">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button class="node-btn" onclick="openColorPicker('${id}', event)" title="Change color">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                </button>
                <button class="node-btn danger" onclick="deleteNode('${id}')" title="Delete node">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
            </div>
        </div>
        ${imgHtml}
        <div class="node-body">
            <div class="node-title" contenteditable="true" placeholder="Node title…" oninput="updateNodeField('${id}','title',this.innerText)" onmousedown="stopProp(event)">${escHtml(n.title)}</div>
            <div class="node-desc" contenteditable="true" placeholder="Add notes…" oninput="updateNodeField('${id}','desc',this.innerText)" onmousedown="stopProp(event)">${escHtml(n.desc)}</div>
        </div>
        <div class="node-connectors">
            <div class="connector-dot top"    data-node="${id}" data-side="top"    onmousedown="connectorDown(event,'${id}','top')"></div>
            <div class="connector-dot bottom" data-node="${id}" data-side="bottom" onmousedown="connectorDown(event,'${id}','bottom')"></div>
            <div class="connector-dot left"   data-node="${id}" data-side="left"   onmousedown="connectorDown(event,'${id}','left')"></div>
            <div class="connector-dot right"  data-node="${id}" data-side="right"  onmousedown="connectorDown(event,'${id}','right')"></div>
        </div>
        <div class="node-resize" data-resize="${id}" title="Resize"></div>
    `;

    layer.appendChild(el);
    makeDraggable(el, id);
    makeResizable(el, id);
    el.addEventListener('click', (e) => selectNode(id, e));
}

function updateNodeField(id, field, val) {
    if (state.nodes[id]) {
        state.nodes[id][field] = val;
        debounce(saveData, 600)();
    }
}

function deleteNode(id) {
    pushUndo();
    // Remove connections
    state.connections = state.connections.filter(c => {
        if (c.from === id || c.to === id) return false;
        return true;
    });
    delete state.nodes[id];
    const el = document.getElementById(id);
    if (el) el.remove();
    if (state.selectedNode === id) state.selectedNode = null;
    renderAllConnections();
    saveData();
    showToast('Node deleted');
}

function selectNode(id, e) {
    if (e && e.target.closest('[contenteditable]')) return;
    if (e && e.target.closest('.node-btn')) return;
    if (e && e.target.closest('.connector-dot')) return;
    if (e && e.target.closest('.node-resize')) return;

    if (state.connectMode && state.connectSource) {
        finishConnect(id);
        return;
    }

    // Deselect previous
    if (state.selectedNode && state.selectedNode !== id) {
        const prev = document.getElementById(state.selectedNode);
        if (prev) prev.classList.remove('selected');
    }
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
}

// ===== DRAG =====
function makeDraggable(el, id) {
    let ox, oy, ex, ey, dragging = false;

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onTouchDown, { passive: false });

    function onDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('[contenteditable]') ||
            e.target.closest('.node-btn') ||
            e.target.closest('.connector-dot') ||
            e.target.closest('.node-resize')) return;
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function onTouchDown(e) {
        if (e.target.closest('[contenteditable]') ||
            e.target.closest('.node-btn') ||
            e.target.closest('.connector-dot') ||
            e.target.closest('.node-resize')) return;
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchUp);
    }

    function startDrag(cx, cy) {
        dragging = true;
        ox = state.nodes[id].x;
        oy = state.nodes[id].y;
        ex = cx;
        ey = cy;
        el.classList.add('dragging');
        el.style.zIndex = 100;
    }

    function onMove(e) { move(e.clientX, e.clientY); }
    function onTouchMove(e) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }

    function move(cx, cy) {
        if (!dragging) return;
        const dx = (cx - ex) / state.zoom;
        const dy = (cy - ey) / state.zoom;
        let nx = ox + dx;
        let ny = oy + dy;
        if (state.snapToGrid) {
            nx = Math.round(nx / state.snapSize) * state.snapSize;
            ny = Math.round(ny / state.snapSize) * state.snapSize;
        }
        state.nodes[id].x = nx;
        state.nodes[id].y = ny;
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        updateConnectionsForNode(id);
        updateMinimap();
    }

    function onUp() {
        dragging = false;
        el.classList.remove('dragging');
        el.style.zIndex = 10;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveData();
    }
    function onTouchUp() {
        dragging = false;
        el.classList.remove('dragging');
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchUp);
        saveData();
    }
}

// ===== RESIZE =====
function makeResizable(el, id) {
    const handle = el.querySelector('.node-resize');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const startW = state.nodes[id].w;
        const startX = e.clientX;

        function onMove(ev) {
            const newW = Math.max(180, startW + (ev.clientX - startX) / state.zoom);
            state.nodes[id].w = newW;
            el.style.width = newW + 'px';
            updateConnectionsForNode(id);
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            saveData();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ===== CONNECTIONS =====
let connDragActive = false;
let connTempPath = null;
let connDragSource = null;

function connectorDown(e, nodeId, side) {
    e.stopPropagation();
    e.preventDefault();
    connDragActive = true;
    connDragSource = { nodeId, side };

    // Create temp SVG path
    const svg = document.getElementById('connectionsSvg');
    connTempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connTempPath.setAttribute('class', 'connection-path temp');
    svg.appendChild(connTempPath);

    document.addEventListener('mousemove', connDragMove);
    document.addEventListener('mouseup', connDragUp);
}

function connDragMove(e) {
    if (!connDragActive) return;
    const canvas = document.getElementById('canvasInfinite');
    const rect = canvas.getBoundingClientRect();
    const tx = (e.clientX - rect.left) / state.zoom;
    const ty = (e.clientY - rect.top) / state.zoom;

    const sp = getConnectorPos(connDragSource.nodeId, connDragSource.side);
    const d = buildPath(sp.x, sp.y, tx, ty, connDragSource.side, 'auto');
    if (connTempPath) connTempPath.setAttribute('d', d);
}

function connDragUp(e) {
    document.removeEventListener('mousemove', connDragMove);
    document.removeEventListener('mouseup', connDragUp);
    connDragActive = false;

    if (connTempPath) { connTempPath.remove(); connTempPath = null; }

    // Check if we dropped on a connector dot
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
    if (state.connectMode && state.connectSource === id) {
        cancelConnect(); return;
    }
    state.connectMode = true;
    state.connectSource = id;
    document.getElementById('connectIndicator').style.display = 'flex';
    // Highlight source
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
}

function finishConnect(toId) {
    if (!state.connectSource || toId === state.connectSource) {
        cancelConnect(); return;
    }
    createConnection(state.connectSource, 'bottom', toId, 'top');
    cancelConnect();
}

function cancelConnect() {
    state.connectMode = false;
    state.connectSource = null;
    document.getElementById('connectIndicator').style.display = 'none';
}

function createConnection(fromId, fromSide, toId, toSide) {
    // Prevent duplicates
    const exists = state.connections.find(c => c.from === fromId && c.to === toId);
    if (exists) return;
    pushUndo();
    const connId = 'conn_' + (state.nextConnId++);
    state.connections.push({ id: connId, from: fromId, fromSide, to: toId, toSide });
    renderAllConnections();
    saveData();
}

function deleteConnection(connId) {
    pushUndo();
    state.connections = state.connections.filter(c => c.id !== connId);
    renderAllConnections();
    saveData();
}

function renderAllConnections() {
    const svg = document.getElementById('connectionsSvg');
    // Remove all non-temp paths
    svg.querySelectorAll('.connection-path:not(.temp)').forEach(p => p.remove());

    state.connections.forEach(c => {
        if (!state.nodes[c.from] || !state.nodes[c.to]) return;
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path' + (state.selectedConnection === c.id ? ' selected' : ''));
        path.setAttribute('d', buildPath(sp.x, sp.y, ep.x, ep.y, c.fromSide, c.toSide));
        path.dataset.connId = c.id;
        path.addEventListener('click', () => {
            state.selectedConnection = c.id;
            renderAllConnections();
        });
        path.addEventListener('dblclick', () => deleteConnection(c.id));
        svg.appendChild(path);
    });
}

function updateConnectionsForNode(nodeId) {
    renderAllConnections();
}

function getConnectorPos(nodeId, side) {
    const n = state.nodes[nodeId];
    if (!n) return { x: 0, y: 0 };
    const el = document.getElementById(nodeId);
    const h = el ? el.offsetHeight : 100;
    const w = n.w;
    switch (side) {
        case 'top':    return { x: n.x + w / 2, y: n.y };
        case 'bottom': return { x: n.x + w / 2, y: n.y + h };
        case 'left':   return { x: n.x,         y: n.y + h / 2 };
        case 'right':  return { x: n.x + w,     y: n.y + h / 2 };
        default:       return { x: n.x + w / 2, y: n.y + h };
    }
}

function buildPath(x1, y1, x2, y2, fromSide, toSide) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const curve = Math.min(dist * 0.45, 120);

    let c1x = x1, c1y = y1, c2x = x2, c2y = y2;
    if (fromSide === 'bottom')  { c1y += curve; }
    else if (fromSide === 'top'){ c1y -= curve; }
    else if (fromSide === 'right'){ c1x += curve; }
    else if (fromSide === 'left') { c1x -= curve; }
    else { c1y += curve; }

    if (toSide === 'top')    { c2y -= curve; }
    else if (toSide === 'bottom'){ c2y += curve; }
    else if (toSide === 'left')  { c2x -= curve; }
    else if (toSide === 'right') { c2x += curve; }
    else { c2y -= curve; }

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

// ===== ZOOM =====
function zoomIn()  { setZoom(state.zoom + 0.1); }
function zoomOut() { setZoom(state.zoom - 0.1); }
function resetZoom() { setZoom(1); }

function setZoom(z) {
    state.zoom = Math.max(0.25, Math.min(2, Math.round(z * 10) / 10));
    const t = document.getElementById('canvasTransform');
    t.style.transform = `scale(${state.zoom})`;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    updateMinimap();
}

// Mouse wheel zoom on canvas
document.addEventListener('wheel', (e) => {
    const area = document.getElementById('canvasArea');
    if (!area.contains(e.target)) return;
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(state.zoom - e.deltaY * 0.001);
    }
}, { passive: false });

// ===== PAN (Space + drag) =====
let isPanning = false, panStartX, panStartY, panScrollX, panScrollY;
let spaceDown = false;

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('[contenteditable]')) {
        e.preventDefault();
        spaceDown = true;
        document.getElementById('canvasScroll').style.cursor = 'grab';
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.closest('[contenteditable]')) return;
        if (state.selectedNode) deleteNode(state.selectedNode);
        if (state.selectedConnection) deleteConnection(state.selectedConnection);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spaceDown = false;
        document.getElementById('canvasScroll').style.cursor = '';
    }
});

document.getElementById('canvasScroll').addEventListener('mousedown', (e) => {
    if (spaceDown) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollX = e.currentTarget.scrollLeft;
        panScrollY = e.currentTarget.scrollTop;
        e.currentTarget.style.cursor = 'grabbing';
        e.preventDefault();
    }
});
document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const scroll = document.getElementById('canvasScroll');
    scroll.scrollLeft = panScrollX - (e.clientX - panStartX);
    scroll.scrollTop = panScrollY - (e.clientY - panStartY);
    updateMinimap();
});
document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        document.getElementById('canvasScroll').style.cursor = '';
    }
});

// Click on canvas = deselect
document.getElementById('canvasInfinite').addEventListener('click', (e) => {
    if (e.target === e.currentTarget || e.target.id === 'connectionsSvg') {
        deselectAll();
        if (state.connectMode) cancelConnect();
        state.selectedConnection = null;
        renderAllConnections();
    }
});

// ===== GRID TOGGLE =====
function toggleGrid() {
    state.gridVisible = !state.gridVisible;
    const c = document.getElementById('canvasInfinite');
    c.classList.toggle('grid-lines', state.gridVisible);
    document.getElementById('gridBtn').style.color = state.gridVisible ? 'var(--accent)' : '';
}

// ===== FAB =====
function toggleFab() {
    const menu = document.getElementById('fabMenu');
    const btn = document.getElementById('fabMain');
    menu.classList.toggle('visible');
    btn.classList.toggle('open');
}
function closeFab() {
    document.getElementById('fabMenu').classList.remove('visible');
    document.getElementById('fabMain').classList.remove('open');
}

// ===== IMAGE UPLOAD =====
function uploadImageNode(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        addNode('image', 'Uploaded Image', '', 0, e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
}

// ===== COLOR PICKER =====
let colorPickerTarget = null;
function openColorPicker(nodeId, e) {
    e.stopPropagation();
    colorPickerTarget = nodeId;
    const popup = document.getElementById('colorPopup');
    popup.style.top = (e.clientY - 40) + 'px';
    popup.style.left = (e.clientX - 10) + 'px';
    popup.classList.add('visible');
    setTimeout(() => {
        document.addEventListener('click', closeColorPicker, { once: true });
    }, 10);
}
function closeColorPicker() {
    document.getElementById('colorPopup').classList.remove('visible');
}
function setNodeColor(color) {
    if (!colorPickerTarget) return;
    pushUndo();
    state.nodes[colorPickerTarget].color = color;
    renderNode(colorPickerTarget);
    closeColorPicker();
    saveData();
}

// ===== UNDO / REDO =====
function pushUndo() {
    const snapshot = JSON.stringify({ nodes: state.nodes, connections: state.connections });
    state.undoStack.push(snapshot);
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoButtons();
}

function undo() {
    if (!state.undoStack.length) return;
    const current = JSON.stringify({ nodes: state.nodes, connections: state.connections });
    state.redoStack.push(current);
    const prev = JSON.parse(state.undoStack.pop());
    applySnapshot(prev);
    updateUndoButtons();
    showToast('Undo');
}

function redo() {
    if (!state.redoStack.length) return;
    const current = JSON.stringify({ nodes: state.nodes, connections: state.connections });
    state.undoStack.push(current);
    const next = JSON.parse(state.redoStack.pop());
    applySnapshot(next);
    updateUndoButtons();
    showToast('Redo');
}

function applySnapshot(snap) {
    state.nodes = snap.nodes;
    state.connections = snap.connections;
    // Re-render all nodes
    document.getElementById('nodesLayer').innerHTML = '';
    Object.keys(state.nodes).forEach(id => renderNode(id));
    renderAllConnections();
    updateMinimap();
}

function updateUndoButtons() {
    document.getElementById('undoBtn').disabled = state.undoStack.length === 0;
    document.getElementById('redoBtn').disabled = state.redoStack.length === 0;
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        sidebar.classList.toggle('mobile-open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// ===== NOTEPAD =====
function formatText(cmd) {
    document.getElementById('notepad').focus();
    document.execCommand(cmd, false, null);
}
function insertHeading() {
    document.getElementById('notepad').focus();
    document.execCommand('formatBlock', false, 'h4');
}
function clearNotes() {
    if (confirm('Clear all notes?')) {
        document.getElementById('notepad').innerHTML = '';
        saveData();
    }
}
document.getElementById('notepad').addEventListener('input', debounce(saveData, 800));

// ===== EXPORT =====
async function exportCanvas() {
    showToast('Preparing export…');
    try {
        const target = document.getElementById('canvasInfinite');
        const canvas = await html2canvas(target, {
            backgroundColor: '#0f0f11',
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: target.scrollWidth,
            height: target.scrollHeight
        });
        const link = document.createElement('a');
        link.download = `vidflow-canvas-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Canvas exported!');
    } catch(e) {
        showToast('Export failed: ' + e.message);
    }
}

// ===== MINIMAP =====
function updateMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const CANVAS_W = 4000, CANVAS_H = 3000;
    const scaleX = W / CANVAS_W;
    const scaleY = H / CANVAS_H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#17171a';
    ctx.fillRect(0, 0, W, H);

    // Draw connections
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    state.connections.forEach(c => {
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        ctx.beginPath();
        ctx.moveTo(sp.x * scaleX, sp.y * scaleY);
        ctx.lineTo(ep.x * scaleX, ep.y * scaleY);
        ctx.stroke();
    });

    // Draw nodes
    Object.values(state.nodes).forEach(n => {
        const el = document.getElementById(n.id);
        const h = el ? el.offsetHeight : 80;
        const colors = {
            default: '#22222a',
            blue: '#1a2540',
            green: '#122820',
            amber: '#2a1f08',
            rose: '#2a0f15',
            violet: '#1d1630',
        };
        ctx.fillStyle = colors[n.color] || '#22222a';
        ctx.strokeStyle = n.id === state.selectedNode ? '#f5a623' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = n.id === state.selectedNode ? 1.5 : 0.5;
        const rx = n.x * scaleX, ry = n.y * scaleY;
        const rw = n.w * scaleX, rh = h * scaleY;
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 2);
        ctx.fill();
        ctx.stroke();
    });

    // Update viewport indicator
    const scroll = document.getElementById('canvasScroll');
    const vp = document.getElementById('minimapViewport');
    const vx = (scroll.scrollLeft / state.zoom) * scaleX;
    const vy = (scroll.scrollTop / state.zoom) * scaleY;
    const vw = (scroll.clientWidth / state.zoom) * scaleX;
    const vh = (scroll.clientHeight / state.zoom) * scaleY;
    vp.style.left = vx + 'px';
    vp.style.top = vy + 'px';
    vp.style.width = Math.min(vw, W - vx) + 'px';
    vp.style.height = Math.min(vh, H - vy) + 'px';
}

document.getElementById('canvasScroll').addEventListener('scroll', updateMinimap);

// ===== PERSIST =====
function saveData() {
    try {
        localStorage.setItem('vidflow_nodes', JSON.stringify(state.nodes));
        localStorage.setItem('vidflow_connections', JSON.stringify(state.connections));
        localStorage.setItem('vidflow_nextNodeId', state.nextNodeId);
        localStorage.setItem('vidflow_nextConnId', state.nextConnId);
        localStorage.setItem('vidflow_notes', document.getElementById('notepad').innerHTML);
    } catch (e) {}
}

function loadData() {
    try {
        const nodes = JSON.parse(localStorage.getItem('vidflow_nodes') || '{}');
        const conns = JSON.parse(localStorage.getItem('vidflow_connections') || '[]');
        const notes = localStorage.getItem('vidflow_notes');
        state.nodes = nodes;
        state.connections = conns;
        state.nextNodeId = parseInt(localStorage.getItem('vidflow_nextNodeId') || '1');
        state.nextConnId = parseInt(localStorage.getItem('vidflow_nextConnId') || '1');
        if (notes) document.getElementById('notepad').innerHTML = notes;

        Object.keys(state.nodes).forEach(id => renderNode(id));
        renderAllConnections();
    } catch (e) {}
}

// ===== HELPERS =====
function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stopProp(e) {
    e.stopPropagation();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ===== INIT =====
window.addEventListener('load', () => {
    loadData();

    // If no nodes loaded, create welcome node
    if (Object.keys(state.nodes).length === 0) {
        addNode('concept', 'Getting Started', 'Paste a YouTube URL in the header. Click + to add nodes. Drag connector dots to link ideas!', 0);
        addNode('question', 'What to Learn?', 'Click the timestamp icon to jump back to any moment in the video.', 0);
        setTimeout(() => {
            const ids = Object.keys(state.nodes);
            if (ids.length >= 2) {
                createConnection(ids[0], 'right', ids[1], 'left');
            }
        }, 100);
    }

    updateMinimap();
    updateUndoButtons();

    // Update minimap periodically
    setInterval(updateMinimap, 2000);

    // Initial scroll to center-ish
    const scroll = document.getElementById('canvasScroll');
    scroll.scrollLeft = 200;
    scroll.scrollTop = 100;
});
