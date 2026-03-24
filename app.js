/* ============================================
   KEXO AI — app.js
   All bugs fixed, all features upgraded
   ============================================ */

'use strict';

// ===== STATE =====
let state = {
    nodes: {},
    connections: [],
    zoom: 1,
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
            height: '100%', width: '100%', videoId: vid,
            playerVars: { rel: 0, modestbranding: 1 },
            events: { onReady: () => setInterval(updateTimestamp, 500) }
        });
    }
    document.getElementById('videoControls').style.display = 'flex';
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
    const m = Math.floor(secs / 60), s = secs % 60;
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

// ===== VIDEO PANEL TOGGLE =====
function toggleVideoPanel() {
    const section = document.getElementById('videoSection');
    const btn = document.getElementById('videoToggleBtn');
    const hidden = section.classList.toggle('video-hidden');
    if (btn) {
        btn.classList.toggle('video-off', hidden);
        const lbl = btn.querySelector('.vt-label');
        if (lbl) lbl.textContent = hidden ? 'Show Video' : 'Hide Video';
        const iconHide = btn.querySelector('.vt-icon-hide');
        const iconShow = btn.querySelector('.vt-icon-show');
        if (iconHide) iconHide.style.display = hidden ? 'none' : '';
        if (iconShow) iconShow.style.display = hidden ? '' : 'none';
    }
    setTimeout(() => resizeDrawingCanvas(), 380);
}

// ===== NODES =====
function addNode(type = 'concept', title = 'New Concept', desc = '', timestamp = 0, imageUrl = null) {
    pushUndo();
    const id = 'node_' + (state.nextNodeId++);
    const scroll = document.getElementById('canvasScroll');
    const x = (scroll.scrollLeft / state.zoom) + 80 + Math.random() * 120;
    const y = (scroll.scrollTop  / state.zoom) + 80 + Math.random() * 120;
    state.nodes[id] = { id, type, title, desc, x, y, w: 240, timestamp, imageUrl, color: 'default' };
    renderNode(id);
    saveData();
    closeFab();
}

/* ---------------------------------------------------------------
   renderNode — unified renderer
   FIX #1: Text nodes now render as a proper boxed node (no more
            transparent floating text). isTextNode → standard box.
   FIX #2: Normal nodes always show header. Media nodes (image/PDF)
            hide header by default; reveal on hover or selection.
   FIX #4/#5: Images/PDFs default 300px wide with +/- size buttons.
   --------------------------------------------------------------- */
function renderNode(id) {
    const n = state.nodes[id];
    const layer = document.getElementById('nodesLayer');
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const isMedia = n.isFreeImage || n.isPdfNode;
    const el = document.createElement('div');

    el.id = id;
    el.className = [
        'node',
        isMedia ? 'node-media' : '',
        n.color !== 'default' ? 'color-' + n.color : '',
        state.selectedNode === id ? 'selected' : ''
    ].filter(Boolean).join(' ');

    el.style.left  = n.x + 'px';
    el.style.top   = n.y + 'px';
    el.style.width = n.w + 'px';
    if (isMedia && n.h) el.style.height = n.h + 'px';

    // ---- Header controls (always visible for normal, hover-only for media) ----
    const sizeButtons = isMedia ? `
        <button class="node-btn" onclick="adjustMediaSize('${id}', -40)" title="Shrink">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="node-btn" onclick="adjustMediaSize('${id}', +40)" title="Grow">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>` : '';

    const headerHtml = `
        <div class="node-header">
            <span class="node-type ${n.type}">${n.isPdfNode ? 'PDF' : n.type}</span>
            ${n.timestamp > 0 ? `<span class="node-timestamp" onclick="jumpToTimestamp(${n.timestamp})" title="Jump to ${formatTime(n.timestamp)}">⏱ ${formatTime(n.timestamp)}</span>` : ''}
            <div class="node-actions-top">
                ${sizeButtons}
                <button class="node-btn connect-btn" onclick="startConnect('${id}')" title="Connect to another node">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button class="node-btn unlink-btn" onclick="enterUnlinkMode('${id}')" title="Unlink a connection">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
                <button class="node-btn" onclick="openColorPicker('${id}', event)" title="Change color">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                </button>
                <button class="node-btn danger" onclick="deleteNode('${id}')" title="Delete node">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
            </div>
        </div>`;

    const connectors = `
        <div class="node-connectors">
            <div class="connector-dot top"    data-node="${id}" data-side="top"    onmousedown="connectorDown(event,'${id}','top')"></div>
            <div class="connector-dot bottom" data-node="${id}" data-side="bottom" onmousedown="connectorDown(event,'${id}','bottom')"></div>
            <div class="connector-dot left"   data-node="${id}" data-side="left"   onmousedown="connectorDown(event,'${id}','left')"></div>
            <div class="connector-dot right"  data-node="${id}" data-side="right"  onmousedown="connectorDown(event,'${id}','right')"></div>
        </div>`;

    if (isMedia) {
        // FIX #4/#5: Image and PDF — box with header on hover only, preview image, resize handle
        el.innerHTML = `
            ${headerHtml}
            <div class="node-media-body">
                <img class="node-media-img" src="${n.imageUrl}" alt="${n.isPdfNode ? 'PDF preview' : 'image'}" draggable="false" onerror="this.style.opacity='0.3'">
            </div>
            ${connectors}
            <div class="node-resize-both" data-resize="${id}"></div>`;
    } else {
        // FIX #1: Text nodes → same standard box as concept/note/question
        // Standard node: header always visible
        const imgHtml = n.imageUrl ? `<img class="node-img" src="${n.imageUrl}" alt="" draggable="false" onerror="this.style.display='none'">` : '';
        const titlePlaceholder = n.isTextNode ? 'Note title…' : 'Node title…';
        const descPlaceholder  = n.isTextNode ? 'Note text…' : 'Add notes…';
        el.innerHTML = `
            ${headerHtml}
            ${imgHtml}
            <div class="node-body">
                <div class="node-title" contenteditable="true" placeholder="${titlePlaceholder}" oninput="updateNodeField('${id}','title',this.innerText)" onmousedown="stopProp(event)">${escHtml(n.title)}</div>
                <div class="node-desc"  contenteditable="true" placeholder="${descPlaceholder}"  oninput="updateNodeField('${id}','desc',this.innerText)"  onmousedown="stopProp(event)">${escHtml(n.desc)}</div>
            </div>
            ${connectors}
            <div class="node-resize" data-resize="${id}"></div>`;
    }

    layer.appendChild(el);
    makeDraggable(el, id);
    if (isMedia) makeResizableFreeMedia(el, id);
    else          makeResizable(el, id);
    el.addEventListener('click', e => selectNode(id, e));
}

