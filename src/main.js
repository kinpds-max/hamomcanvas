/**
 * CanvasFlow Main Application Entrypoint
 * Orchestrates auth flow, toolbars, properties inspector, export/import, theme toggles, and help modal.
 */

import { initAuth, showToast } from './auth.js';
import { saveBoard, loadBoard, exportBoard, importBoard } from './storage.js';
import {
  initCanvas,
  loadBoardState,
  getBoardState,
  addNewCard,
  deleteSelected,
  selectElement,
  setTool,
  zoomIn,
  zoomOut,
  zoomFit,
  onBoardChanged,
  onSelectionChanged,
  renderConnections,
  renderCards
} from './canvas.js';

let currentUser = null;
let saveTimeout = null;

// Initialize Authentication Screen
document.addEventListener('DOMContentLoaded', () => {
  initAuth(handleLoginSuccess);
});

/**
 * Triggered on successful user authentication
 * @param {string} username The authenticated username
 */
function handleLoginSuccess(username) {
  currentUser = username;
  
  // 1. Load active board state from storage
  const boardData = loadBoard(username);
  
  // 2. Initialize Canvas elements
  const viewport = document.getElementById('canvas-viewport');
  const canvas = document.getElementById('infinite-canvas');
  const cardsContainer = document.getElementById('cards-container');
  const svgLayer = document.getElementById('svg-connections-layer');
  const tempLine = document.getElementById('temp-connection-line');
  const zoomIndicator = document.getElementById('zoom-indicator');
  
  initCanvas(viewport, canvas, cardsContainer, svgLayer, tempLine, zoomIndicator);
  
  // 3. Load Board State
  loadBoardState(boardData);
  
  // 4. Update Board Title in UI
  const titleInput = document.getElementById('board-title-input');
  if (titleInput) titleInput.value = boardData.title || '내 아이디어 보드';
  
  // 5. Setup Action Listeners
  setupEventListeners();
  
  // 6. Connect Canvas callbacks to UI handlers
  onBoardChanged(handleBoardChanged);
  onSelectionChanged(handleSelectionChanged);
  
  // 7. Initial Zoom-to-Fit for centering default components
  setTimeout(() => {
    zoomFit();
  }, 200);
}

/**
 * Standard Save-State debouncer to limit localStorage hit writes and show saving state.
 */
function handleBoardChanged(updatedState) {
  if (!currentUser) return;
  
  // Flash Save Status in Top Bar
  const statusEl = document.querySelector('.save-status');
  if (statusEl) {
    statusEl.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> 저장 중...';
    if (window.lucide) window.lucide.createIcons();
  }
  
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    saveBoard(currentUser, updatedState);
    
    if (statusEl) {
      statusEl.innerHTML = '<i data-lucide="cloud-check"></i> 저장됨';
      if (window.lucide) window.lucide.createIcons();
    }
  }, 600);
}

/**
 * Handle card selection to open/close context properties inspector sidebar.
 * @param {string|null} selectedId Selected element identifier (card or connection)
 */
function handleSelectionChanged(selectedId) {
  const inspector = document.getElementById('inspector-sidebar');
  if (!selectedId) {
    inspector.classList.add('hidden');
    return;
  }
  
  const board = getBoardState();
  const card = board.cards.find(c => c.id === selectedId);
  
  if (card) {
    // Show inspector
    inspector.classList.remove('hidden');
    
    // Populate simple texts
    document.getElementById('inspect-card-title').value = card.title || '';
    
    // Toggle content textareas based on card type
    const contentGrp = document.getElementById('inspect-content-group');
    const imageGrp = document.getElementById('inspect-image-group');
    const linkGrp = document.getElementById('inspect-link-group');
    
    if (card.type === 'text') {
      contentGrp.classList.remove('hidden');
      imageGrp.classList.add('hidden');
      linkGrp.classList.add('hidden');
      document.getElementById('inspect-card-content').value = card.content || '';
    } else if (card.type === 'todo') {
      contentGrp.classList.add('hidden');
      imageGrp.classList.add('hidden');
      linkGrp.classList.add('hidden');
    } else if (card.type === 'image') {
      contentGrp.classList.add('hidden');
      imageGrp.classList.remove('hidden');
      linkGrp.classList.add('hidden');
      document.getElementById('inspect-image-url').value = card.imageUrl || '';
    } else if (card.type === 'link') {
      contentGrp.classList.add('hidden');
      imageGrp.classList.add('hidden');
      linkGrp.classList.remove('hidden');
      document.getElementById('inspect-link-url').value = card.url || '';
      document.getElementById('inspect-link-desc').value = card.description || '';
      document.getElementById('inspect-link-img').value = card.previewImage || '';
    } else if (card.type === 'section') {
      contentGrp.classList.add('hidden');
      imageGrp.classList.add('hidden');
      linkGrp.classList.add('hidden');
    }
    
    // Set color presets active borders
    document.querySelectorAll('.color-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === card.color);
    });
    
    // Populate Connections list
    populateConnectionsInspector(card.id);
  } else {
    // A connection line was selected instead
    inspector.classList.add('hidden');
  }
}

