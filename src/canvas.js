/**
 * CanvasFlow Interactive Infinite Canvas Engine
 * Handles zoom, pan, select, drag, grid snap, card CRUD, and Bezier connection rendering.
 */

// Canvas State variables
let scale = 1.0;
let offsetX = 0;
let offsetY = 0;
let boardState = {
  title: '내 아이디어 보드',
  cards: [],
  connections: []
};

let selectedElementId = null; // Card ID or Connection ID
let activeTool = 'select'; // 'select', 'pan', 'connect'
let isPanning = false;
let isDraggingCard = false;
let isResizingCard = false;
let resizingCardId = null;
let cardStartSize = { w: 0, h: 0 };
let draggedSubCards = [];
let dragStartCoords = { x: 0, y: 0 };
let cardStartCoords = { x: 0, y: 0 };
let panStartCoords = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };

// Connection drawing state
let connectingSourceCardId = null;

// Element cache references
let viewport = null;
let canvas = null;
let cardsContainer = null;
let svgConnections = null;
let tempLine = null;
let zoomIndicator = null;

// Callbacks to main orchestrator
let boardChangeCallback = () => {};
let selectionChangeCallback = () => {};

// Grid Snapping Size
const GRID_SNAP_SIZE = 10;

/**
 * Initializes the infinite canvas workspace and registers event listeners.
 */
export function initCanvas(viewportEl, canvasEl, cardsContainerEl, svgLayerEl, tempLineEl, zoomIndicatorEl) {
  viewport = viewportEl;
  canvas = canvasEl;
  cardsContainer = cardsContainerEl;
  svgConnections = svgLayerEl;
  tempLine = tempLineEl;
  zoomIndicator = zoomIndicatorEl;

  // Set initial viewport offsets
  centerCanvasInitial();

  // Resize listener
  window.addEventListener('resize', updateCanvasTransform);

  // Mouse wheel: Zooming
  viewport.addEventListener('wheel', handleWheel, { passive: false });

  // Mouse pan & drag interactions
  viewport.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  // Double click viewport to create a card
  viewport.addEventListener('dblclick', handleViewportDoubleClick);

  // Keyboard navigation shortcuts
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
}

// Check spacebar state for instant pan tool
let isSpacePressed = false;

function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  if (e.code === 'Space') {
    isSpacePressed = true;
    updateCursorStyle();
  }
  
  // Shortcuts
  if (e.key.toLowerCase() === 'v') {
    setTool('select');
  }
  if (e.key.toLowerCase() === 'h') {
    setTool('pan');
  }
  if (e.key.toLowerCase() === 'c') {
    setTool('connect');
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
  }
  if (e.key === '1' && e.shiftKey) {
    zoomFit();
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space') {
    isSpacePressed = false;
    updateCursorStyle();
  }
}

function updateCursorStyle() {
  if (activeTool === 'pan' || isSpacePressed) {
    viewport.className = isPanning ? 'canvas-viewport panning' : 'canvas-viewport';
    viewport.style.cursor = isPanning ? 'grabbing' : 'grab';
  } else if (activeTool === 'connect') {
    viewport.className = 'canvas-viewport connecting';
    viewport.style.cursor = 'crosshair';
  } else {
    viewport.className = 'canvas-viewport';
    viewport.style.cursor = 'default';
  }
}

// Convert screen viewport coordinates into local canvas space coordinates
export function screenToCanvas(screenX, screenY) {
  const rect = viewport.getBoundingClientRect();
  const x = (screenX - rect.left - offsetX) / scale;
  const y = (screenY - rect.top - offsetY) / scale;
  return { x, y };
}

// Update DOM elements using calculated transform styles
function updateCanvasTransform() {
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  
  // Scale the grid pattern width dynamically to look clean
  const gridOverlay = canvas.querySelector('.canvas-grid-overlay');
  if (gridOverlay) {
    // Standard size 30px
    gridOverlay.style.backgroundSize = `${30}px ${30}px`;
  }

  // Update zoom display percentage label
  if (zoomIndicator) {
    zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
  }
}

function centerCanvasInitial() {
  const rect = viewport.getBoundingClientRect();
  // Target coordinates near 400x300 where default board template items exist
  scale = 1.0;
  offsetX = rect.width / 2 - 450;
  offsetY = rect.height / 2 - 300;
  updateCanvasTransform();
}

/**
 * Handle Zooming via trackpad/mouse scroll wheel centering under user's cursor
 */
function handleWheel(e) {
  e.preventDefault();

  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Get canvas coordinates under the mouse before zooming
  const canvasX = (mouseX - offsetX) / scale;
  const canvasY = (mouseY - offsetY) / scale;

  // Zoom sensitivity
  const zoomFactor = 1.08;
  let newScale = scale;
  
  if (e.deltaY < 0) {
    // Zoom in
    newScale = Math.min(scale * zoomFactor, 3.0);
  } else {
    // Zoom out
    newScale = Math.max(scale / zoomFactor, 0.15);
  }

  // Readjust offsets to align cursor on the same position
  offsetX = mouseX - canvasX * newScale;
  offsetY = mouseY - canvasY * newScale;
  scale = newScale;

  updateCanvasTransform();
}

