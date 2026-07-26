/* ==========================================================================
   THE PAD - Authentication Controller (auth.js)
   Handles Login, Signup (Email Confirmation), Logout & Auth State UI
   ========================================================================== */

import { db } from './db.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.initElements();
    this.initEventListeners();
  }

  initElements() {
    // Buttons
    this.openLoginModalBtn = document.getElementById('openLoginModalBtn');
    this.openSignupModalBtn = document.getElementById('openSignupModalBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    
    // Auth Modal
    this.authModal = document.getElementById('authModal');
    this.closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    this.authModalTitle = document.getElementById('authModalTitle');

    // Tabs
    this.tabLoginBtn = document.getElementById('tabLoginBtn');
    this.tabSignupBtn = document.getElementById('tabSignupBtn');

    // Forms
    this.loginForm = document.getElementById('loginForm');
    this.signupForm = document.getElementById('signupForm');
    this.signupEmailNotice = document.getElementById('signupEmailNotice');

    // User Navigation Elements
    this.authNavLoggedOut = document.getElementById('authNavLoggedOut');
    this.authNavLoggedIn = document.getElementById('authNavLoggedIn');
    this.userBadgeName = document.getElementById('userBadgeName');
  }

  initEventListeners() {
    this.openLoginModalBtn.addEventListener('click', () => this.openModal('login'));
    this.openSignupModalBtn.addEventListener('click', () => this.openModal('signup'));
    this.closeAuthModalBtn.addEventListener('click', () => this.closeModal());

    this.tabLoginBtn.addEventListener('click', () => this.switchTab('login'));
    this.tabSignupBtn.addEventListener('click', () => this.switchTab('signup'));

    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    this.logoutBtn.addEventListener('click', () => this.handleLogout());

    // Listen to Supabase Auth State Changes
    db.onAuthStateChange((user) => {
      this.currentUser = user;
      this.updateAuthUI(user);
    });
  }

  openModal(tab = 'login') {
    this.authModal.classList.add('active');
    this.signupEmailNotice.style.display = 'none';
    this.switchTab(tab);
  }

  closeModal() {
    this.authModal.classList.remove('active');
    this.loginForm.reset();
    this.signupForm.reset();
    this.signupEmailNotice.style.display = 'none';
  }

  switchTab(tab) {
    if (tab === 'login') {
      this.tabLoginBtn.classList.add('active');
      this.tabSignupBtn.classList.remove('active');
      this.loginForm.style.display = 'block';
      this.signupForm.style.display = 'none';
      this.authModalTitle.textContent = 'Accedi a The Pad';
      document.getElementById('loginEmail').focus();
    } else {
      this.tabSignupBtn.classList.add('active');
      this.tabLoginBtn.classList.remove('active');
      this.signupForm.style.display = 'block';
      this.loginForm.style.display = 'none';
      this.authModalTitle.textContent = 'Registrati su The Pad';
      document.getElementById('signupUsername').focus();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      await db.signIn(email, password);
      this.closeModal();
      if (window.app) window.app.showToast('🎉 Accesso effettuato con successo!');
    } catch (err) {
      if (window.app) {
        window.app.showToast('⚠️ Errore di accesso: ' + (err.message.includes('Email not confirmed') ? 'Conferma prima la tua email!' : err.message));
      }
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    try {
      await db.signUp(email, password, username);
      this.signupForm.reset();
      this.signupEmailNotice.style.display = 'block';
      if (window.app) {
        window.app.showToast('📧 Email di conferma inviata! Controlla la tua casella di posta.');
      }
    } catch (err) {
      if (window.app) {
        window.app.showToast('⚠️ Errore registrazione: ' + err.message);
      }
    }
  }

  async handleLogout() {
    try {
      await db.signOut();
      if (window.app) window.app.showToast('👋 Disconnessione effettuata');
    } catch (err) {
      console.error('Errore logout:', err);
    }
  }

  updateAuthUI(user) {
    const postModalBtn = document.getElementById('openPostModalBtn');
    const fabBtn = document.getElementById('fabBtn');
    const boardSelectorContainer = document.getElementById('boardSelectorContainer');

    if (user) {
      this.authNavLoggedOut.style.display = 'none';
      this.authNavLoggedIn.style.display = 'flex';
      
      const displayName = (user.user_metadata && user.user_metadata.username) || user.email.split('@')[0];
      this.userBadgeName.textContent = displayName;

      if (postModalBtn) postModalBtn.style.display = 'flex';
      if (fabBtn) fabBtn.style.display = 'flex';
      if (boardSelectorContainer) boardSelectorContainer.style.display = 'flex';
    } else {
      this.authNavLoggedOut.style.display = 'flex';
      this.authNavLoggedIn.style.display = 'none';

      if (postModalBtn) postModalBtn.style.display = 'none';
      if (fabBtn) fabBtn.style.display = 'none';
      if (boardSelectorContainer) boardSelectorContainer.style.display = 'none';
    }
  }
}

export const authManager = new AuthManager();