/**
 * Renders connection items linked to this card inside inspector list
 */
function populateConnectionsInspector(cardId) {
  const listContainer = document.getElementById('inspector-connections-list');
  if (!listContainer) return;
  
  const board = getBoardState();
  const connections = board.connections.filter(c => c.from === cardId || c.to === cardId);
  
  if (connections.length === 0) {
    listContainer.innerHTML = '<span class="no-connections-text">연결된 다른 카드가 없습니다.</span>';
    return;
  }
  
  listContainer.innerHTML = '';
  connections.forEach(conn => {
    const fromCard = board.cards.find(c => c.id === conn.from);
    const toCard = board.cards.find(c => c.id === conn.to);
    
    if (!fromCard || !toCard) return;
    
    const isSource = conn.from === cardId;
    const peerCard = isSource ? toCard : fromCard;
    const directionLabel = isSource ? '연결대상 ➜' : '연결출처 ↵';
    
    const item = document.createElement('div');
    item.className = 'connection-item';
    item.innerHTML = `
      <span><strong>${directionLabel}</strong> ${peerCard.title}</span>
      <button class="btn-remove-connection" title="연결선 삭제"><i data-lucide="x"></i></button>
    `;
    
    item.querySelector('.btn-remove-connection').addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove this connection from state
      const index = board.connections.findIndex(c => c.id === conn.id);
      if (index !== -1) {
        board.connections.splice(index, 1);
        renderConnections();
        handleBoardChanged(board);
        populateConnectionsInspector(cardId);
      }
    });
    
    listContainer.appendChild(item);
  });
  
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Configure DOM Event Listeners for UI Panels & Controls
 */
