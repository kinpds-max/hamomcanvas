import { registerUser, authenticateUser, getCurrentUser, clearSession } from './storage.js';

// Premium Toast Notification Helper
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div class="toast-content">${message}</div>
    <button class="toast-close"><i data-lucide="x"></i></button>
  `;
  
  container.appendChild(toast);
  
  // Initialize Lucide icons for the newly injected markup
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 200);
  };
  
  closeBtn.addEventListener('click', dismiss);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) dismiss();
  }, 4000);
}

/**
 * Initializes Authentication screen forms and checks for active sessions.
 * @param {Function} onLoginSuccess Callback triggered with the active username.
 */
export function initAuth(onLoginSuccess) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authScreen = document.getElementById('auth-screen');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('btn-logout');
  const usernameDisplay = document.getElementById('username-display');
  const userAvatarChar = document.getElementById('user-avatar-char');

  // Verify if user is already logged in
  const cachedUser = getCurrentUser();
  if (cachedUser) {
    loginSuccess(cachedUser);
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const activeUser = await authenticateUser(username, password);
      showToast(`${activeUser}님, 반갑고 환영합니다! ✨`, 'success');
      loginSuccess(activeUser);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Handle Signup Submit
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    
    if (password !== passwordConfirm) {
      showToast('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    
    try {
      // 1. Register Account
      await registerUser(username, password);
      showToast('계정이 성공적으로 생성되었습니다! 🎉', 'success');
      
      // 2. Auto Login
      const activeUser = await authenticateUser(username, password);
      loginSuccess(activeUser);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Handle Logout
  logoutBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    clearSession();
    
    // Smooth transition back to login screen
    appShell.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authScreen.style.opacity = '1';
    
    // Clear form inputs
    loginForm.reset();
    signupForm.reset();
    
    showToast(`${user || '사용자'}님, 로그아웃되었습니다. 다음에 만나요! 👋`, 'info');
  });

  function loginSuccess(username) {
    // Set UI displays
    if (usernameDisplay) usernameDisplay.textContent = username;
    if (userAvatarChar) userAvatarChar.textContent = username.charAt(0).toUpperCase();
    
    // Transition UI Screens
    authScreen.style.opacity = '0';
    setTimeout(() => {
      authScreen.classList.add('hidden');
      appShell.classList.remove('hidden');
      
      // Notify parent to load board
      onLoginSuccess(username);
    }, 400);
  }
}