function updateNodeField(id, field, val) {
    if (state.nodes[id]) {
        state.nodes[id][field] = val;
        debounce(saveData, 600)();
    }
}

// FIX #4/#5: +/- size buttons for media nodes
function adjustMediaSize(id, delta) {
    const n = state.nodes[id];
    const el = document.getElementById(id);
    if (!n || !el) return;
    const ratio = n.h ? n.w / n.h : 4 / 3;
    const newW = Math.max(120, Math.min(1200, n.w + delta));
    const newH = Math.round(newW / ratio);
    n.w = newW; n.h = newH;
    el.style.width = newW + 'px';
    el.style.height = newH + 'px';
    renderAllConnections();
    saveData();
}

function deleteNode(id) {
    pushUndo();
    state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
    delete state.nodes[id];
    const el = document.getElementById(id);
    if (el) el.remove();
    if (state.selectedNode === id) state.selectedNode = null;
    renderAllConnections();
    saveData();
    showToast('Node deleted');
}

function selectNode(id, e) {
    if (e && (e.target.closest('[contenteditable]') || e.target.closest('.node-btn') ||
              e.target.closest('.connector-dot') || e.target.closest('[data-resize]'))) return;
    if (state.connectMode && state.connectSource) { finishConnect(id); return; }

    // FIX #3: second click in unlink mode → select second node
    if (unlinkFirstNode && id !== unlinkFirstNode) {
        performUnlinkBetween(unlinkFirstNode, id);
        return;
    }

    if (state.selectedNode && state.selectedNode !== id) {
        document.getElementById(state.selectedNode)?.classList.remove('selected');
    }
    state.selectedNode = id;
    document.getElementById(id)?.classList.add('selected');
}

function deselectAll() {
    if (state.selectedNode) {
        document.getElementById(state.selectedNode)?.classList.remove('selected');
        state.selectedNode = null;
    }
}

// ===== DRAG =====
function makeDraggable(el, id) {
    let ox, oy, ex, ey, dragging = false;

    function onDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('[contenteditable],[data-resize],.node-btn,.connector-dot')) return;
        e.preventDefault();
        dragging = true;
        ox = state.nodes[id].x; oy = state.nodes[id].y;
        ex = e.clientX; ey = e.clientY;
        el.classList.add('dragging'); el.style.zIndex = 100;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function onTouchDown(e) {
        if (e.target.closest('[contenteditable],[data-resize],.node-btn,.connector-dot')) return;
        const t = e.touches[0];
        dragging = true;
        ox = state.nodes[id].x; oy = state.nodes[id].y;
        ex = t.clientX; ey = t.clientY;
        el.classList.add('dragging');
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchUp);
    }

    function move(cx, cy) {
        if (!dragging) return;
        let nx = ox + (cx - ex) / state.zoom;
        let ny = oy + (cy - ey) / state.zoom;
        if (state.snapToGrid) {
            nx = Math.round(nx / state.snapSize) * state.snapSize;
            ny = Math.round(ny / state.snapSize) * state.snapSize;
        }
        state.nodes[id].x = nx; state.nodes[id].y = ny;
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        renderAllConnections(); updateMinimap();
    }

    function onMove(e) { move(e.clientX, e.clientY); }
    function onTouchMove(e) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }

    function onUp() {
        dragging = false; el.classList.remove('dragging'); el.style.zIndex = 10;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveData();
    }
    function onTouchUp() {
        dragging = false; el.classList.remove('dragging');
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchUp);
        saveData();
    }

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onTouchDown, { passive: false });
}

