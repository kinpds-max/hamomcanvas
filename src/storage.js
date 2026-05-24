/**
 * CanvasFlow Storage & Security Module
 * Handles local storage CRUD, user authentication via Web Crypto SHA-256, and data export/import.
 */

// Helper to hash password using Web Crypto API
export async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// User accounts management
const USERS_KEY = 'hamamcanvas_users';
const SESSION_KEY = 'hamamcanvas_current_user';
const BOARD_PREFIX = 'hamamcanvas_board_';

const OLD_USERS_KEY = 'canvasflow_users';
const OLD_SESSION_KEY = 'canvasflow_current_user';
const OLD_BOARD_PREFIX = 'canvasflow_board_';

export function getUsers() {
  let users = localStorage.getItem(USERS_KEY);
  if (!users) {
    // Migrate from old CanvasFlow storage key
    const oldUsers = localStorage.getItem(OLD_USERS_KEY);
    if (oldUsers) {
      localStorage.setItem(USERS_KEY, oldUsers);
      users = oldUsers;
    }
  }
  return users ? JSON.parse(users) : {};
}

export async function registerUser(username, password) {
  const users = getUsers();
  const lowerName = username.trim().toLowerCase();
  
  if (!lowerName) throw new Error('사용자명을 입력해주세요.');
  if (lowerName.length < 3) throw new Error('사용자명은 3글자 이상이어야 합니다.');
  if (password.length < 6) throw new Error('비밀번호는 6글자 이상이어야 합니다.');
  if (users[lowerName]) throw new Error('이미 존재하는 사용자명입니다.');
  
  const passwordHash = await hashPassword(password);
  users[lowerName] = {
    username: username.trim(), // Keep casing for display
    passwordHash: passwordHash,
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
}

export async function authenticateUser(username, password) {
  const users = getUsers();
  const lowerName = username.trim().toLowerCase();
  
  if (!users[lowerName]) {
    throw new Error('존재하지 않는 사용자명입니다.');
  }
  
  const passwordHash = await hashPassword(password);
  if (users[lowerName].passwordHash !== passwordHash) {
    throw new Error('비밀번호가 일치하지 않습니다.');
  }
  
  // Set current user session
  setCurrentUser(users[lowerName].username);
  return users[lowerName].username;
}

export function setCurrentUser(username) {
  localStorage.setItem(SESSION_KEY, username);
}

export function getCurrentUser() {
  let user = localStorage.getItem(SESSION_KEY);
  if (!user) {
    // Migrate session from old CanvasFlow session key
    const oldUser = localStorage.getItem(OLD_SESSION_KEY);
    if (oldUser) {
      localStorage.setItem(SESSION_KEY, oldUser);
      user = oldUser;
    }
  }
  return user;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Board Data Persistence
export function getBoardKey(username) {
  return `${BOARD_PREFIX}${username.trim().toLowerCase()}`;
}

// Default board templates for new users
const defaultBoardData = {
  title: '내 아이디어 공간',
  cards: [
    {
      id: 'card-welcome-1',
      type: 'text',
      title: '하맘캔버스에 오신 것을 환영합니다! 👋',
      content: '이곳은 피그마처럼 마우스 휠과 드래그로 자유롭게 이동하며 아이디어를 정리할 수 있는 캔버스입니다.\n\n새롭게 업데이트된 기능들을 확인해 보세요:\n1. 링크/유튜브 미리보기 카드\n2. 피그마 스타일의 섹션 그룹 정리 및 크기 변경',
      x: 100,
      y: 100,
      color: 'slate',
      width: 320,
      height: 180
    },
    {
      id: 'card-welcome-2',
      type: 'todo',
      title: '하맘캔버스 익히기 🎯',
      todos: [
        { id: 'todo-1', text: 'Space 키를 누른 채 마우스 드래그로 화면 이동하기', done: false },
        { id: 'todo-2', text: 'Ctrl + 마우스 휠로 화면 확대/축소하기', done: false },
        { id: 'todo-3', text: '섹션 카드의 우측 하단 모서리를 끌어 크기 조절하기', done: false },
        { id: 'todo-4', text: '섹션 그룹을 움직여 내부 카드들을 동시 드래그하기', done: false }
      ],
      x: 100,
      y: 310,
      color: 'amber',
      width: 320,
      height: 220
    },
    {
      id: 'card-welcome-3',
      type: 'link',
      title: '하맘캔버스 소개 동영상 🎥',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      description: '유튜브 링크를 등록하면 캔버스 위에서 영상을 실시간 시청하고 정리할 수 있습니다.',
      x: 500,
      y: 140,
      color: 'indigo',
      width: 340,
      height: 260
    },
    {
      id: 'card-welcome-4',
      type: 'section',
      title: '유튜브 리스트 섹션 📁',
      x: 460,
      y: 80,
      color: 'slate',
      width: 420,
      height: 450
    }
  ],
  connections: [
    {
      id: 'conn-1',
      from: 'card-welcome-1',
      to: 'card-welcome-2'
    },
    {
      id: 'conn-2',
      from: 'card-welcome-1',
      to: 'card-welcome-3'
    }
  ]
};

export function saveBoard(username, boardData) {
  if (!username) return;
  const key = getBoardKey(username);
  localStorage.setItem(key, JSON.stringify(boardData));
}

export function loadBoard(username) {
  if (!username) return null;
  const key = getBoardKey(username);
  let data = localStorage.getItem(key);
  
  if (!data) {
    // Migrate board data from old CanvasFlow board key
    const oldKey = `${OLD_BOARD_PREFIX}${username.trim().toLowerCase()}`;
    const oldData = localStorage.getItem(oldKey);
    if (oldData) {
      localStorage.setItem(key, oldData);
      data = oldData;
    } else {
      // Save and return initial template board
      saveBoard(username, defaultBoardData);
      return JSON.parse(JSON.stringify(defaultBoardData));
    }
  }
  
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('보드 데이터를 읽어오는 중 에러 발생:', e);
    return defaultBoardData;
  }
}

// Export Board Data (JSON download)
export function exportBoard(username) {
  const board = loadBoard(username);
  if (!board) return;
  
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `hamamcanvas_${username.toLowerCase()}_${dateStr}.json`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Import Board Data (JSON upload)
export function importBoard(username, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const boardData = JSON.parse(e.target.result);
        
        // Simple structure validation
        if (typeof boardData !== 'object' || !boardData.cards || !boardData.title) {
          throw new Error('유효한 하맘캔버스 백업 파일이 아닙니다.');
        }
        
        saveBoard(username, boardData);
        resolve(boardData);
      } catch (err) {
        reject(new Error('파일 파싱에 실패했습니다: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기 에러가 발생했습니다.'));
    reader.readAsText(file);
  });
}
