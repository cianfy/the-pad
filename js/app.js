/* ==========================================================================
   THE PAD - Main Application Controller (app.js)
   Renders Posts, Controls View Layouts, Modals, Search & User Interactions
   ========================================================================== */

import { db, PUBLIC_BOARD_ID, PUBLIC_BOARD } from './db.js';
import { authManager } from './auth.js';
import { makeCardDraggable } from './drag.js';

class App {
  constructor() {
    this.currentPosts = [];
    this.boards = [PUBLIC_BOARD];
    this.activeBoard = PUBLIC_BOARD;
    this.connectionState = 'connecting';
    this.connectionError = null;
    this.currentView = localStorage.getItem('the_pad_view_mode') || 'grid';
    this.selectedColor = 'purple';
    this.currentImageData = null;

    this.initElements();
    this.initEventListeners();
    this.initTheme();
    this.initViewMode();

    // Subscribe to DB updates & connection states
    db.subscribe((posts, state, error) => {
      this.currentPosts = posts;
      this.connectionState = state;
      this.connectionError = error;
      this.updateDbStatus();
      this.render();
    });

    // Listen for Auth changes to reload boards
    db.onAuthStateChange(async (user) => {
      if (user) {
        await this.loadUserBoards();
      } else {
        this.boards = [PUBLIC_BOARD];
        const savedBoardId = localStorage.getItem('the_pad_last_active_board') || PUBLIC_BOARD_ID;
        this.selectBoard(savedBoardId === PUBLIC_BOARD_ID ? PUBLIC_BOARD_ID : PUBLIC_BOARD_ID);
        this.updateBoardDropdown();
      }
    });

    // Initial restore of last active board
    const initialSavedBoard = localStorage.getItem('the_pad_last_active_board') || PUBLIC_BOARD_ID;
    this.selectBoard(initialSavedBoard);
  }

  initElements() {
    // Buttons
    this.viewGridBtn = document.getElementById('viewGridBtn');
    this.viewCanvasBtn = document.getElementById('viewCanvasBtn');
    this.viewListBtn = document.getElementById('viewListBtn');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.openPostModalBtn = document.getElementById('openPostModalBtn');
    this.fabBtn = document.getElementById('fabBtn');
    
    // Board Selector Elements
    this.boardSelect = document.getElementById('boardSelect');
    this.openNewBoardModalBtn = document.getElementById('openNewBoardModalBtn');
    this.deleteBoardBtn = document.getElementById('deleteBoardBtn');
    this.boardTitle = document.getElementById('boardTitle');
    this.boardDescription = document.getElementById('boardDescription');

    // Containers
    this.boardContainer = document.getElementById('boardContainer');
    this.searchInput = document.getElementById('searchInput');
    this.toastContainer = document.getElementById('toastContainer');
    this.dbStatusBadge = document.getElementById('dbStatusBadge');
    this.dbStatusText = document.getElementById('dbStatusText');

    // Post Modal & Forms
    this.postModal = document.getElementById('postModal');
    this.closePostModalBtn = document.getElementById('closePostModalBtn');
    this.cancelPostModalBtn = document.getElementById('cancelPostModalBtn');
    this.postForm = document.getElementById('postForm');

    // New Board Modal
    this.boardModal = document.getElementById('boardModal');
    this.closeBoardModalBtn = document.getElementById('closeBoardModalBtn');
    this.cancelBoardModalBtn = document.getElementById('cancelBoardModalBtn');
    this.boardForm = document.getElementById('boardForm');

    // Image Upload Elements
    this.imageDropZone = document.getElementById('imageDropZone');
    this.imageFileInput = document.getElementById('imageFileInput');
    this.imageUrlInput = document.getElementById('imageUrlInput');
    this.imagePreviewContainer = document.getElementById('imagePreviewContainer');
    this.imagePreview = document.getElementById('imagePreview');
    this.removeImageBtn = document.getElementById('removeImageBtn');

    // Lightbox
    this.lightboxModal = document.getElementById('lightboxModal');
    this.lightboxImage = document.getElementById('lightboxImage');
    this.closeLightboxBtn = document.getElementById('closeLightboxBtn');
  }