// ===== RESIZE =====
function makeResizable(el, id) {
    const handle = el.querySelector('.node-resize');
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        const startW = state.nodes[id].w, startX = e.clientX;
        const onMove = ev => {
            const newW = Math.max(180, startW + (ev.clientX - startX) / state.zoom);
            state.nodes[id].w = newW; el.style.width = newW + 'px';
            renderAllConnections();
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveData(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
}

function makeResizableFreeMedia(el, id) {
    const handle = el.querySelector('.node-resize-both');
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        const n = state.nodes[id];
        const startW = n.w, startH = n.h || el.offsetHeight, startX = e.clientX;
        const ratio = startW / startH;
        const onMove = ev => {
            const newW = Math.max(100, startW + (ev.clientX - startX) / state.zoom);
            const newH = Math.round(newW / ratio);
            n.w = newW; n.h = newH;
            el.style.width = newW + 'px'; el.style.height = newH + 'px';
            renderAllConnections();
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveData(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
}

// ===== CONNECTIONS =====
let connDragActive = false, connTempPath = null, connDragSource = null;

function connectorDown(e, nodeId, side) {
    e.stopPropagation(); e.preventDefault();
    connDragActive = true; connDragSource = { nodeId, side };
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
    if (connTempPath) connTempPath.setAttribute('d', buildPath(sp.x, sp.y, tx, ty, connDragSource.side, 'auto'));
}

function connDragUp(e) {
    document.removeEventListener('mousemove', connDragMove);
    document.removeEventListener('mouseup', connDragUp);
    connDragActive = false;
    if (connTempPath) { connTempPath.remove(); connTempPath = null; }
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('connector-dot')) {
        const toNode = target.dataset.node, toSide = target.dataset.side;
        if (toNode && toNode !== connDragSource.nodeId) createConnection(connDragSource.nodeId, connDragSource.side, toNode, toSide);
    }
    connDragSource = null;
}

function startConnect(id) {
    if (state.connectMode && state.connectSource === id) { cancelConnect(); return; }
    state.connectMode = true; state.connectSource = id;
    document.getElementById('connectIndicator').style.display = 'flex';
    document.getElementById(id)?.classList.add('selected');
}

function finishConnect(toId) {
    if (!state.connectSource || toId === state.connectSource) { cancelConnect(); return; }
    createConnection(state.connectSource, 'bottom', toId, 'top');
    cancelConnect();
}

function cancelConnect() {
    state.connectMode = false; state.connectSource = null;
    document.getElementById('connectIndicator').style.display = 'none';
}

function createConnection(fromId, fromSide, toId, toSide) {
    const dup = state.connections.find(c =>
        (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
    if (dup) { showToast('Already connected'); return; }
    pushUndo();
    const connId = 'conn_' + (state.nextConnId++);
    state.connections.push({ id: connId, from: fromId, fromSide, to: toId, toSide });
    renderAllConnections(); saveData();
}

function deleteConnection(connId) {
    pushUndo();
    state.connections = state.connections.filter(c => c.id !== connId);
    renderAllConnections(); saveData();
    showToast('Connection removed');
}

/* ---------------------------------------------------------------
   FIX #3 — NEW UNLINK SYSTEM: Two-step precise unlink
   Step 1: Click "Unlink" on node A → it glows, wait for step 2
   Step 2: Click "Unlink" on node B → only the connection
           between A and B is removed. All other connections stay.
   --------------------------------------------------------------- */
let unlinkFirstNode = null;

function enterUnlinkMode(nodeId) {
    if (unlinkFirstNode === nodeId) {
        // Cancel if clicking same node twice
        exitUnlinkMode();
        return;
    }

    if (unlinkFirstNode) {
        // Step 2: we have a second node → find and remove connection between them
        performUnlinkBetween(unlinkFirstNode, nodeId);
        return;
    }

    // Step 1: select first node for unlinking
    const nodeConns = state.connections.filter(c => c.from === nodeId || c.to === nodeId);
    if (nodeConns.length === 0) { showToast('No connections on this node'); return; }

    unlinkFirstNode = nodeId;
    document.getElementById('canvasArea').classList.add('unlink-mode');
    // Highlight this node
    document.getElementById(nodeId)?.classList.add('unlink-source');
    showToast('Now click the "Unlink" button on a connected node');

    // Also render connections of this node in red
    renderAllConnections(true, nodeId);
}

function performUnlinkBetween(nodeA, nodeB) {
    const conn = state.connections.find(c =>
        (c.from === nodeA && c.to === nodeB) || (c.from === nodeB && c.to === nodeA));

    if (!conn) {
        showToast('These nodes are not connected');
        exitUnlinkMode();
        return;
    }

    pushUndo();
    state.connections = state.connections.filter(c => c.id !== conn.id);
    exitUnlinkMode();
    renderAllConnections();
    saveData();
    showToast('Connection removed');
}

function exitUnlinkMode() {
    if (unlinkFirstNode) {
        document.getElementById(unlinkFirstNode)?.classList.remove('unlink-source');
    }
    unlinkFirstNode = null;
    document.getElementById('canvasArea').classList.remove('unlink-mode');
    renderAllConnections();
}

function renderAllConnections(highlightNodeConns = false, hlNodeId = null) {
    const svg = document.getElementById('connectionsSvg');
    svg.querySelectorAll('.connection-path:not(.temp)').forEach(p => p.remove());

    state.connections.forEach(c => {
        if (!state.nodes[c.from] || !state.nodes[c.to]) return;
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        const isHighlighted = highlightNodeConns && (c.from === hlNodeId || c.to === hlNodeId);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path' +
            (state.selectedConnection === c.id ? ' selected' : '') +
            (isHighlighted ? ' unlink-highlight' : ''));
        path.setAttribute('d', buildPath(sp.x, sp.y, ep.x, ep.y, c.fromSide, c.toSide));
        path.dataset.connId = c.id;
        path.addEventListener('click', e => {
            e.stopPropagation();
            state.selectedConnection = c.id;
            renderAllConnections();
            showConnDeleteBtn(c.id, e);
        });
        path.addEventListener('dblclick', e => { e.stopPropagation(); deleteConnection(c.id); hideConnDeleteBtn(); });
        svg.appendChild(path);
    });
}

let _connDeleteBtn = null;
function showConnDeleteBtn(connId, e) {
    hideConnDeleteBtn();
    const btn = document.createElement('button');
    btn.className = 'conn-delete-btn';
    btn.style.left = e.clientX + 'px'; btn.style.top = e.clientY + 'px';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    btn.onclick = ev => { ev.stopPropagation(); deleteConnection(connId); hideConnDeleteBtn(); };
    document.body.appendChild(btn);
    _connDeleteBtn = btn;
    setTimeout(() => document.addEventListener('click', hideConnDeleteBtn, { once: true }), 50);
}
function hideConnDeleteBtn() { if (_connDeleteBtn) { _connDeleteBtn.remove(); _connDeleteBtn = null; } }

function getConnectorPos(nodeId, side) {
    const n = state.nodes[nodeId]; if (!n) return { x: 0, y: 0 };
    const el = document.getElementById(nodeId);
    const h = el ? el.offsetHeight : 100;
    switch (side) {
        case 'top':    return { x: n.x + n.w / 2, y: n.y };
        case 'bottom': return { x: n.x + n.w / 2, y: n.y + h };
        case 'left':   return { x: n.x,            y: n.y + h / 2 };
        case 'right':  return { x: n.x + n.w,      y: n.y + h / 2 };
        default:       return { x: n.x + n.w / 2,  y: n.y + h };
    }
}

function buildPath(x1, y1, x2, y2, fromSide, toSide) {
    const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const curve = Math.min(dist * 0.45, 120);
    let c1x = x1, c1y = y1, c2x = x2, c2y = y2;
    if (fromSide === 'bottom') c1y += curve;
    else if (fromSide === 'top') c1y -= curve;
    else if (fromSide === 'right') c1x += curve;
    else if (fromSide === 'left') c1x -= curve;
    else c1y += curve;
    if (toSide === 'top') c2y -= curve;
    else if (toSide === 'bottom') c2y += curve;
    else if (toSide === 'left') c2x -= curve;
    else if (toSide === 'right') c2x += curve;
    else c2y -= curve;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

// ===== ZOOM / PAN =====
function zoomIn()    { setZoom(state.zoom + 0.1); }
function zoomOut()   { setZoom(state.zoom - 0.1); }
function resetZoom() { setZoom(1); }

function setZoom(z) {
    state.zoom = Math.max(0.25, Math.min(2, Math.round(z * 10) / 10));
    document.getElementById('canvasTransform').style.transform = `scale(${state.zoom})`;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    updateMinimap();
}

document.addEventListener('wheel', e => {
    if (!document.getElementById('canvasArea').contains(e.target)) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(state.zoom - e.deltaY * 0.001); }
}, { passive: false });

let isPanning = false, panStartX, panStartY, panScrollX, panScrollY, spaceDown = false;

document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.target.closest('[contenteditable]')) {
        e.preventDefault(); spaceDown = true;
        document.getElementById('canvasScroll').style.cursor = 'grab';
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('[contenteditable]')) {
        if (state.selectedNode) deleteNode(state.selectedNode);
        else if (state.selectedConnection) deleteConnection(state.selectedConnection);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    if (e.key === 'Escape') exitUnlinkMode();
});
document.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceDown = false; document.getElementById('canvasScroll').style.cursor = ''; }
});