export function zoomIn() {
  const rect = viewport.getBoundingClientRect();
  const mouseX = rect.width / 2;
  const mouseY = rect.height / 2;
  
  const canvasX = (mouseX - offsetX) / scale;
  const canvasY = (mouseY - offsetY) / scale;
  
  scale = Math.min(scale * 1.15, 3.0);
  offsetX = mouseX - canvasX * scale;
  offsetY = mouseY - canvasY * scale;
  
  updateCanvasTransform();
}

export function zoomOut() {
  const rect = viewport.getBoundingClientRect();
  const mouseX = rect.width / 2;
  const mouseY = rect.height / 2;
  
  const canvasX = (mouseX - offsetX) / scale;
  const canvasY = (mouseY - offsetY) / scale;
  
  scale = Math.max(scale / 1.15, 0.15);
  offsetX = mouseX - canvasX * scale;
  offsetY = mouseY - canvasY * scale;
  
  updateCanvasTransform();
}

/**
 * Figma-like Zoom to Fit: centers viewport showing all cards nicely
 */
export function zoomFit() {
  if (boardState.cards.length === 0) {
    centerCanvasInitial();
    return;
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  boardState.cards.forEach(card => {
    minX = Math.min(minX, card.x);
    maxX = Math.max(maxX, card.x + (card.width || 280));
    minY = Math.min(minY, card.y);
    maxY = Math.max(maxY, card.y + (card.height || 150));
  });

  const rect = viewport.getBoundingClientRect();
  const boardW = maxX - minX;
  const boardH = maxY - minY;

  const padding = 80;
  const scaleX = (rect.width - padding * 2) / boardW;
  const scaleY = (rect.height - padding * 2) / boardH;
  
  let newScale = Math.min(scaleX, scaleY, 1.2); // Cap max fit scale at 1.2x
  newScale = Math.max(newScale, 0.2); // Cap min scale

  const centerX = minX + boardW / 2;
  const centerY = minY + boardH / 2;

  scale = newScale;
  offsetX = rect.width / 2 - centerX * scale;
  offsetY = rect.height / 2 - centerY * scale;

  updateCanvasTransform();
}

/**
 * Mousedown router: Handles starting panning or dragging cards
 */
function handleMouseDown(e) {
  // If clicking inputs/buttons/textareas, do not handle panning
  if (e.target.closest('input, textarea, button, .action-btn, .tool-btn, .checklist-item, .add-todo-btn, iframe')) return;

  const cardEl = e.target.closest('.canvas-card');

  // 1. Pan Action: Triggered if Space is pressed, using Middle Click, or inside Pan Tool
  if (isSpacePressed || e.button === 1 || activeTool === 'pan' || (!cardEl && activeTool === 'select' && e.button === 0)) {
    isPanning = true;
    panStartCoords = { x: e.clientX, y: e.clientY };
    panStartOffset = { x: offsetX, y: offsetY };
    updateCursorStyle();
    e.preventDefault();
    return;
  }

  // 2. Clicked card logic
  if (cardEl && e.button === 0) {
    const cardId = cardEl.dataset.id;
    
    // Connection mode click handle
    if (activeTool === 'connect') {
      handleConnectionClick(cardId);
      return;
    }

    // Selection logic
    selectElement(cardId);

    // Resize handle click detection
    if (e.target.classList.contains('card-resize-handle')) {
      isResizingCard = true;
      resizingCardId = cardId;
      const card = boardState.cards.find(c => c.id === cardId);
      dragStartCoords = { x: e.clientX, y: e.clientY };
      cardStartSize = { 
        w: card.width || cardEl.offsetWidth || 280, 
        h: card.height || cardEl.offsetHeight || 150 
      };
      e.preventDefault();
      return;
    }

    // Card drag initiation
    const card = boardState.cards.find(c => c.id === cardId);
    const isSectionClick = card && card.type === 'section';
    
    if (isSectionClick || e.target.closest('.card-header') || e.target.classList.contains('card-body') || e.target.classList.contains('card-title') || e.target.closest('.section-title-label')) {
      isDraggingCard = true;
      dragStartCoords = { x: e.clientX, y: e.clientY };
      cardStartCoords = { x: card.x, y: card.y };
      
      // If dragging a section, find all other cards physically inside it
      draggedSubCards = [];
      if (isSectionClick) {
        const sectW = card.width || 600;
        const sectH = card.height || 450;
        draggedSubCards = boardState.cards.filter(c => {
          if (c.id === card.id) return false;
          // Check if card center is within the section bounds
          const cardW = c.width || 280;
          const cardH = c.height || 150;
          const cardCenterX = c.x + cardW / 2;
          const cardCenterY = c.y + cardH / 2;
          return (cardCenterX >= card.x && cardCenterX <= card.x + sectW &&
                  cardCenterY >= card.y && cardCenterY <= card.y + sectH);
        }).map(c => ({
          id: c.id,
          startX: c.x,
          startY: c.y
        }));
      }
      
      cardEl.classList.add('dragging');
      e.preventDefault();
    }
  } else if (!cardEl && e.button === 0) {
    // Clicked canvas background: deselect
    selectElement(null);
  }
}

/**
 * MouseMove handler: Updates panning offset, resizing, or active dragged card coordinates
 */
function handleMouseMove(e) {
  // 1. Update Pan offset
  if (isPanning) {
    const dx = e.clientX - panStartCoords.x;
    const dy = e.clientY - panStartCoords.y;
    offsetX = panStartOffset.x + dx;
    offsetY = panStartOffset.y + dy;
    updateCanvasTransform();
    return;
  }

  // 2. Resize active card
  if (isResizingCard && resizingCardId) {
    const cardEl = document.querySelector(`.canvas-card[data-id="${resizingCardId}"]`);
    const card = boardState.cards.find(c => c.id === resizingCardId);
    if (cardEl && card) {
      const dx = (e.clientX - dragStartCoords.x) / scale;
      const dy = (e.clientY - dragStartCoords.y) / scale;
      
      let newW = cardStartSize.w + dx;
      let newH = cardStartSize.h + dy;
      
      // Grid snap for sizing
      newW = Math.max(150, Math.round(newW / GRID_SNAP_SIZE) * GRID_SNAP_SIZE);
      newH = Math.max(80, Math.round(newH / GRID_SNAP_SIZE) * GRID_SNAP_SIZE);
      
      card.width = newW;
      card.height = newH;
      
      cardEl.style.width = `${newW}px`;
      cardEl.style.height = `${newH}px`;
      
      renderConnections();
    }
    return;
  }

  // 3. Drag selected card
  if (isDraggingCard && selectedElementId) {
    const cardEl = document.querySelector(`.canvas-card[data-id="${selectedElementId}"]`);
    if (!cardEl) return;

    const dx = (e.clientX - dragStartCoords.x) / scale;
    const dy = (e.clientY - dragStartCoords.y) / scale;

    let targetX = cardStartCoords.x + dx;
    let targetY = cardStartCoords.y + dy;

    // Grid snap calculations
    targetX = Math.round(targetX / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    targetY = Math.round(targetY / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;

    // Boundary cap inside the 10000x10000 grid
    targetX = Math.max(0, Math.min(targetX, 9700));
    targetY = Math.max(0, Math.min(targetY, 9700));

    // Update in boardState object
    const card = boardState.cards.find(c => c.id === selectedElementId);
    card.x = targetX;
    card.y = targetY;

    // Apply immediate position to element
    cardEl.style.left = `${targetX}px`;
    cardEl.style.top = `${targetY}px`;

    // Move child cards along with section
    if (draggedSubCards.length > 0) {
      draggedSubCards.forEach(sub => {
        const subCard = boardState.cards.find(c => c.id === sub.id);
        if (subCard) {
          let subTargetX = sub.startX + (targetX - cardStartCoords.x);
          let subTargetY = sub.startY + (targetY - cardStartCoords.y);
          
          subTargetX = Math.round(subTargetX / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          subTargetY = Math.round(subTargetY / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
          
          subCard.x = subTargetX;
          subCard.y = subTargetY;
          
          const subEl = document.querySelector(`.canvas-card[data-id="${sub.id}"]`);
          if (subEl) {
            subEl.style.left = `${subTargetX}px`;
            subEl.style.top = `${subTargetY}px`;
          }
        }
      });
    }

    // Redraw relationship lines live
    renderConnections();
    return;
  }

  // 4. Render floating connection line if active
  if (activeTool === 'connect' && connectingSourceCardId) {
    const fromCard = boardState.cards.find(c => c.id === connectingSourceCardId);
    if (fromCard) {
      const fromPoint = getCardConnectionPoint(fromCard, 'right');
      const mouseCanvas = screenToCanvas(e.clientX, e.clientY);
      
      tempLine.style.display = 'block';
      
      // Calculate smooth bezier control points
      const dx = Math.max(50, (mouseCanvas.x - fromPoint.x) / 2);
      const d = `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x + dx} ${fromPoint.y}, ${mouseCanvas.x - dx} ${mouseCanvas.y}, ${mouseCanvas.x} ${mouseCanvas.y}`;
      tempLine.setAttribute('d', d);
    }
  }
}

/**
 * MouseUp handler: completes operations and triggers save notifications
 */
function handleMouseUp(e) {
  if (isPanning) {
    isPanning = false;
    updateCursorStyle();
  }

  if (isResizingCard) {
    isResizingCard = false;
    resizingCardId = null;
    renderCards();
    notifyBoardChanged();
  }

  if (isDraggingCard) {
    isDraggingCard = false;
    const cardEl = document.querySelector(`.canvas-card[data-id="${selectedElementId}"]`);
    if (cardEl) cardEl.classList.remove('dragging');
    
    // Save updated positions
    notifyBoardChanged();
  }
}

/**
 * Select element helper (Card ID or Connection Line ID)
 */
export function selectElement(id) {
  // Deselect previous
  if (selectedElementId) {
    const prevCard = document.querySelector(`.canvas-card[data-id="${selectedElementId}"]`);
    if (prevCard) prevCard.classList.remove('selected');
    
    const prevLine = document.querySelector(`.connection-line[data-id="${selectedElementId}"]`);
    if (prevLine) prevLine.classList.remove('selected');
  }

  selectedElementId = id;

  if (id) {
    const card = boardState.cards.find(c => c.id === id);
    if (card) {
      const el = document.querySelector(`.canvas-card[data-id="${id}"]`);
      if (el) el.classList.add('selected');
    }
    
    const line = document.querySelector(`.connection-line[data-id="${id}"]`);
    if (line) line.classList.add('selected');
  }

  // Trigger callback to update side property inspector
  selectionChangeCallback(selectedElementId);
}

// Connection Creator helper
function handleConnectionClick(cardId) {
  if (!connectingSourceCardId) {
    // Step 1: Select source
    connectingSourceCardId = cardId;
    // Visually highlight source card
    const cardEl = document.querySelector(`.canvas-card[data-id="${cardId}"]`);
    if (cardEl) cardEl.style.outline = '2px dashed var(--color-primary)';
  } else {
    // Step 2: Establish target connection
    if (connectingSourceCardId !== cardId) {
      // Check if duplicate relation exists
      const exists = boardState.connections.some(
        c => (c.from === connectingSourceCardId && c.to === cardId)
      );

      if (!exists) {
        boardState.connections.push({
          id: `conn-${Date.now()}`,
          from: connectingSourceCardId,
          to: cardId
        });
        
        notifyBoardChanged();
        renderConnections();
      }
    }
    
    // Clean up
    resetConnectionTool();
  }
}

function resetConnectionTool() {
  if (connectingSourceCardId) {
    const prevEl = document.querySelector(`.canvas-card[data-id="${connectingSourceCardId}"]`);
    if (prevEl) prevEl.style.outline = '';
  }
  connectingSourceCardId = null;
  tempLine.style.display = 'none';
  setTool('select');
}

/**
 * Sets current toolbar tool and toggles icons
 */
export function setTool(toolName) {
  activeTool = toolName;
  
  // Remove active styling on all buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    if (btn.dataset.tool) {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    }
  });

  // Handle exiting connection state midway
  if (toolName !== 'connect' && connectingSourceCardId) {
    resetConnectionTool();
  }

  updateCursorStyle();
}

/**
 * Board Data loading & state updates
 */
export function loadBoardState(data) {
  if (data && data.cards) {
    data.cards.forEach(card => {
      if (card.type === 'link' && card.url && !card.links) {
        card.links = [{
          id: `link-${Date.now()}-${Math.random()}`,
          title: card.title || '링크',
          url: card.url
        }];
        delete card.url;
        delete card.description;
        delete card.previewImage;
      }
    });
  }
  boardState = data;
  
  // Render cards and connections
  renderCards();
  renderConnections();
  
  // Reset selection
  selectElement(null);
}

export function getBoardState() {
  return boardState;
}

// Create new blank card
export function addNewCard(type, x, y) {
  // If coordinates are not given, generate near viewport center
  if (x === undefined || y === undefined) {
    const center = screenToCanvas(viewport.offsetWidth / 2, viewport.offsetHeight / 2);
    x = Math.round(center.x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
    y = Math.round(center.y / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
  }

  const id = `card-${Date.now()}`;
  let newCard = {
    id,
    type,
    title: type === 'text' ? '새 노트' : type === 'todo' ? '할 일 목록' : type === 'link' ? '새 링크' : type === 'image' ? '이미지 카드' : '새 섹션',
    x,
    y,
    color: 'slate',
    width: type === 'section' ? 600 : type === 'link' ? 340 : 280,
    height: type === 'section' ? 450 : type === 'todo' ? 200 : type === 'image' ? 220 : type === 'link' ? 260 : 150
  };

  if (type === 'text') {
    newCard.content = '더블클릭하여 내용을 입력해보세요.';
  } else if (type === 'todo') {
    newCard.todos = [
      { id: `todo-${Date.now()}-1`, text: '기본 과제', done: false }
    ];
  } else if (type === 'image') {
    newCard.imageUrl = '';
  } else if (type === 'link') {
    newCard.links = [];
  }

  boardState.cards.push(newCard);
  
  renderCards();
  notifyBoardChanged();
  
  // Auto-select new card
  setTimeout(() => selectElement(id), 50);
}

function handleViewportDoubleClick(e) {
  if (e.target.closest('.canvas-card, .toolbar, .top-bar, .inspector-sidebar, .modal-card, .toast')) return;
  const canvasCoords = screenToCanvas(e.clientX, e.clientY);
  addNewCard('text', Math.round(canvasCoords.x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE, Math.round(canvasCoords.y / GRID_SNAP_SIZE) * GRID_SNAP_SIZE);
}

/**
 * Delete selected card or connection link
 */
export function deleteSelected() {
  if (!selectedElementId) return;

  // 1. Delete Card
  const cardIndex = boardState.cards.findIndex(c => c.id === selectedElementId);
  if (cardIndex !== -1) {
    // Delete connection links joined to this card
    boardState.connections = boardState.connections.filter(
      conn => conn.from !== selectedElementId && conn.to !== selectedElementId
    );
    
    boardState.cards.splice(cardIndex, 1);
    selectElement(null);
    renderCards();
    renderConnections();
    notifyBoardChanged();
    return;
  }

  // 2. Delete Connection Line
  const connIndex = boardState.connections.findIndex(c => c.id === selectedElementId);
  if (connIndex !== -1) {
    boardState.connections.splice(connIndex, 1);
    selectElement(null);
    renderConnections();
    notifyBoardChanged();
  }
}

/**
 * Render cards list on workspace DOM container
 */
export function renderCards() {
  cardsContainer.innerHTML = '';

  boardState.cards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = `canvas-card card-${card.color} card-type-${card.type}`;
    cardEl.dataset.id = card.id;
    cardEl.style.left = `${card.x}px`;
    cardEl.style.top = `${card.y}px`;
    cardEl.style.width = `${card.width || 280}px`;
    
    if (card.type === 'section') {
      cardEl.style.height = `${card.height || 450}px`;
    } else {
      cardEl.style.height = 'auto'; // Let dynamic heights handle content
      if (card.height) {
        cardEl.style.minHeight = `${card.height}px`;
      }
    }
    
    if (selectedElementId === card.id) {
      cardEl.classList.add('selected');
    }

    // Section card header label
    if (card.type === 'section') {
      const label = document.createElement('div');
      label.className = 'section-title-label';
      label.textContent = card.title;
      cardEl.appendChild(label);
      
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'card-resize-handle';
      cardEl.appendChild(resizeHandle);
      
      cardEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        selectElement(card.id);
        const inspectInput = document.getElementById('inspect-card-title');
        if (inspectInput) inspectInput.focus();
      });
      
      cardsContainer.appendChild(cardEl);
      return; // Skip normal headers and bodies
    }

    // Card Header Drag bar
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div class="card-title">${card.title}</div>
      <div class="card-drag-indicator"><i data-lucide="grip-horizontal"></i></div>
    `;

    // Card Body contents
    const body = document.createElement('div');
    body.className = 'card-body';

    if (card.type === 'text') {
      const textDiv = document.createElement('div');
      textDiv.className = 'card-text-content';
      textDiv.textContent = card.content || '';
      body.appendChild(textDiv);
    } else if (card.type === 'todo') {
      const todoContainer = document.createElement('div');
      todoContainer.className = 'checklist-container';
      
      if (card.todos && card.todos.length > 0) {
        card.todos.forEach(todo => {
          const item = document.createElement('div');
          item.className = todo.done ? 'checklist-item checked' : 'checklist-item';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = todo.done;
          checkbox.addEventListener('change', (e) => {
            todo.done = e.target.checked;
            item.className = todo.done ? 'checklist-item checked' : 'checklist-item';
            notifyBoardChanged();
          });

          const label = document.createElement('span');
          label.textContent = todo.text;
          
          item.appendChild(checkbox);
          item.appendChild(label);
          todoContainer.appendChild(item);
        });
      }
      
      const addBtn = document.createElement('div');
      addBtn.className = 'add-todo-btn';
      addBtn.innerHTML = `<i data-lucide="plus"></i> 항목 추가`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = prompt('할 일을 입력하세요:');
        if (text && text.trim()) {
          if (!card.todos) card.todos = [];
          card.todos.push({
            id: `todo-${Date.now()}`,
            text: text.trim(),
            done: false
          });
          renderCards();
          notifyBoardChanged();
        }
      });
      
      body.appendChild(todoContainer);
      body.appendChild(addBtn);
    } else if (card.type === 'image') {
      const wrapper = document.createElement('div');
      wrapper.className = 'card-image-wrapper';
      
      if (card.imageUrl) {
        const img = document.createElement('img');
        img.src = card.imageUrl;
        img.alt = card.title;
        img.draggable = false; 
        wrapper.appendChild(img);
      } else {
        wrapper.innerHTML = `
          <div class="card-image-placeholder">
            <i data-lucide="image"></i>
            <span>이미지 URL을 등록해주세요</span>
          </div>
        `;
      }
      body.appendChild(wrapper);
    } else if (card.type === 'link') {
      const wrapper = document.createElement('div');
      wrapper.className = 'card-link-list-wrapper';
      
      if (!card.links) card.links = [];
      
      const listContainer = document.createElement('div');
      listContainer.className = 'link-list-container';
      
      if (card.links.length === 0) {
        listContainer.innerHTML = `
          <div class="link-list-empty-state" style="padding: 16px; text-align: center; color: var(--color-text-muted); font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <i data-lucide="link-2" style="width: 24px; height: 24px; color: var(--color-text-muted);"></i>
            <div>등록된 링크가 없습니다.</div>
          </div>
        `;
      } else {
        card.links.forEach(link => {
          const item = document.createElement('div');
          item.className = 'link-list-item';
          
          if (link.loading) {
            item.innerHTML = `
              <div class="link-item-left">
                <span class="link-loading-spinner"></span>
                <span class="link-item-loading-text" style="font-size: 12px; color: var(--color-text-muted);">정보를 가져오는 중...</span>
              </div>
              <button class="btn-delete-link-item" title="링크 삭제"><i data-lucide="x"></i></button>
            `;
            
            // Hover preview in loading state
            const hoverPreview = document.createElement('div');
            hoverPreview.className = 'card-hover-preview loading-preview';
            hoverPreview.innerHTML = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--color-text-muted); font-size:12px; gap:8px;">
                <span class="link-loading-spinner"></span>
                <span>사이트 정보를 파싱하고 있습니다...</span>
              </div>
            `;
            item.appendChild(hoverPreview);
          } else {
            let hostname = '';
            try {
              let tempUrl = link.url;
              if (!/^https?:\/\//i.test(tempUrl)) tempUrl = 'https://' + tempUrl;
              hostname = new URL(tempUrl).hostname;
            } catch(e) {}
            
            const faviconUrl = hostname ? `https://www.google.com/s2/favicons?sz=32&domain=${hostname}` : '';
            const finalFaviconUrl = link.logo || faviconUrl;
            
            item.innerHTML = `
              <div class="link-item-left">
                ${finalFaviconUrl ? `<img src="${finalFaviconUrl}" class="link-item-favicon" alt="icon" onerror="this.src='https://www.google.com/s2/favicons?sz=32&domain=${hostname}'">` : '<i data-lucide="link" class="link-item-icon-fallback" style="width:16px; height:16px;"></i>'}
                <a href="${/^https?:\/\//i.test(link.url) ? link.url : 'https://' + link.url}" target="_blank" class="link-item-anchor">${link.title}</a>
              </div>
              <button class="btn-delete-link-item" title="링크 삭제"><i data-lucide="x"></i></button>
            `;
            
            // Prevent drag when clicking link
            item.querySelector('.link-item-anchor').addEventListener('mousedown', (e) => e.stopPropagation());
            
            // Hover Preview
            const ytRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
            const ytMatch = link.url.match(ytRegex);
            
            const hoverPreview = document.createElement('div');
            hoverPreview.className = 'card-hover-preview';
            
            let iframeUrl = link.url;
            if (!/^https?:\/\//i.test(link.url)) {
              iframeUrl = 'https://' + link.url;
            }
            
            if (ytMatch) {
              const videoId = ytMatch[1];
              hoverPreview.innerHTML = `
                <div class="hover-preview-header" style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:var(--color-surface); border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600;">
                  <i data-lucide="youtube" style="color: #ff0000; width: 14px; height: 14px;"></i>
                  <span>실시간 유튜브 미리보기</span>
                </div>
                <div class="hover-preview-body" style="height:calc(100% - 33px); width:100%;">
                  <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%; border:0;"></iframe>
                </div>
              `;
            } else {
              const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(link.url);
              if (isImage) {
                hoverPreview.innerHTML = `
                  <div class="hover-preview-header" style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:var(--color-surface); border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600;">
                    <i data-lucide="image" style="width: 14px; height: 14px;"></i>
                    <span>이미지 미리보기</span>
                  </div>
                  <div class="hover-preview-body image-only" style="display:flex; align-items:center; justify-content:center; height:calc(100% - 33px); background: #000;">
                    <img src="${iframeUrl}" alt="Preview" style="max-width:100%; max-height:100%; object-fit:contain;" draggable="false">
                  </div>
                `;
              } else if (link.image || link.description) {
                // Beautiful Open Graph bookmark preview card
                hoverPreview.innerHTML = `
                  <div class="hover-preview-bookmark">
                    ${link.image ? `
                      <div class="bookmark-preview-image-wrapper">
                        <img src="${link.image}" alt="Preview" class="bookmark-preview-image" onerror="this.parentNode.style.display='none'">
                      </div>
                    ` : ''}
                    <div class="bookmark-preview-content">
                      <div class="bookmark-preview-meta">
                        ${finalFaviconUrl ? `<img src="${finalFaviconUrl}" class="bookmark-preview-favicon" alt="logo" onerror="this.src='https://www.google.com/s2/favicons?sz=32&domain=${hostname}'">` : '<i data-lucide="globe" style="width:12px; height:12px; color:var(--color-text-muted);"></i>'}
                        <span class="bookmark-preview-host">${hostname}</span>
                      </div>
                      <div class="bookmark-preview-title">${link.title}</div>
                      ${link.description ? `<div class="bookmark-preview-desc">${link.description}</div>` : ''}
                      <div class="bookmark-preview-footer">
                        <a href="${iframeUrl}" target="_blank" class="bookmark-preview-go-btn">
                          <i data-lucide="external-link" style="width:12px; height:12px;"></i> 바로가기
                        </a>
                      </div>
                    </div>
                  </div>
                `;
              } else {
                // Fallback to standard web preview iframe
                hoverPreview.innerHTML = `
                  <div class="hover-preview-header" style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:var(--color-surface); border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600;">
                    <i data-lucide="globe" style="width: 14px; height: 14px;"></i>
                    <span>웹 페이지 미리보기</span>
                  </div>
                  <div class="hover-preview-body" style="position:relative; height:calc(100% - 33px); width:100%;">
                    <iframe src="${iframeUrl}" frameborder="0" sandbox="allow-scripts allow-same-origin" style="width:100%; height:100%; border:0;"></iframe>
                    <div class="iframe-blocked-warning" style="position:absolute; bottom:0; left:0; right:0; background:rgba(20,20,19,0.9); border-top:1px solid var(--color-border); color:var(--color-text-secondary); padding:8px; font-size:11px; text-align:center; pointer-events:none; display:flex; align-items:center; justify-content:center; gap:6px;">
                      <i data-lucide="info" style="width:12px; height:12px;"></i>
                      <span>미리보기가 나오지 않을 시 바로가기를 누르세요.</span>
                    </div>
                  </div>
                `;
              }
            }
            item.appendChild(hoverPreview);
          }
          
          // Delete link item handler
          item.querySelector('.btn-delete-link-item').addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = card.links.findIndex(l => l.id === link.id);
            if (idx !== -1) {
              card.links.splice(idx, 1);
              renderCards();
              notifyBoardChanged();
              // If selected, refresh inspector sidebar
              if (selectedElementId === card.id) {
                selectionChangeCallback(card.id);
              }
            }
          });
          
          listContainer.appendChild(item);
        });
      }
      
      // Inline link adder form
      const inlineForm = document.createElement('div');
      inlineForm.className = 'inline-link-adder hidden';
      inlineForm.innerHTML = `
        <input type="text" class="inline-link-input" placeholder="링크 주소(URL)를 입력하세요 (예: naver.com)">
        <div class="inline-link-buttons">
          <button class="inline-link-submit-btn" title="추가"><i data-lucide="check" style="width:14px; height:14px;"></i></button>
          <button class="inline-link-cancel-btn" title="취소"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
        </div>
      `;
      
      const addBtn = document.createElement('button');
      addBtn.className = 'add-link-item-btn';
      addBtn.innerHTML = `<i data-lucide="plus"></i> 링크 추가`;
      
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addBtn.style.display = 'none';
        inlineForm.classList.remove('hidden');
        const input = inlineForm.querySelector('.inline-link-input');
        input.value = '';
        input.focus();
      });
      
      inlineForm.addEventListener('click', (e) => e.stopPropagation());
      inlineForm.addEventListener('mousedown', (e) => e.stopPropagation());
      addBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      
      const submitAction = () => {
        const input = inlineForm.querySelector('.inline-link-input');
        const urlStr = input.value.trim();
        if (urlStr) {
          const linkId = `link-${Date.now()}`;
          let defaultTitle = urlStr.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || '새 링크';
          
          card.links.push({
            id: linkId,
            title: defaultTitle,
            url: urlStr,
            loading: true
          });
          
          renderCards();
          notifyBoardChanged();
          // If selected, refresh inspector sidebar to show the loading item
          if (selectedElementId === card.id) {
            selectionChangeCallback(card.id);
          }
          
          // Trigger fetch metadata asynchronously
          fetchLinkMetadata(card.id, linkId, urlStr);
        } else {
          inlineForm.classList.add('hidden');
          addBtn.style.display = 'inline-flex';
        }
      };
      
      inlineForm.querySelector('.inline-link-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitAction();
        } else if (e.key === 'Escape') {
          inlineForm.classList.add('hidden');
          addBtn.style.display = 'inline-flex';
        }
      });
      
      inlineForm.querySelector('.inline-link-submit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        submitAction();
      });
      
      inlineForm.querySelector('.inline-link-cancel-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        inlineForm.classList.add('hidden');
        addBtn.style.display = 'inline-flex';
      });
      
      wrapper.appendChild(listContainer);
      wrapper.appendChild(inlineForm);
      wrapper.appendChild(addBtn);
      body.appendChild(wrapper);
    }

    cardEl.appendChild(header);
    cardEl.appendChild(body);
    
    // Add resize handle for all normal cards
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'card-resize-handle';
    cardEl.appendChild(resizeHandle);

    cardsContainer.appendChild(cardEl);

    // Attach double click to card to immediately trigger side editor inspector
    cardEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      selectElement(card.id);
      const inspectInput = document.getElementById('inspect-card-title');
      if (inspectInput) inspectInput.focus();
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Calculates connection coordinates relative to edges of target cards.
 */