  initEventListeners() {
    // View Switchers
    this.viewGridBtn.addEventListener('click', () => this.setViewMode('grid'));
    this.viewCanvasBtn.addEventListener('click', () => this.setViewMode('canvas'));
    this.viewListBtn.addEventListener('click', () => this.setViewMode('list'));

    // Theme Switcher
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // Search Bar Live Filter
    this.searchInput.addEventListener('input', () => this.render());

    // Board Switcher Dropdown & Modal
    this.boardSelect.addEventListener('change', (e) => this.selectBoard(e.target.value));
    this.openNewBoardModalBtn.addEventListener('click', () => this.openBoardModal());
    this.deleteBoardBtn.addEventListener('click', () => this.handleDeleteBoard());
    this.closeBoardModalBtn.addEventListener('click', () => this.closeBoardModal());
    this.cancelBoardModalBtn.addEventListener('click', () => this.closeBoardModal());
    this.boardForm.addEventListener('submit', (e) => this.handleBoardSubmit(e));

    // Post Modals Controls
    this.openPostModalBtn.addEventListener('click', () => this.openPostModal());
    this.fabBtn.addEventListener('click', () => this.openPostModal());
    this.closePostModalBtn.addEventListener('click', () => this.closePostModal());
    this.cancelPostModalBtn.addEventListener('click', () => this.closePostModal());

    this.closeLightboxBtn.addEventListener('click', () => this.closeLightbox());
    this.lightboxModal.addEventListener('click', (e) => {
      if (e.target === this.lightboxModal) this.closeLightbox();
    });

    // Color Picker Selection
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedColor = opt.getAttribute('data-color');
      });
    });

    // Image Upload Handling
    this.imageDropZone.addEventListener('click', (e) => {
      e.preventDefault();
      this.imageFileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.imageDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.imageDropZone.style.borderColor = 'var(--accent-primary)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.imageDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.imageDropZone.style.borderColor = '';
      }, false);
    });

    this.imageDropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleImageFile(files[0]);
      }
    });

    this.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleImageFile(e.target.files[0]);
      }
    });

    this.imageUrlInput.addEventListener('input', (e) => {
      if (e.target.value) {
        this.currentImageData = e.target.value;
        this.imagePreview.src = e.target.value;
        this.imagePreviewContainer.style.display = 'block';
      }
    });
    this.removeImageBtn.addEventListener('click', () => this.clearImagePreview());

    // Form Submissions
    this.postForm.addEventListener('submit', (e) => this.handlePostSubmit(e));
  }

  /* --- Boards Management --- */
  async loadUserBoards() {
    this.boards = await db.getBoards();
    this.updateBoardDropdown();
    this.openNewBoardModalBtn.style.display = 'flex';

    // Restore last visited board or fallback to public
    const savedBoardId = localStorage.getItem('the_pad_last_active_board') || PUBLIC_BOARD_ID;
    this.selectBoard(savedBoardId);
  }

  updateBoardDropdown() {
    this.boardSelect.innerHTML = '';
    this.boards.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = (b.id === PUBLIC_BOARD_ID ? '' : '📌 ') + b.title;
      this.boardSelect.appendChild(opt);
    });
  }

  selectBoard(boardId) {
    let board = this.boards.find(b => b.id === boardId);
    if (!board) {
      board = PUBLIC_BOARD;
      boardId = PUBLIC_BOARD_ID;
    }

    this.activeBoard = board;
    this.boardSelect.value = boardId;
    this.boardTitle.textContent = board.title;
    this.boardDescription.textContent = board.description || 'Bacheca condivisa';

    // Persist last active board choice
    localStorage.setItem('the_pad_last_active_board', boardId);

    // Show delete button only if it's a personal board belonging to user
    if (db.currentUser && board.id !== PUBLIC_BOARD_ID && board.user_id === db.currentUser.id) {
      this.deleteBoardBtn.style.display = 'flex';
    } else {
      this.deleteBoardBtn.style.display = 'none';
    }

    db.fetchFromSupabase(boardId);
  }

  openBoardModal() {
    this.boardModal.classList.add('active');
    document.getElementById('boardTitleInput').focus();
  }

  closeBoardModal() {
    this.boardModal.classList.remove('active');
    this.boardForm.reset();
  }

  async handleBoardSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('boardTitleInput').value.trim();
    const desc = document.getElementById('boardDescInput').value.trim();

    if (!title) return;

    try {
      const newBoard = await db.createBoard(title, desc);
      this.boards.push(newBoard);
      this.updateBoardDropdown();
      this.selectBoard(newBoard.id);
      this.closeBoardModal();
      this.showToast('🎉 Nuova bacheca creata!');
    } catch (err) {
      this.showToast('⚠️ Errore creazione bacheca: ' + err.message);
    }
  }

  async handleDeleteBoard() {
    if (!this.activeBoard || this.activeBoard.id === PUBLIC_BOARD_ID) return;

    const confirmMsg = `Sei sicuro di voler eliminare la tua bacheca "${this.activeBoard.title}"? Scomparirà dalle tue bacheche.`;
    if (!confirm(confirmMsg)) return;

    try {
      await db.deleteBoard(this.activeBoard.id);
      this.showToast('🗑️ Bacheca eliminata con successo');
      await this.loadUserBoards();
      this.selectBoard(PUBLIC_BOARD_ID);
    } catch (err) {
      this.showToast('⚠️ Errore eliminazione: ' + err.message);
    }
  }

  /* --- Theme Toggle --- */
  initTheme() {
    const savedTheme = localStorage.getItem('the_pad_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('the_pad_theme', next);
    this.themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
    this.showToast(`Tema cambiato in ${next === 'dark' ? 'Scuro 🌙' : 'Chiaro ☀️'}`);
  }

  /* --- View Mode Switcher --- */
  initViewMode() {
    this.setViewMode(this.currentView, false);
  }

  setViewMode(mode, showNotification = true) {
    this.currentView = mode;
    localStorage.setItem('the_pad_view_mode', mode);

    this.viewGridBtn.classList.toggle('active', mode === 'grid');
    this.viewCanvasBtn.classList.toggle('active', mode === 'canvas');
    this.viewListBtn.classList.toggle('active', mode === 'list');

    this.boardContainer.className = `board-container ${mode}-view`;

    if (showNotification) {
      const modeNames = { grid: 'Griglia Dinamica 📐', canvas: 'Bacheca Libera 🖐️', list: 'Vista Lista ☰' };
      this.showToast(`Vista cambiata: ${modeNames[mode]}`);
    }

    this.render();
  }

  /* --- Image Handling --- */
  handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.showToast('⚠️ Seleziona un file di tipo immagine valido');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      this.showToast('⚠️ Immagine troppo grande (max 4MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      this.currentImageData = event.target.result;
      this.imagePreview.src = this.currentImageData;
      this.imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  clearImagePreview() {
    this.currentImageData = null;
    this.imageFileInput.value = '';
    this.imageUrlInput.value = '';
    this.imagePreview.src = '';
    this.imagePreviewContainer.style.display = 'none';
  }

  /* --- Modals & Forms --- */
  openPostModal() {
    this.postModal.classList.add('active');
    
    // Auto-fill logged in user's username
    const authorInput = document.getElementById('postAuthorInput');
    if (db.currentUser) {
      const defaultUsername = (db.currentUser.user_metadata && db.currentUser.user_metadata.username) || db.currentUser.email.split('@')[0];
      authorInput.value = defaultUsername;
    } else {
      authorInput.value = 'Anonimo';
    }

    document.getElementById('postContentInput').focus();
  }

  closePostModal() {
    this.postModal.classList.remove('active');
    this.postForm.reset();
    this.clearImagePreview();
  }

  openLightbox(imageSrc) {
    this.lightboxImage.src = imageSrc;
    this.lightboxModal.classList.add('active');
  }

  closeLightbox() {
    this.lightboxModal.classList.remove('active');
  }

  /* --- Form Handlers --- */
  async handlePostSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('postTitleInput').value.trim();
    const content = document.getElementById('postContentInput').value.trim();
    const author = document.getElementById('postAuthorInput').value.trim();
    const tag = document.getElementById('postTagInput').value.trim() || 'Generale';

    if (!content) {
      this.showToast('⚠️ Inserisci un testo per il post');
      return;
    }

    const postData = {
      title,
      content,
      author,
      tag,
      color: this.selectedColor,
      image: this.currentImageData
    };

    try {
      await db.addPost(postData);
      this.closePostModal();
      this.showToast('🎉 Post pubblicato!');
    } catch (err) {
      this.showToast('⚠️ Errore di pubblicazione: ' + err.message);
    }
  }

  updateDbStatus() {
    if (this.connectionState === 'connected') {
      this.dbStatusBadge.className = 'db-status-badge';
      this.dbStatusText.textContent = '⚡ Supabase Cloud Realtime';
    } else if (this.connectionState === 'connecting') {
      this.dbStatusBadge.className = 'db-status-badge local';
      this.dbStatusText.textContent = '🔄 Connessione in corso...';
    } else {
      this.dbStatusBadge.className = 'db-status-badge local';
      this.dbStatusText.textContent = '⚠️ Errore Connessione';
    }
  }

  /* --- Toast Notifications --- */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* --- Render Posts & Cards --- */
  render() {
    this.boardContainer.innerHTML = '';

    // Handle Connection Error State
    if (this.connectionState === 'error') {
      this.boardContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Connessione a Supabase non disponibile</h3>
          <p>Impossibile stabilire il collegamento con il database cloud.<br>Il Pad non è momentaneamente disponibile.</p>
        </div>
      `;
      return;
    }

    // Handle Loading State
    if (this.connectionState === 'connecting' && this.currentPosts.length === 0) {
      this.boardContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔄</div>
          <h3>Caricamento della bacheca...</h3>
          <p>Attendi un istante il recupero delle note dal database cloud.</p>
        </div>
      `;
      return;
    }

    const query = this.searchInput.value.toLowerCase().trim();
    let filteredPosts = this.currentPosts;
    
    if (query) {
      filteredPosts = this.currentPosts.filter(p => 
        (p.title && p.title.toLowerCase().includes(query)) ||
        (p.content && p.content.toLowerCase().includes(query)) ||
        (p.author && p.author.toLowerCase().includes(query)) ||
        (p.tag && p.tag.toLowerCase().includes(query))
      );
    }

    if (filteredPosts.length === 0) {
      this.boardContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📌</div>
          <h3>Nessun post presente in questa bacheca</h3>
          <p>${query ? 'Nessun risultato corrisponde alla tua ricerca.' : 'Sii il primo a pubblicare una nota o un\'immagine!'}</p>
        </div>
      `;
      return;
    }

    filteredPosts.forEach(post => {
      const card = this.createCardElement(post);
      this.boardContainer.appendChild(card);

      // Enable Freeform Dragging if Canvas Mode
      if (this.currentView === 'canvas') {
        makeCardDraggable(card, post.id);
      }
    });
  }

  createCardElement(post) {
    const card = document.createElement('article');
    card.className = `post-card note-color-${post.color || 'purple'}`;
    card.dataset.id = post.id;

    // Apply Position in Canvas Mode
    if (this.currentView === 'canvas') {
      card.style.left = `${post.x || 40}px`;
      card.style.top = `${post.y || 40}px`;
    }

    const timestamp = post.created_at || post.createdAt || Date.now();
    const timeFormatted = new Date(Number(timestamp)).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    const initial = (post.author || 'A').charAt(0).toUpperCase();

    // HTML Structure
    let mediaHtml = post.image ? `
      <div class="card-media">
        <img src="${post.image}" alt="${post.title || 'Immagine post'}" loading="lazy">
      </div>
    ` : '';

    let reactionsList = ['❤️', '🔥', '👍', '💡', '🚀'].map(emoji => {
      const count = (post.reactions && post.reactions[emoji]) || 0;
      return `
        <button class="reaction-btn ${count > 0 ? 'active' : ''}" data-emoji="${emoji}">
          <span>${emoji}</span> <span>${count}</span>
        </button>
      `;
    }).join('');

    let commentsHtml = (post.comments || []).map(c => `
      <div class="comment-item">
        <span class="comment-author">${this.escapeHtml(c.author)}:</span>
        <span>${this.escapeHtml(c.text)}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${this.escapeHtml(post.title || 'Senza titolo')}</h3>
        <div class="card-actions">
          <button class="btn-card-action delete" title="Elimina post">&times;</button>
        </div>
      </div>

      ${mediaHtml}

      <div class="card-body">${this.escapeHtml(post.content)}</div>

      <div class="card-reactions">
        ${reactionsList}
      </div>

      <div class="card-comments">
        ${commentsHtml}
        <div class="comment-input-row">
          <input type="text" class="comment-input" placeholder="Scrivi un commento..." maxlength="150">
          <button class="btn-send-comment" title="Invia">➤</button>
        </div>
      </div>

      <div class="card-meta">
        <div class="author-tag">
          <div class="author-avatar">${initial}</div>
          <span>${this.escapeHtml(post.author)}</span>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 99px;">${this.escapeHtml(post.tag)}</span>
          <span class="post-time">${timeFormatted}</span>
        </div>
      </div>
    `;

    // Add Internal Card Events
    const deleteBtn = card.querySelector('.btn-card-action.delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Sei sicuro di voler eliminare questo post?')) {
        db.deletePost(post.id);
        this.showToast('Post eliminato');
      }
    });

    if (post.image) {
      const mediaImg = card.querySelector('.card-media img');
      mediaImg.addEventListener('click', () => this.openLightbox(post.image));
    }

    // Reaction Buttons Click
    const reactionBtns = card.querySelectorAll('.reaction-btn');
    reactionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji');
        db.addReaction(post.id, emoji);
      });
    });

    // Add Comment Handling
    const commentInput = card.querySelector('.comment-input');
    const sendCommentBtn = card.querySelector('.btn-send-comment');

    const submitComment = () => {
      const text = commentInput.value.trim();
      if (!text) return;
      const defaultUser = db.currentUser ? 
        ((db.currentUser.user_metadata && db.currentUser.user_metadata.username) || db.currentUser.email.split('@')[0])
        : 'Anonimo';
      db.addComment(post.id, { author: defaultUser, text });
      commentInput.value = '';
    };

    sendCommentBtn.addEventListener('click', submitComment);
    commentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitComment();
    });

    return card;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