function setupEventListeners() {
  // Title Edit
  const titleInput = document.getElementById('board-title-input');
  titleInput.addEventListener('input', (e) => {
    const board = getBoardState();
    board.title = e.target.value;
    handleBoardChanged(board);
  });

  // Zoom Buttons
  document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
  document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
  document.getElementById('btn-zoom-reset').addEventListener('click', zoomFit);

  // Left Toolbar: Tool Selection
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'add-text') {
        addNewCard('text');
        setTool('select');
      } else if (tool === 'add-todo') {
        addNewCard('todo');
        setTool('select');
      } else if (tool === 'add-link') {
        addNewCard('link');
        setTool('select');
      } else if (tool === 'add-image') {
        addNewCard('image');
        setTool('select');
      } else if (tool === 'add-section') {
        addNewCard('section');
        setTool('select');
      } else {
        setTool(tool);
      }
    });
  });

  // Theme Toggle Button
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    const sunIcon = themeBtn.querySelector('.light-icon');
    const moonIcon = themeBtn.querySelector('.dark-icon');
    
    if (isDark) {
      document.body.classList.replace('dark-theme', 'light-theme');
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
      showToast('라이트 테마로 전환되었습니다. ☀️', 'info');
    } else {
      document.body.classList.replace('light-theme', 'dark-theme');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
      showToast('다크 테마로 전환되었습니다. 🌙', 'info');
    }
  });

  // Help Modal Dialog Toggles
  const helpBtn = document.getElementById('btn-help');
  const closeHelpBtn = document.getElementById('btn-close-help');
  const helpModal = document.getElementById('help-modal');
  
  helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
  closeHelpBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });

  // Export Board
  document.getElementById('btn-export').addEventListener('click', () => {
    if (currentUser) {
      exportBoard(currentUser);
      showToast('보드 데이터 백업용 파일 다운로드를 시작합니다.', 'success');
    }
  });

  // Import Board Trigger
  const importTrigger = document.getElementById('btn-import-trigger');
  const fileInput = document.getElementById('import-file-input');
  
  importTrigger.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    
    try {
      const data = await importBoard(currentUser, file);
      loadBoardState(data);
      showToast('보드 데이터 가져오기가 성공적으로 완료되었습니다! 📂', 'success');
      
      // Update Board Title input value
      if (titleInput) titleInput.value = data.title || '내 아이디어 보드';
      
      // Auto Zoom to fit import
      setTimeout(() => zoomFit(), 200);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      fileInput.value = ''; // Reset file input
    }
  });

  // Inspector Panel edits
  const inspectTitle = document.getElementById('inspect-card-title');
  const inspectContent = document.getElementById('inspect-card-content');
  const inspectImgUrl = document.getElementById('inspect-image-url');
  
  inspectTitle.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card) {
      card.title = e.target.value;
      
      // Update element live in DOM
      const cardEl = document.querySelector(`.canvas-card[data-id="${selectedId}"]`);
      if (cardEl) {
        const titleEl = cardEl.querySelector('.card-title');
        if (titleEl) titleEl.textContent = e.target.value;
      }
      
      handleBoardChanged(board);
    }
  });

  inspectContent.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card && card.type === 'text') {
      card.content = e.target.value;
      
      // Update text live in DOM
      const cardEl = document.querySelector(`.canvas-card[data-id="${selectedId}"]`);
      if (cardEl) {
        const textEl = cardEl.querySelector('.card-text-content');
        if (textEl) textEl.textContent = e.target.value;
      }
      
      handleBoardChanged(board);
    }
  });

  inspectImgUrl.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card && card.type === 'image') {
      card.imageUrl = e.target.value.trim();
      
      // Update DOM Image Card live
      const cardEl = document.querySelector(`.canvas-card[data-id="${selectedId}"]`);
      if (cardEl) {
        const wrapper = cardEl.querySelector('.card-image-wrapper');
        if (wrapper) {
          if (card.imageUrl) {
            wrapper.innerHTML = `<img src="${card.imageUrl}" alt="${card.title}" draggable="false">`;
          } else {
            wrapper.innerHTML = `
              <div class="card-image-placeholder">
                <i data-lucide="image"></i>
                <span>이미지 URL을 등록해주세요</span>
              </div>
            `;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      }
      
      handleBoardChanged(board);
    }
  });

  // Link Preview inputs event listeners
  const inspectLinkUrl = document.getElementById('inspect-link-url');
  const inspectLinkDesc = document.getElementById('inspect-link-desc');
  const inspectLinkImg = document.getElementById('inspect-link-img');

  inspectLinkUrl.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card && card.type === 'link') {
      card.url = e.target.value.trim();
      renderCards();
      handleBoardChanged(board);
    }
  });

  inspectLinkDesc.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card && card.type === 'link') {
      card.description = e.target.value;
      renderCards();
      handleBoardChanged(board);
    }
  });

  inspectLinkImg.addEventListener('input', (e) => {
    const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
    if (!selectedId) return;
    
    const board = getBoardState();
    const card = board.cards.find(c => c.id === selectedId);
    if (card && card.type === 'link') {
      card.previewImage = e.target.value.trim();
      renderCards();
      handleBoardChanged(board);
    }
  });

  // Color Preset Selectors
  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedId = document.querySelector('.canvas-card.selected')?.dataset.id;
      if (!selectedId) return;
      
      const color = btn.dataset.color;
      const board = getBoardState();
      const card = board.cards.find(c => c.id === selectedId);
      
      if (card) {
        // Toggle Active status border on selector
        document.querySelectorAll('.color-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Remove previous color classes
        const cardEl = document.querySelector(`.canvas-card[data-id="${selectedId}"]`);
        if (cardEl) {
          cardEl.className = cardEl.className.replace(/\bcard-\w+/g, '');
          cardEl.classList.add(`card-${color}`);
        }
        
        card.color = color;
        handleBoardChanged(board);
      }
    });
  });

  // Close inspector button
  document.getElementById('btn-close-inspector').addEventListener('click', () => {
    selectElement(null);
  });

  // Delete Card Button
  document.getElementById('btn-delete-card').addEventListener('click', () => {
    deleteSelected();
  });
}