document.getElementById('canvasScroll').addEventListener('mousedown', e => {
    if (spaceDown) {
        isPanning = true; panStartX = e.clientX; panStartY = e.clientY;
        panScrollX = e.currentTarget.scrollLeft; panScrollY = e.currentTarget.scrollTop;
        e.currentTarget.style.cursor = 'grabbing'; e.preventDefault();
    }
});
document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    const s = document.getElementById('canvasScroll');
    s.scrollLeft = panScrollX - (e.clientX - panStartX);
    s.scrollTop  = panScrollY - (e.clientY - panStartY);
    updateMinimap();
});
document.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; document.getElementById('canvasScroll').style.cursor = ''; }
});

document.getElementById('canvasInfinite').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.id === 'connectionsSvg') {
        deselectAll();
        if (state.connectMode) cancelConnect();
        if (unlinkFirstNode) exitUnlinkMode();
        state.selectedConnection = null;
        renderAllConnections();
    }
});

// ===== GRID =====
function toggleGrid() {
    state.gridVisible = !state.gridVisible;
    document.getElementById('canvasInfinite').classList.toggle('grid-lines', state.gridVisible);
    document.getElementById('gridBtn').style.color = state.gridVisible ? 'var(--accent)' : '';
}

// ===== FAB =====
function toggleFab() {
    document.getElementById('fabMenu').classList.toggle('visible');
    document.getElementById('fabMain').classList.toggle('open');
}
function closeFab() {
    document.getElementById('fabMenu').classList.remove('visible');
    document.getElementById('fabMain').classList.remove('open');
}