function getCardConnectionPoint(card, position = 'center') {
  // Cache width and height safely
  const w = card.width || 280;
  // Read height from DOM element if rendered, otherwise guess
  const el = document.querySelector(`.canvas-card[data-id="${card.id}"]`);
  const h = el ? el.offsetHeight : (card.height || 150);

  if (position === 'right') {
    return { x: card.x + w, y: card.y + h / 2 };
  } else if (position === 'left') {
    return { x: card.x, y: card.y + h / 2 };
  } else {
    return { x: card.x + w / 2, y: card.y + h / 2 };
  }
}

/**
 * Render relation connection lines using Bezier SVG path equations.
 */
export function renderConnections() {
  const group = document.getElementById('connections-group');
  if (!group) return;
  
  group.innerHTML = '';

  boardState.connections.forEach(conn => {
    const fromCard = boardState.cards.find(c => c.id === conn.from);
    const toCard = boardState.cards.find(c => c.id === conn.to);
    
    if (!fromCard || !toCard) return;

    // Determine smart points based on relative coordinates
    let fromPt, toPt;
    if (fromCard.x + (fromCard.width || 280) < toCard.x) {
      fromPt = getCardConnectionPoint(fromCard, 'right');
      toPt = getCardConnectionPoint(toCard, 'left');
    } else if (toCard.x + (toCard.width || 280) < fromCard.x) {
      fromPt = getCardConnectionPoint(fromCard, 'left');
      toPt = getCardConnectionPoint(toCard, 'right');
    } else {
      fromPt = getCardConnectionPoint(fromCard, 'center');
      toPt = getCardConnectionPoint(toCard, 'center');
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', selectedElementId === conn.id ? 'connection-line selected' : 'connection-line');
    path.setAttribute('data-id', conn.id);
    
    // Draw Bezier curves for a fluid look
    const dx = Math.max(60, Math.abs(toPt.x - fromPt.x) / 1.6);
    let d;
    if (fromPt.x <= toPt.x) {
      d = `M ${fromPt.x} ${fromPt.y} C ${fromPt.x + dx} ${fromPt.y}, ${toPt.x - dx} ${toPt.y}, ${toPt.x} ${toPt.y}`;
    } else {
      d = `M ${fromPt.x} ${fromPt.y} C ${fromPt.x - dx} ${fromPt.y}, ${toPt.x + dx} ${toPt.y}, ${toPt.x} ${toPt.y}`;
    }
    
    path.setAttribute('d', d);
    
    // Make marker arrow matches the theme color
    if (selectedElementId === conn.id) {
      path.setAttribute('marker-end', 'url(#arrow-selected)');
    } else {
      path.setAttribute('marker-end', 'url(#arrow)');
    }

    // Connect event listener to easily delete link lines
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      selectElement(conn.id);
    });

    group.appendChild(path);
  });
}

