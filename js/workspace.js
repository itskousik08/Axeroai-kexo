/**
 * KEXO AI — workspace.js
 * Canvas + notepad engine with Firebase sync
 * Preserves all original functionality, adds Firebase save/load
 */
'use strict';

// ── STATE ──────────────────────────────────────────────────────────────────
let state = {
  nodes: {}, connections: [], zoom: 1, gridVisible: true,
  selectedNode: null, selectedConnection: null,
  connectMode: false, connectSource: null,
  undoStack: [], redoStack: [],
  nextNodeId: 1, nextConnId: 1,
  snapToGrid: false, snapSize: 30,
};

// ── YT PLAYER ──────────────────────────────────────────────────────────────
let ytPlayer = null;
window.onYouTubeIframeAPIReady = function() {};

function loadVideo() {
  const url = document.getElementById('ytUrl').value.trim();
  const vid = extractVideoId(url);
  if (!vid) { showToast('Invalid YouTube URL'); return; }
  document.getElementById('videoEmpty').style.display = 'none';
  if (ytPlayer) { ytPlayer.loadVideoById(vid); }
  else {
    ytPlayer = new YT.Player('player', {
      height:'100%', width:'100%', videoId: vid,
      playerVars: { rel:0, modestbranding:1 },
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
  const m = Math.floor(secs/60), s = secs%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function captureTimestamp() {
  const t = ytPlayer ? Math.floor(ytPlayer.getCurrentTime()) : 0;
  const vidId = ytPlayer ? ytPlayer.getVideoData().video_id : null;
  const thumb = vidId ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : null;
  addNode('snapshot','Video Snapshot','Captured from video.',t,thumb);
  showToast('Snapshot captured!');
}
function jumpToTimestamp(secs) {
  if (!ytPlayer) return;
  ytPlayer.seekTo(secs,true); ytPlayer.playVideo();
}
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

// ── NODES ──────────────────────────────────────────────────────────────────
function addNode(type='concept', title='New Concept', desc='', timestamp=0, imageUrl=null) {
  pushUndo();
  const id = 'node_' + (state.nextNodeId++);
  const scroll = document.getElementById('canvasScroll');
  const x = (scroll.scrollLeft / state.zoom) + 80 + Math.random() * 120;
  const y = (scroll.scrollTop  / state.zoom) + 80 + Math.random() * 80;
  state.nodes[id] = { id, type, title, desc, x, y, w: 220, color:'default', timestamp, imageUrl, links:[] };
  renderNode(id);
  setTimeout(() => { updateMinimap(); triggerSave(); }, 100);
  showToast('Node added');
}

function renderNode(id) {
  const n = state.nodes[id];
  const nodesLayer = document.getElementById('nodesLayer');
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('div'); el.id = id; nodesLayer.appendChild(el); }

  const typeIcons = {
    concept:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>`,
    question: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    note:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>`,
    snapshot: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/></svg>`,
  };
  const selected = state.selectedNode === id;
  const readonly = window.KEXO_READONLY;

  el.className = `node ${n.color !== 'default' ? n.color : ''} ${selected ? 'selected' : ''}`;
  el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.w}px;position:absolute;`;

  el.innerHTML = `
    <div class="node-header">
      <span class="node-type-icon">${typeIcons[n.type] || typeIcons.concept}</span>
      <span class="node-title" ${readonly?'':`contenteditable="true" onblur="updateNodeTitle('${id}',this.textContent)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"`}>
        ${escHtml(n.title)}
      </span>
      ${!readonly?`<div class="node-actions">
        <button class="node-btn" onclick="openColorPicker(event,'${id}')" title="Color">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
        </button>
        <button class="node-btn danger" onclick="deleteNode('${id}')" title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`:''}
    </div>
    ${n.imageUrl ? `<div class="node-image-wrap"><img src="${n.imageUrl}" class="node-image" onerror="this.style.display='none'"></div>` : ''}
    ${n.timestamp ? `<button class="node-timestamp" onclick="jumpToTimestamp(${n.timestamp})">⏱ ${formatTime(n.timestamp)}</button>` : ''}
    <div class="node-desc" ${readonly?'':`contenteditable="true" onblur="updateNodeDesc('${id}',this.textContent)"`}>${escHtml(n.desc)}</div>
    <div class="node-resize-handle" onmousedown="startResize(event,'${id}')"></div>
    <div class="connectors">
      <div class="connector top"    onmousedown="startConnect(event,'${id}','top')"></div>
      <div class="connector right"  onmousedown="startConnect(event,'${id}','right')"></div>
      <div class="connector bottom" onmousedown="startConnect(event,'${id}','bottom')"></div>
      <div class="connector left"   onmousedown="startConnect(event,'${id}','left')"></div>
    </div>`;

  el.onmousedown = e => { if (!e.target.closest('.node-actions,.connector,.node-title,.node-desc,.node-resize-handle,.node-timestamp')) startDrag(e, id); };
  el.onclick = e => { if (!e.target.closest('.node-actions,.connector,.node-timestamp')) selectNode(id); };
}

function updateNodeTitle(id, text) { if (state.nodes[id]) { state.nodes[id].title = text.trim(); triggerSave(); } }
function updateNodeDesc(id, text)  { if (state.nodes[id]) { state.nodes[id].desc  = text.trim(); triggerSave(); } }

function selectNode(id) {
  state.selectedNode = id;
  Object.keys(state.nodes).forEach(nid => renderNode(nid));
  if (state.connectMode && state.connectSource && id !== state.connectSource) {
    createConnection(state.connectSource, 'right', id, 'left');
    cancelConnect();
  }
}

function deleteNode(id) {
  pushUndo();
  state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
  delete state.nodes[id];
  document.getElementById(id)?.remove();
  renderAllConnections();
  updateMinimap();
  triggerSave();
  showToast('Node deleted');
}

function openColorPicker(e, id) {
  e.stopPropagation();
  state.selectedNode = id;
  const popup = document.getElementById('colorPopup');
  popup.style.display = 'flex';
  popup.style.left = e.clientX + 'px';
  popup.style.top  = e.clientY + 'px';
}

function setNodeColor(color) {
  if (state.selectedNode && state.nodes[state.selectedNode]) {
    state.nodes[state.selectedNode].color = color;
    renderNode(state.selectedNode);
    triggerSave();
  }
  document.getElementById('colorPopup').style.display = 'none';
}

// ── DRAG ───────────────────────────────────────────────────────────────────
let dragging = false, dragId = null, dragOx = 0, dragOy = 0;

function startDrag(e, id) {
  if (window.KEXO_READONLY) return;
  e.stopPropagation(); e.preventDefault();
  dragging = true; dragId = id;
  const n = state.nodes[id];
  dragOx = e.clientX / state.zoom - n.x;
  dragOy = e.clientY / state.zoom - n.y;
  document.getElementById(id).style.zIndex = '999';
  pushUndo();
}

document.addEventListener('mousemove', e => {
  if (!dragging || !dragId) return;
  let x = e.clientX / state.zoom - dragOx;
  let y = e.clientY / state.zoom - dragOy;
  if (state.snapToGrid) { x = Math.round(x / state.snapSize) * state.snapSize; y = Math.round(y / state.snapSize) * state.snapSize; }
  x = Math.max(0, x); y = Math.max(0, y);
  state.nodes[dragId].x = x;
  state.nodes[dragId].y = y;
  const el = document.getElementById(dragId);
  if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
  renderAllConnections();
  updateMinimap();
});

document.addEventListener('mouseup', () => {
  if (dragging) { dragging = false; dragId = null; triggerSave(); }
  endConnect();
  isResizing = false; resizeId = null;
});

// ── RESIZE ─────────────────────────────────────────────────────────────────
let isResizing = false, resizeId = null, resizeStartX = 0, resizeStartW = 0;
function startResize(e, id) {
  e.stopPropagation(); e.preventDefault();
  isResizing = true; resizeId = id;
  resizeStartX = e.clientX; resizeStartW = state.nodes[id].w;
}
document.addEventListener('mousemove', e => {
  if (!isResizing || !resizeId) return;
  const dw = (e.clientX - resizeStartX) / state.zoom;
  state.nodes[resizeId].w = Math.max(160, resizeStartW + dw);
  const el = document.getElementById(resizeId);
  if (el) el.style.width = state.nodes[resizeId].w + 'px';
  renderAllConnections();
});

// ── CONNECTIONS ────────────────────────────────────────────────────────────
let connectingLine = null, connectStart = null;

function startConnect(e, id, side) {
  if (window.KEXO_READONLY) return;
  e.stopPropagation(); e.preventDefault();
  connectStart = { id, side };
  state.connectMode = true; state.connectSource = id;
  document.getElementById('connectIndicator').style.display = 'flex';
}

function endConnect() {
  if (connectingLine) { connectingLine.remove(); connectingLine = null; }
  connectStart = null;
}

function cancelConnect() {
  state.connectMode = false; state.connectSource = null;
  document.getElementById('connectIndicator').style.display = 'none';
  endConnect();
}

function createConnection(fromId, fromSide, toId, toSide) {
  pushUndo();
  const id = 'conn_' + (state.nextConnId++);
  state.connections.push({ id, from:fromId, fromSide, to:toId, toSide });
  renderAllConnections();
  triggerSave();
}

function getConnectorPos(nodeId, side) {
  const n = state.nodes[nodeId]; if (!n) return {x:0,y:0};
  const el = document.getElementById(nodeId);
  const h = el ? el.offsetHeight : 80;
  if (side === 'top')    return { x: n.x + n.w/2, y: n.y };
  if (side === 'bottom') return { x: n.x + n.w/2, y: n.y + h };
  if (side === 'left')   return { x: n.x,         y: n.y + h/2 };
  if (side === 'right')  return { x: n.x + n.w,   y: n.y + h/2 };
  return { x: n.x + n.w/2, y: n.y + h/2 };
}

function renderAllConnections() {
  const svg = document.getElementById('connectionsSvg');
  svg.innerHTML = '';
  state.connections.forEach(c => {
    const sp = getConnectorPos(c.from, c.fromSide);
    const ep = getConnectorPos(c.to,   c.toSide);
    const dx = Math.abs(ep.x - sp.x) * 0.5;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M${sp.x},${sp.y} C${sp.x+dx},${sp.y} ${ep.x-dx},${ep.y} ${ep.x},${ep.y}`);
    path.setAttribute('class', `connection-path ${state.selectedConnection===c.id?'selected':''}`);
    path.setAttribute('data-id', c.id);
    path.onclick = e => { e.stopPropagation(); state.selectedConnection = c.id; renderAllConnections(); };
    svg.appendChild(path);
  });
}

// ── ZOOM ───────────────────────────────────────────────────────────────────
function zoomIn()   { setZoom(Math.min(state.zoom * 1.2, 3)); }
function zoomOut()  { setZoom(Math.max(state.zoom / 1.2, 0.2)); }
function resetZoom(){ setZoom(1); }
function setZoom(z) {
  state.zoom = z;
  document.getElementById('canvasTransform').style.transform = `scale(${z})`;
  document.getElementById('canvasTransform').style.transformOrigin = '0 0';
  document.getElementById('zoomLabel').textContent = Math.round(z * 100) + '%';
  updateMinimap();
}

// ── GRID ───────────────────────────────────────────────────────────────────
function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  document.getElementById('canvasInfinite').classList.toggle('grid-lines', state.gridVisible);
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  setTimeout(() => resizeDrawingCanvas(), 380);
}

// ── UNDO / REDO ────────────────────────────────────────────────────────────
function pushUndo() {
  state.undoStack.push(JSON.stringify({ nodes:state.nodes, connections:state.connections, nextNodeId:state.nextNodeId, nextConnId:state.nextConnId }));
  if (state.undoStack.length > 50) state.undoStack.shift();
  state.redoStack = [];
  updateUndoButtons();
}
function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(JSON.stringify({ nodes:state.nodes, connections:state.connections, nextNodeId:state.nextNodeId, nextConnId:state.nextConnId }));
  const s = JSON.parse(state.undoStack.pop());
  restoreState(s); updateUndoButtons(); triggerSave();
}
function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.stringify({ nodes:state.nodes, connections:state.connections, nextNodeId:state.nextNodeId, nextConnId:state.nextConnId }));
  const s = JSON.parse(state.redoStack.pop());
  restoreState(s); updateUndoButtons(); triggerSave();
}
function restoreState(s) {
  state.nodes = s.nodes; state.connections = s.connections;
  state.nextNodeId = s.nextNodeId; state.nextConnId = s.nextConnId;
  document.getElementById('nodesLayer').innerHTML = '';
  Object.keys(state.nodes).forEach(id => renderNode(id));
  renderAllConnections(); updateMinimap();
}
function updateUndoButtons() {
  document.getElementById('undoBtn').disabled = !state.undoStack.length;
  document.getElementById('redoBtn').disabled = !state.redoStack.length;
}

// ── SELECTION ADD TO CANVAS ────────────────────────────────────────────────
function addSelectionToCanvas() {
  const sel = window.getSelection()?.toString().trim();
  if (!sel) { showToast('Select text in the notepad first'); return; }
  addNode('note', 'Excerpt', sel);
}

// ── CLEAR NOTES ────────────────────────────────────────────────────────────
function clearNotes() {
  if (!confirm('Clear all notes and drawings?')) return;
  document.getElementById('notepad').innerHTML = '';
  clearDrawingLayer();
  triggerSave();
}

// ── DRAWING CANVAS ─────────────────────────────────────────────────────────
let npTool = 'text', npColor = '#4F46E5', npHighlightColor = 'rgba(255,220,0,0.55)';
let eraserSize = 20, drawCtx = null, isDrawing = false;
let drawStartX = 0, drawStartY = 0, drawSnapshot = null;

function initDrawingCanvas() {
  const canvas = document.getElementById('drawingCanvas');
  if (!canvas) return;
  resizeDrawingCanvas();
  drawCtx = canvas.getContext('2d');
  drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
  canvas.addEventListener('mousedown', drawStart);
  canvas.addEventListener('mousemove', drawMove);
  canvas.addEventListener('mouseup', drawEnd);
  canvas.addEventListener('mouseleave', drawEnd);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); if(e.touches[0]) drawStart(e.touches[0]); }, { passive:false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); if(e.touches[0]) drawMove(e.touches[0]); }, { passive:false });
  canvas.addEventListener('touchend',   e => { if(e.changedTouches[0]) drawEnd(e.changedTouches[0]); });
  if (typeof ResizeObserver !== 'undefined') {
    const wrap = document.getElementById('notepadContentWrap');
    if (wrap) new ResizeObserver(() => resizeDrawingCanvas()).observe(wrap);
  }
}

function resizeDrawingCanvas() {
  const canvas = document.getElementById('drawingCanvas');
  const wrap   = document.getElementById('notepadContentWrap');
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
  drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
  if (imgData) drawCtx.drawImage(imgData, 0, 0);
}

function setNpTool(tool) {
  npTool = tool;
  const canvas = document.getElementById('drawingCanvas');
  const notepad = document.getElementById('notepad');
  const hlPres = document.getElementById('hlPresets');
  const eraseSz = document.getElementById('eraserSizeRow');
  const isDrawTool = tool !== 'text';
  canvas?.classList.toggle('draw-active', isDrawTool);
  canvas?.classList.toggle('eraser-active', tool === 'eraser');
  canvas?.classList.toggle('arrow-active', tool === 'arrow');
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
    applyDrawStyle(); drawCtx.beginPath(); drawCtx.moveTo(pos.x, pos.y);
  }
}

function drawMove(e) {
  if (!isDrawing || !drawCtx) return;
  const pos = getDrawPos(e);
  if (npTool === 'arrow') {
    drawCtx.putImageData(drawSnapshot, 0, 0);
    drawArrowShape(drawStartX, drawStartY, pos.x, pos.y);
  } else {
    applyDrawStyle(); drawCtx.lineTo(pos.x, pos.y); drawCtx.stroke();
    drawCtx.beginPath(); drawCtx.moveTo(pos.x, pos.y);
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
  drawCtx.globalCompositeOperation = 'source-over';
  drawCtx.globalAlpha = 1; drawCtx.beginPath();
  debounce(triggerSave, 1500)();
}

function applyDrawStyle() {
  if (!drawCtx) return;
  drawCtx.globalCompositeOperation = 'source-over'; drawCtx.globalAlpha = 1;
  if (npTool === 'eraser') {
    drawCtx.globalCompositeOperation = 'destination-out';
    drawCtx.strokeStyle = 'rgba(0,0,0,1)'; drawCtx.lineWidth = eraserSize;
  } else if (npTool === 'highlight') {
    drawCtx.strokeStyle = npHighlightColor; drawCtx.lineWidth = 18; drawCtx.lineCap = 'square';
  } else {
    drawCtx.strokeStyle = npColor; drawCtx.lineWidth = 2.5;
  }
}

function drawArrowShape(x1,y1,x2,y2) {
  if (!drawCtx) return;
  drawCtx.save(); drawCtx.globalCompositeOperation='source-over'; drawCtx.globalAlpha=1;
  drawCtx.strokeStyle=npColor; drawCtx.fillStyle=npColor; drawCtx.lineWidth=2.5; drawCtx.lineCap='round';
  const angle=Math.atan2(y2-y1,x2-x1), hLen=14;
  drawCtx.beginPath(); drawCtx.moveTo(x1,y1); drawCtx.lineTo(x2,y2); drawCtx.stroke();
  drawCtx.beginPath(); drawCtx.moveTo(x2,y2);
  drawCtx.lineTo(x2-hLen*Math.cos(angle-Math.PI/6),y2-hLen*Math.sin(angle-Math.PI/6));
  drawCtx.lineTo(x2-hLen*Math.cos(angle+Math.PI/6),y2-hLen*Math.sin(angle+Math.PI/6));
  drawCtx.closePath(); drawCtx.fill(); drawCtx.restore();
}

function clearDrawingLayer() {
  if (!drawCtx) return;
  const c = document.getElementById('drawingCanvas');
  drawCtx.clearRect(0, 0, c.width, c.height);
  triggerSave();
}
function setNpColor(color) { npColor=color; document.getElementById('npColorDot').style.background=color; }
function setHighlightPreset(color) { npHighlightColor=color; if(npTool!=='highlight')setNpTool('highlight'); }
function setEraserSize(val) { eraserSize=parseInt(val); document.getElementById('eraserSizeLabel').textContent=val+'px'; }
function applyFormat(cmd) {
  if (cmd === 'heading') { document.execCommand('formatBlock',false,'h3'); return; }
  document.execCommand(cmd, false, null);
}

// ── UPLOAD IMAGE/PDF NODE ──────────────────────────────────────────────────
async function uploadImageNode(input) {
  const file = input.files[0]; if (!file) return;
  if (window.KEXO_CLOUDINARY?.cloud_name) {
    showToast('Uploading image…');
    try {
      const fd = new FormData(); fd.append('file',file);
      fd.append('upload_preset', window.KEXO_CLOUDINARY.upload_preset);
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${window.KEXO_CLOUDINARY.cloud_name}/image/upload`, { method:'POST', body:fd });
      const data = await res.json();
      if (data.secure_url) { addNode('note', file.name, '', 0, data.secure_url); showToast('Image added!'); }
    } catch(e) { showToast('Upload failed'); }
  } else {
    const reader = new FileReader();
    reader.onload = e => addNode('note', file.name, '', 0, e.target.result);
    reader.readAsDataURL(file);
  }
  input.value = '';
}

async function uploadPdfNode(input) {
  const file = input.files[0]; if (!file) return;
  showToast('Processing PDF…');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf  = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    const vp   = page.getViewport({ scale:1.5 });
    const canvas= document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext:canvas.getContext('2d'), viewport:vp }).promise;
    addNode('note', file.name, `PDF — ${pdf.numPages} page(s)`, 0, canvas.toDataURL());
    showToast('PDF added!');
  } catch(e) { showToast('PDF failed: ' + e.message); }
  input.value = '';
}