// ===== IMAGE UPLOAD (FIX #4) =====
function uploadImageNode(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            // Default width = 300px (slightly bigger than 240px node box)
            const defaultW = 300;
            const ratio = img.naturalWidth / img.naturalHeight;
            const w = defaultW;
            const h = Math.round(w / ratio);
            addImageFreeNode(e.target.result, w, h);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function addImageFreeNode(src, w, h) {
    pushUndo();
    const id = 'node_' + (state.nextNodeId++);
    const scroll = document.getElementById('canvasScroll');
    const x = (scroll.scrollLeft / state.zoom) + 80 + Math.random() * 120;
    const y = (scroll.scrollTop  / state.zoom) + 80 + Math.random() * 120;
    state.nodes[id] = { id, type: 'image', title: 'Image', desc: '', x, y, w, h, timestamp: 0, imageUrl: src, color: 'default', isFreeImage: true };
    renderNode(id); saveData(); closeFab();
}

// ===== PDF UPLOAD (FIX #5) =====
function uploadPdfNode(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const imgSrc = canvas.toDataURL('image/png');
            // Default width = 300px, maintain aspect ratio
            const defaultW = 300;
            const ratio = viewport.width / viewport.height;
            const w = defaultW, h = Math.round(defaultW / ratio);
            pushUndo();
            const id = 'node_' + (state.nextNodeId++);
            const scroll = document.getElementById('canvasScroll');
            const x = (scroll.scrollLeft / state.zoom) + 80 + Math.random() * 120;
            const y = (scroll.scrollTop  / state.zoom) + 80 + Math.random() * 120;
            state.nodes[id] = { id, type: 'pdf', title: file.name, desc: '', x, y, w, h, timestamp: 0, imageUrl: imgSrc, color: 'default', isPdfNode: true };
            renderNode(id); saveData(); closeFab();
        } catch (err) { showToast('PDF error: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
}

// ===== COLOR PICKER =====
let colorPickerTarget = null;
function openColorPicker(nodeId, e) {
    e.stopPropagation();
    colorPickerTarget = nodeId;
    const popup = document.getElementById('colorPopup');
    popup.style.top  = (e.clientY - 44) + 'px';
    popup.style.left = (e.clientX - 10) + 'px';
    popup.classList.add('visible');
    setTimeout(() => document.addEventListener('click', closeColorPicker, { once: true }), 10);
}
function closeColorPicker() { document.getElementById('colorPopup').classList.remove('visible'); }
function setNodeColor(color) {
    if (!colorPickerTarget) return;
    pushUndo();
    state.nodes[colorPickerTarget].color = color;
    renderNode(colorPickerTarget);
    closeColorPicker(); saveData();
}

// ===== UNDO / REDO =====
function pushUndo() {
    state.undoStack.push(JSON.stringify({ nodes: state.nodes, connections: state.connections }));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoButtons();
}
function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify({ nodes: state.nodes, connections: state.connections }));
    applySnapshot(JSON.parse(state.undoStack.pop()));
    updateUndoButtons(); showToast('Undo');
}
function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify({ nodes: state.nodes, connections: state.connections }));
    applySnapshot(JSON.parse(state.redoStack.pop()));
    updateUndoButtons(); showToast('Redo');
}
function applySnapshot(snap) {
    state.nodes = snap.nodes; state.connections = snap.connections;
    document.getElementById('nodesLayer').innerHTML = '';
    Object.keys(state.nodes).forEach(id => renderNode(id));
    renderAllConnections(); updateMinimap();
}
function updateUndoButtons() {
    document.getElementById('undoBtn').disabled = !state.undoStack.length;
    document.getElementById('redoBtn').disabled = !state.redoStack.length;
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    if (window.innerWidth <= 768) s.classList.toggle('mobile-open');
    else s.classList.toggle('collapsed');
}

// ===== NOTEPAD TEXT FORMATTING =====
function applyFormat(cmd) {
    if (npTool !== 'text') setNpTool('text');
    const notepad = document.getElementById('notepad');
    notepad.focus();
    document.execCommand(cmd === 'heading' ? 'formatBlock' : cmd, false, cmd === 'heading' ? 'h4' : null);
}

function clearNotes() {
    if (confirm('Clear all notes and drawings?')) {
        document.getElementById('notepad').innerHTML = '';
        clearDrawingLayer();
        saveData();
    }
}

document.getElementById('notepad').addEventListener('input', debounce(saveData, 800));