// Update callbacks
export function onBoardChanged(cb) {
  boardChangeCallback = cb;
}

export function onSelectionChanged(cb) {
  selectionChangeCallback = cb;
}

function notifyBoardChanged() {
  boardChangeCallback(boardState);
}

export async function fetchLinkMetadata(cardId, linkId, rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('API fetch failed');
    const result = await response.json();
    
    if (result.status === 'success' && result.data) {
      const { title, description, image, logo } = result.data;
      updateLinkItem(cardId, linkId, {
        title: title || url,
        description: description || '',
        image: image ? image.url : null,
        logo: logo ? logo.url : null,
        loading: false
      });
      return;
    }
  } catch (err) {
    console.error('Metadata fetch error:', err);
  }
  
  // Fallback if scraping fails
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
  
  updateLinkItem(cardId, linkId, {
    title: hostname || '새 링크',
    loading: false
  });
}

export function updateLinkItem(cardId, linkId, updates) {
  const card = boardState.cards.find(c => c.id === cardId);
  if (!card || !card.links) return;
  
  const link = card.links.find(l => l.id === linkId);
  if (!link) return;
  
  Object.assign(link, updates);
  
  // Save state
  notifyBoardChanged();
  
  // Re-render cards
  renderCards();
  
  // Update inspector if selected
  if (selectedElementId === cardId) {
    selectionChangeCallback(cardId);
  }
}