// ── EXPORT ─────────────────────────────────────────────────────────────────
async function exportCanvas() {
  showToast('Preparing export…');
  try {
    const target = document.getElementById('canvasInfinite');
    const canvas = await html2canvas(target, {
      backgroundColor:'#0B0F14', scale:1.5, useCORS:true, allowTaint:true, logging:false,
      width:target.scrollWidth, height:target.scrollHeight
    });
    const link = document.createElement('a');
    link.download = `kexo-canvas-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Canvas exported!');
  } catch(e) { showToast('Export failed: ' + e.message); }
}

function downloadProject() {
  const proj = window.KEXO_PROJECT;
  const data = {
    version:'2.0', exportedAt:new Date().toISOString(),
    id: proj?.id, name: proj?.data?.name,
    nodes:state.nodes, connections:state.connections,
    notes: document.getElementById('notepad').innerHTML,
  };
  const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `${(proj?.data?.name||'project').replace(/\s+/g,'-')}-kexo.json`;
  a.href = url; a.click(); URL.revokeObjectURL(url);
  showToast('Project exported!');
}

// ── MINIMAP ────────────────────────────────────────────────────────────────
function updateMinimap() {
  const canvas = document.getElementById('minimapCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CANVAS_W = 4000, CANVAS_H = 3000;
  const sx = W/CANVAS_W, sy = H/CANVAS_H;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#111827'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(79,70,229,0.15)'; ctx.lineWidth=0.5;
  state.connections.forEach(c => {
    const sp=getConnectorPos(c.from,c.fromSide), ep=getConnectorPos(c.to,c.toSide);
    ctx.beginPath(); ctx.moveTo(sp.x*sx,sp.y*sy); ctx.lineTo(ep.x*sx,ep.y*sy); ctx.stroke();
  });
  Object.values(state.nodes).forEach(n => {
    const el=document.getElementById(n.id), h=el?el.offsetHeight:80;
    ctx.fillStyle='#1F2937';
    ctx.strokeStyle=n.id===state.selectedNode?'#4F46E5':'rgba(255,255,255,0.1)';
    ctx.lineWidth=n.id===state.selectedNode?1.5:0.5;
    ctx.beginPath(); ctx.roundRect(n.x*sx,n.y*sy,n.w*sx,h*sy,2); ctx.fill(); ctx.stroke();
  });
  const scroll=document.getElementById('canvasScroll');
  const vp=document.getElementById('minimapViewport');
  const vx=(scroll.scrollLeft/state.zoom)*sx, vy=(scroll.scrollTop/state.zoom)*sy;
  const vw=(scroll.clientWidth/state.zoom)*sx, vh=(scroll.clientHeight/state.zoom)*sy;
  vp.style.left=vx+'px'; vp.style.top=vy+'px';
  vp.style.width=Math.min(vw,W-vx)+'px'; vp.style.height=Math.min(vh,H-vy)+'px';
}
document.getElementById('canvasScroll').addEventListener('scroll', updateMinimap);

// ── FAB ────────────────────────────────────────────────────────────────────
let fabOpen = false;
function toggleFab() {
  fabOpen = !fabOpen;
  document.getElementById('fabMenu').style.display = fabOpen ? 'flex' : 'none';
  document.getElementById('fabMain').classList.toggle('open', fabOpen);
}
document.addEventListener('click', e => {
  if (fabOpen && !e.target.closest('.fab-group')) {
    fabOpen = false;
    document.getElementById('fabMenu').style.display = 'none';
    document.getElementById('fabMain').classList.remove('open');
  }
  if (!e.target.closest('.color-popup') && !e.target.closest('.node-btn')) {
    document.getElementById('colorPopup').style.display = 'none';
  }
});

// ── KEYBOARD ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNode && !e.target.closest('[contenteditable]')) {
    deleteNode(state.selectedNode); state.selectedNode = null;
  }
  if (e.key === 'Delete' && state.selectedConnection) {
    pushUndo();
    state.connections = state.connections.filter(c => c.id !== state.selectedConnection);
    state.selectedConnection = null;
    renderAllConnections(); triggerSave();
  }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
  if (e.key === 'Escape') { cancelConnect(); state.selectedNode=null; state.selectedConnection=null; }
});

// ── PAN (space+drag) ───────────────────────────────────────────────────────
let spaceDown = false, panning = false, panSx = 0, panSy = 0;
document.addEventListener('keydown', e => { if(e.code==='Space'&&!e.target.closest('[contenteditable]')){e.preventDefault();spaceDown=true;} });
document.addEventListener('keyup',   e => { if(e.code==='Space'){spaceDown=false;panning=false;} });
document.getElementById('canvasScroll').addEventListener('mousedown', e => {
  if (spaceDown) { panning=true; panSx=e.clientX+document.getElementById('canvasScroll').scrollLeft; panSy=e.clientY+document.getElementById('canvasScroll').scrollTop; }
});
document.addEventListener('mousemove', e => {
  if (panning) { const s=document.getElementById('canvasScroll'); s.scrollLeft=panSx-e.clientX; s.scrollTop=panSy-e.clientY; }
});
document.addEventListener('mouseup', () => { panning=false; });

// ── SAVE / LOAD ────────────────────────────────────────────────────────────
function triggerSave() {
  if (window.KEXO_READONLY) return;
  if (typeof window.kexoSaveToFirebase === 'function') {
    const drawing = (() => { try { return document.getElementById('drawingCanvas').toDataURL(); } catch(_) { return null; } })();
    window.kexoSaveToFirebase(
      state.nodes, state.connections,
      document.getElementById('notepad').innerHTML, drawing
    );
  }
}

// Called by Firebase module once project data is loaded
window.kexoInit = (projectData) => {
  // Restore state from Firestore
  if (projectData.nodes)       state.nodes       = projectData.nodes;
  if (projectData.connections) state.connections = projectData.connections;
  if (projectData.nextNodeId)  state.nextNodeId  = projectData.nextNodeId;
  if (projectData.nextConnId)  state.nextConnId  = projectData.nextConnId;
  if (projectData.notes) {
    document.getElementById('notepad').innerHTML = projectData.notes;
  }

  // Render canvas
  document.getElementById('nodesLayer').innerHTML = '';
  Object.keys(state.nodes).forEach(id => renderNode(id));
  renderAllConnections();

  // Restore drawing
  if (projectData.drawing && drawCtx) {
    const img = new Image();
    img.onload = () => { drawCtx.globalCompositeOperation='source-over'; drawCtx.drawImage(img,0,0); };
    img.src = projectData.drawing;
  }

  // Default nodes if empty
  if (Object.keys(state.nodes).length === 0) {
    addNode('concept','Getting Started','Load a YouTube video, take notes, and build your mind map!');
    addNode('question','What to Learn?','Click any timestamp badge to jump back to that moment.');
    setTimeout(() => {
      const ids = Object.keys(state.nodes);
      if (ids.length >= 2) createConnection(ids[0],'right',ids[1],'left');
    }, 100);
  }

  // Read-only: disable editing
  if (window.KEXO_READONLY) {
    document.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
    document.querySelectorAll('.fab-group,.notepad-toolbar,.notepad-add-btn').forEach(el => el.style.display='none');
  }

  updateMinimap(); updateUndoButtons();
  setInterval(updateMinimap, 2000);
  const scroll = document.getElementById('canvasScroll');
  scroll.scrollLeft = 200; scroll.scrollTop = 100;
};

// If Firebase module already loaded before this script
if (window.KEXO_PROJECT) window.kexoInit(window.KEXO_PROJECT.data);
else window.dispatchEvent(new Event('kexo-app-ready'));

// ── HELPERS ────────────────────────────────────────────────────────────────
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2400);
}
function debounce(fn, delay) {
  let timer; return (...args) => { clearTimeout(timer); timer=setTimeout(()=>fn(...args),delay); };
}

// Init canvas
window.addEventListener('load', () => { initDrawingCanvas(); });