// ===== NOTEPAD → CANVAS (FIX #1) =====
// Now creates a proper boxed node, not transparent text
function addSelectionToCanvas() {
    const notepad = document.getElementById('notepad');
    const sel = window.getSelection();
    let text = '';
    if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (notepad.contains(r.commonAncestorContainer)) text = sel.toString().trim();
    }
    if (!text) text = notepad.innerText.trim();
    if (!text) { showToast('Select some text first'); return; }

    pushUndo();
    const id = 'node_' + (state.nextNodeId++);
    const scroll = document.getElementById('canvasScroll');
    const x = (scroll.scrollLeft / state.zoom) + 100 + Math.random() * 100;
    const y = (scroll.scrollTop  / state.zoom) + 100 + Math.random() * 100;
    // isTextNode flag still stored for serialization but rendered as standard box
    state.nodes[id] = { id, type: 'note', title: 'Note', desc: text, x, y, w: 280, timestamp: 0, imageUrl: null, color: 'default', isTextNode: true };
    renderNode(id); saveData();
    showToast('Added to canvas');
}

// ===== DRAWING SYSTEM (FIX #6) =====
let npTool = 'text';
let npColor = '#f5a623';
let npHighlightColor = 'rgba(255,220,0,0.55)';
let eraserSize = 20;
let drawCtx = null;
let isDrawing = false;
let drawStartX = 0, drawStartY = 0;
let drawSnapshot = null;

function initDrawingCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;
    resizeDrawingCanvas();
    drawCtx = canvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    canvas.addEventListener('mousedown', drawStart);
    canvas.addEventListener('mousemove', drawMove);
    canvas.addEventListener('mouseup', drawEnd);
    canvas.addEventListener('mouseleave', drawEnd);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); if(e.touches[0]) drawStart(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); if(e.touches[0]) drawMove(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchend',   e => { if(e.changedTouches[0]) drawEnd(e.changedTouches[0]); });

    if (typeof ResizeObserver !== 'undefined') {
        const wrap = document.getElementById('notepadContentWrap');
        if (wrap) new ResizeObserver(() => resizeDrawingCanvas()).observe(wrap);
    }
}

function resizeDrawingCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const wrap = document.getElementById('notepadContentWrap');
    if (!canvas || !wrap) return;

    let imgData = null;
    if (drawCtx && canvas.width > 0 && canvas.height > 0) {
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        tmp.getContext('2d').drawImage(canvas, 0, 0);
        imgData = tmp;
    }

    canvas.width  = wrap.clientWidth  || 320;
    canvas.height = wrap.clientHeight || 500;
    drawCtx = canvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    if (imgData) drawCtx.drawImage(imgData, 0, 0);
}

function setNpTool(tool) {
    npTool = tool;
    const canvas   = document.getElementById('drawingCanvas');
    const notepad  = document.getElementById('notepad');
    const hlPres   = document.getElementById('hlPresets');
    const eraseSz  = document.getElementById('eraserSizeRow');
    const isDrawTool = tool !== 'text';

    canvas?.classList.toggle('draw-active', isDrawTool);
    canvas?.classList.toggle('eraser-active', tool === 'eraser');
    canvas?.classList.toggle('arrow-active',  tool === 'arrow');
    notepad?.classList.toggle('draw-active', isDrawTool);

    if (hlPres)  hlPres.classList.toggle('visible', tool === 'highlight');
    if (eraseSz) eraseSz.classList.toggle('visible', tool === 'eraser');

    document.querySelectorAll('.fmt-btn.tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.fmt-btn.tool-btn[data-tool="${tool}"]`)?.classList.add('active');

    if (tool === 'text') setTimeout(() => document.getElementById('notepad')?.focus(), 50);
}

function getDrawPos(e) {
    const canvas = document.getElementById('drawingCanvas');
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function drawStart(e) {
    if (!drawCtx) return;
    isDrawing = true;
    const pos = getDrawPos(e);
    drawStartX = pos.x; drawStartY = pos.y;

    if (npTool === 'arrow') {
        drawSnapshot = drawCtx.getImageData(0, 0, drawCtx.canvas.width, drawCtx.canvas.height);
    } else {
        applyDrawStyle();
        drawCtx.beginPath();
        drawCtx.moveTo(pos.x, pos.y);
    }
}

function drawMove(e) {
    if (!isDrawing || !drawCtx) return;
    const pos = getDrawPos(e);
    if (npTool === 'arrow') {
        drawCtx.putImageData(drawSnapshot, 0, 0);
        drawArrowShape(drawStartX, drawStartY, pos.x, pos.y);
    } else {
        applyDrawStyle();
        drawCtx.lineTo(pos.x, pos.y);
        drawCtx.stroke();
        // Re-open path so next segment connects smoothly
        drawCtx.beginPath();
        drawCtx.moveTo(pos.x, pos.y);
    }
}

function drawEnd(e) {
    if (!isDrawing || !drawCtx) return;
    isDrawing = false;
    if (npTool === 'arrow' && e && e.type !== 'mouseleave') {
        const pos = getDrawPos(e);
        if (drawSnapshot) drawCtx.putImageData(drawSnapshot, 0, 0);
        drawArrowShape(drawStartX, drawStartY, pos.x, pos.y);
        drawSnapshot = null;
    }
    // FIX #6: Reset composite operation to source-over after any stroke
    drawCtx.globalCompositeOperation = 'source-over';
    drawCtx.globalAlpha = 1;
    drawCtx.beginPath();
    debounce(saveDrawing, 1500)();
}

/* FIX #6: Eraser uses destination-out properly — only erases canvas pixels,
   NOT the notepad text underneath. The canvas is transparent everywhere else,
   so erasing simply punches holes in the drawings, revealing the clean notepad. */
function applyDrawStyle() {
    if (!drawCtx) return;
    // Always reset first to avoid state bleed
    drawCtx.globalCompositeOperation = 'source-over';
    drawCtx.globalAlpha = 1;

    if (npTool === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0,0,0,1)';
        drawCtx.lineWidth = eraserSize;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    } else if (npTool === 'highlight') {
        drawCtx.strokeStyle = npHighlightColor;
        drawCtx.lineWidth = 18;
        drawCtx.lineCap = 'square';
        drawCtx.lineJoin = 'round';
    } else {
        drawCtx.strokeStyle = npColor;
        drawCtx.lineWidth = 2.5;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    }
}

function drawArrowShape(x1, y1, x2, y2) {
    if (!drawCtx) return;
    drawCtx.save();
    drawCtx.globalCompositeOperation = 'source-over';
    drawCtx.globalAlpha = 1;
    drawCtx.strokeStyle = npColor; drawCtx.fillStyle = npColor;
    drawCtx.lineWidth = 2.5; drawCtx.lineCap = 'round';
    const angle = Math.atan2(y2 - y1, x2 - x1), hLen = 14;
    drawCtx.beginPath(); drawCtx.moveTo(x1, y1); drawCtx.lineTo(x2, y2); drawCtx.stroke();
    drawCtx.beginPath();
    drawCtx.moveTo(x2, y2);
    drawCtx.lineTo(x2 - hLen * Math.cos(angle - Math.PI / 6), y2 - hLen * Math.sin(angle - Math.PI / 6));
    drawCtx.lineTo(x2 - hLen * Math.cos(angle + Math.PI / 6), y2 - hLen * Math.sin(angle + Math.PI / 6));
    drawCtx.closePath(); drawCtx.fill();
    drawCtx.restore();
}

function clearDrawingLayer() {
    if (!drawCtx) return;
    const c = document.getElementById('drawingCanvas');
    drawCtx.clearRect(0, 0, c.width, c.height);
    saveDrawing();
}

function setNpColor(color) {
    npColor = color;
    const dot = document.getElementById('npColorDot');
    if (dot) dot.style.background = color;
}

function setHighlightPreset(color) {
    npHighlightColor = color;
    if (npTool !== 'highlight') setNpTool('highlight');
}

function setEraserSize(val) {
    eraserSize = parseInt(val);
    const lbl = document.getElementById('eraserSizeLabel');
    if (lbl) lbl.textContent = val + 'px';
}

// ===== CANVAS EXPORT (image) =====
async function exportCanvas() {
    showToast('Preparing export…');
    try {
        const target = document.getElementById('canvasInfinite');
        const canvas = await html2canvas(target, {
            backgroundColor: '#0f0f11', scale: 1.5, useCORS: true, allowTaint: true, logging: false,
            width: target.scrollWidth, height: target.scrollHeight
        });
        const link = document.createElement('a');
        link.download = `kexo-canvas-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Canvas exported!');
    } catch(e) { showToast('Export failed: ' + e.message); }
}

// ===== FIX #7: EXPORT PROJECT AS JSON =====
function downloadProject() {
    try {
        const projects = JSON.parse(localStorage.getItem('kexo_projects') || '[]');
        const p = projects.find(x => x.id === PROJECT_ID);
        const projectName = p ? p.name : 'project';

        const drawingCanvas = document.getElementById('drawingCanvas');
        const drawingDataUrl = (drawCtx && drawingCanvas) ? drawingCanvas.toDataURL() : null;

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            project: p || { id: PROJECT_ID, name: projectName },
            nodes: state.nodes,
            connections: state.connections,
            nextNodeId: state.nextNodeId,
            nextConnId: state.nextConnId,
            notes: document.getElementById('notepad').innerHTML,
            drawing: drawingDataUrl
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        link.download = `kexo-project-${safeName}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Project downloaded!');
    } catch(e) { showToast('Export failed: ' + e.message); }
}

// ===== MINIMAP =====
function updateMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const CANVAS_W = 4000, CANVAS_H = 3000;
    const sx = W / CANVAS_W, sy = H / CANVAS_H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#17171a'; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5;
    state.connections.forEach(c => {
        const sp = getConnectorPos(c.from, c.fromSide);
        const ep = getConnectorPos(c.to, c.toSide);
        ctx.beginPath(); ctx.moveTo(sp.x * sx, sp.y * sy); ctx.lineTo(ep.x * sx, ep.y * sy); ctx.stroke();
    });

    const colors = { default: '#22222a', blue: '#1a2540', green: '#122820', amber: '#2a1f08', rose: '#2a0f15', violet: '#1d1630' };
    Object.values(state.nodes).forEach(n => {
        const el = document.getElementById(n.id);
        const h = el ? el.offsetHeight : 80;
        ctx.fillStyle = colors[n.color] || '#22222a';
        ctx.strokeStyle = n.id === state.selectedNode ? '#f5a623' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = n.id === state.selectedNode ? 1.5 : 0.5;
        ctx.beginPath(); ctx.roundRect(n.x * sx, n.y * sy, n.w * sx, h * sy, 2);
        ctx.fill(); ctx.stroke();
    });

    const scroll = document.getElementById('canvasScroll');
    const vp = document.getElementById('minimapViewport');
    const vx = (scroll.scrollLeft / state.zoom) * sx;
    const vy = (scroll.scrollTop  / state.zoom) * sy;
    const vw = (scroll.clientWidth  / state.zoom) * sx;
    const vh = (scroll.clientHeight / state.zoom) * sy;
    vp.style.left = vx + 'px'; vp.style.top = vy + 'px';
    vp.style.width = Math.min(vw, W - vx) + 'px';
    vp.style.height = Math.min(vh, H - vy) + 'px';
}

document.getElementById('canvasScroll').addEventListener('scroll', updateMinimap);

// ===== PROJECT / STORAGE =====
function getActiveProjectId() {
    return new URLSearchParams(window.location.search).get('project')
        || localStorage.getItem('kexo_active_project') || 'default';
}
const PROJECT_ID = getActiveProjectId();
function getStorageKey(k) { return 'kexo_' + k + '_' + PROJECT_ID; }

function updateProjectTimestamp() {
    try {
        const projects = JSON.parse(localStorage.getItem('kexo_projects') || '[]');
        const p = projects.find(x => x.id === PROJECT_ID);
        if (p) { p.updatedAt = Date.now(); localStorage.setItem('kexo_projects', JSON.stringify(projects)); }
    } catch(e) {}
}

function loadProjectName() {
    try {
        const projects = JSON.parse(localStorage.getItem('kexo_projects') || '[]');
        const p = projects.find(x => x.id === PROJECT_ID);
        const el = document.getElementById('headerProjectName');
        if (el) el.textContent = p ? p.name : '';
    } catch(e) {}
}

// ===== THEME =====
function applyTheme() { document.body.classList.toggle('light-mode', localStorage.getItem('kexo_theme') === 'light'); }
function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const next = isLight ? 'dark' : 'light';
    localStorage.setItem('kexo_theme', next);
    document.body.classList.toggle('light-mode', !isLight);
    showToast(next === 'light' ? '☀️ Light mode' : '🌙 Dark mode');
}
applyTheme();

// ===== PERSIST =====
function saveDrawing() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas || !drawCtx) return;
    try { localStorage.setItem(getStorageKey('drawing'), canvas.toDataURL()); } catch(e) {}
}

function saveData() {
    try {
        localStorage.setItem(getStorageKey('nodes'), JSON.stringify(state.nodes));
        localStorage.setItem(getStorageKey('connections'), JSON.stringify(state.connections));
        localStorage.setItem(getStorageKey('nextNodeId'), state.nextNodeId);
        localStorage.setItem(getStorageKey('nextConnId'), state.nextConnId);
        localStorage.setItem(getStorageKey('notes'), document.getElementById('notepad').innerHTML);
        updateProjectTimestamp();
    } catch(e) {}
}

function loadData() {
    try {
        let nodesRaw = localStorage.getItem(getStorageKey('nodes'));
        let connsRaw = localStorage.getItem(getStorageKey('connections'));
        let notes    = localStorage.getItem(getStorageKey('notes'));
        if (!nodesRaw && PROJECT_ID === 'default') {
            nodesRaw = localStorage.getItem('vidflow_nodes');
            connsRaw = localStorage.getItem('vidflow_connections');
            notes    = localStorage.getItem('vidflow_notes');
        }
        state.nodes       = JSON.parse(nodesRaw || '{}');
        state.connections = JSON.parse(connsRaw  || '[]');
        state.nextNodeId  = parseInt(localStorage.getItem(getStorageKey('nextNodeId')) || '1');
        state.nextConnId  = parseInt(localStorage.getItem(getStorageKey('nextConnId')) || '1');
        if (notes) document.getElementById('notepad').innerHTML = notes;
        Object.keys(state.nodes).forEach(id => renderNode(id));
        renderAllConnections();
        const drawingData = localStorage.getItem(getStorageKey('drawing'));
        if (drawingData && drawCtx) {
            const img = new Image();
            img.onload = () => { drawCtx.globalCompositeOperation = 'source-over'; drawCtx.drawImage(img, 0, 0); };
            img.src = drawingData;
        }
    } catch(e) {}
}

// ===== HELPERS =====
function escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function stopProp(e) { e.stopPropagation(); }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}
function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ===== INIT =====
window.addEventListener('load', () => {
    loadProjectName();
    initDrawingCanvas();
    loadData();
    if (Object.keys(state.nodes).length === 0) {
        addNode('concept', 'Getting Started', 'Paste a YouTube URL in the panel, then click + to add nodes. Drag connector dots to link ideas!');
        addNode('question', 'What to Learn?', 'Click any timestamp badge to jump back to that moment in the video.');
        setTimeout(() => {
            const ids = Object.keys(state.nodes);
            if (ids.length >= 2) createConnection(ids[0], 'right', ids[1], 'left');
        }, 100);
    }
    updateMinimap(); updateUndoButtons();
    setInterval(updateMinimap, 2000);
    const scroll = document.getElementById('canvasScroll');
    scroll.scrollLeft = 200; scroll.scrollTop = 100;
});
