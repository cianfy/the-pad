/* ==========================================================================
   THE PAD - Database Layer (db.js)
   Embedded Supabase Realtime Database & Auth Integration
   ========================================================================== */

const STORAGE_KEY = 'the_pad_posts_v1';
const CHANNEL_NAME = 'the_pad_sync_channel';

// Hardcoded Supabase Credentials
const SUPABASE_URL = 'https://zeeoombtaehsavzejaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3vietzxqEFQxRj90McPFQA_V8FcoPnf';

export const PUBLIC_BOARD_ID = 'public-community-board';
export const PUBLIC_BOARD = {
  id: PUBLIC_BOARD_ID,
  title: '🌐 Bacheca della Community',
  description: 'Bacheca condivisa pubblica. Ognuno può pubblicare quello che vuole!'
};

class DatabaseService {
  constructor() {
    this.listeners = [];
    this.connectionState = 'connecting'; // 'connecting', 'connected', 'error'
    this.connectionError = null;
    this.supabaseClient = null;
    this.currentUser = null;
    this.activeBoardId = localStorage.getItem('the_pad_last_active_board') || PUBLIC_BOARD_ID;
    this.broadcastChannel = null;
    
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data === 'posts_updated') {
          this._notifyListeners();
        }
      };
    }
    
    if (typeof window !== 'undefined') {
      this._initSupabase();
    }
  }

  // Initialize embedded Supabase
  _initSupabase() {
    if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
      try {
        this.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('⚡ Connesso nativamente a Supabase Database & Auth');
        
        // Get Current Session User
        this.supabaseClient.auth.getSession().then(({ data }) => {
          this.currentUser = data && data.session ? data.session.user : null;
          this.fetchFromSupabase(this.activeBoardId);
        });

        // Real-time Supabase Subscription for instant cross-client updates
        this.supabaseClient
          .channel('public:posts')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
            if (this.activeBoardId) {
              this.fetchFromSupabase(this.activeBoardId);
            }
          })
          .subscribe();

        this.connectionState = 'connected';
      } catch (e) {
        console.error('Errore inizializzazione Supabase:', e);
        this.connectionState = 'error';
        this.connectionError = e.message || 'Errore di connessione';
        this._notifyListeners();
      }
    } else {
      this.connectionState = 'error';
      this.connectionError = 'Credenziali Supabase non configurate';
      this._notifyListeners();
    }
  }

  /* --- Auth API --- */
  async signUp(email, password, username) {
    if (!this.supabaseClient) throw new Error('Supabase non inizializzato');
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;

    const { data, error } = await this.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: redirectUrl
      }
    });

    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    if (!this.supabaseClient) throw new Error('Supabase non inizializzato');
    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    this.currentUser = data.user;
    return data;
  }

  async signOut() {
    if (!this.supabaseClient) return;
    const { error } = await this.supabaseClient.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
    this.activeBoardId = PUBLIC_BOARD_ID;
    localStorage.setItem('the_pad_last_active_board', PUBLIC_BOARD_ID);
    this.fetchFromSupabase(PUBLIC_BOARD_ID);
    this._notifyListeners();
  }

  onAuthStateChange(callback) {
    if (this.supabaseClient) {
      this.supabaseClient.auth.onAuthStateChange((event, session) => {
        this.currentUser = session ? session.user : null;
        callback(this.currentUser);
      });
    }
  }

  /* --- Boards API --- */
  async getBoards() {
    const list = [PUBLIC_BOARD];

    if (!this.supabaseClient) return list;

    // Ensure user session is loaded
    if (!this.currentUser) {
      try {
        const { data } = await this.supabaseClient.auth.getSession();
        if (data && data.session) {
          this.currentUser = data.session.user;
        }
      } catch (e) {}
    }

    if (!this.currentUser) {
      return list;
    }

    try {
      const { data, error } = await this.supabaseClient
        .from('boards')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Errore lettura bacheche personali:', error.message);
        return list;
      }

      const userBoards = (data || []).filter(b => b.id !== PUBLIC_BOARD_ID);
      return [PUBLIC_BOARD, ...userBoards];
    } catch (e) {
      console.error('Errore getBoards:', e);
      return list;
    }
  }

  async createBoard(title, description = '') {
    if (!this.supabaseClient || !this.currentUser) {
      throw new Error('Devi effettuare l\'accesso per creare una bacheca');
    }

    const newBoard = {
      id: 'board-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      user_id: this.currentUser.id,
      title,
      description,
      is_archived: false,
      created_at: Date.now()
    };

    const { error } = await this.supabaseClient.from('boards').insert([newBoard]);
    if (error) throw new Error(error.message);

    return newBoard;
  }

  // Soft Delete Board
  async deleteBoard(boardId) {
    if (boardId === PUBLIC_BOARD_ID) {
      throw new Error('Impossibile eliminare la bacheca pubblica della community');
    }
    if (!this.supabaseClient || !this.currentUser) return;

    const { error } = await this.supabaseClient
      .from('boards')
      .update({ is_archived: true })
      .eq('id', boardId)
      .eq('user_id', this.currentUser.id);

    if (error) {
      console.error('Errore archiviazione bacheca:', error.message);
      throw new Error(error.message);
    }
  }

  /* --- Posts API Scoped by Board --- */
  async fetchFromSupabase(boardId = PUBLIC_BOARD_ID) {
    if (!this.supabaseClient) return;
    this.activeBoardId = boardId;
    localStorage.setItem('the_pad_last_active_board', boardId);

    try {
      const { data, error } = await this.supabaseClient
        .from('posts')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Errore lettura Supabase:', error.message);
        this.connectionState = 'error';
        this.connectionError = error.message;
        this._notifyListeners();
        return;
      }

      this.connectionState = 'connected';
      this.connectionError = null;
      if (data) {
        this._saveLocal(data);
      }
      this._notifyListeners();
    } catch (err) {
      console.error('Errore fetch Supabase:', err);
      this.connectionState = 'error';
      this.connectionError = err.message || 'Connessione a Supabase non disponibile';
      this._notifyListeners();
    }
  }

  // Subscribe to Post Updates
  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getPosts(), this.connectionState, this.connectionError);
  }

  _notifyListeners() {
    const posts = this.getPosts();
    this.listeners.forEach(cb => cb(posts, this.connectionState, this.connectionError));
  }

  // Get all posts from cache
  getPosts() {
    if (typeof localStorage === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  _saveLocal(posts) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    }
  }

  // Add a new post
  async addPost(postData) {
    const defaultAuthor = this.currentUser ? 
      ((this.currentUser.user_metadata && this.currentUser.user_metadata.username) || this.currentUser.email.split('@')[0])
      : 'Anonimo';

    const newPost = {
      id: 'post-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      board_id: this.activeBoardId || PUBLIC_BOARD_ID,
      user_id: this.currentUser ? this.currentUser.id : null,
      title: postData.title || '',
      content: postData.content || '',
      author: postData.author || defaultAuthor,
      color: postData.color || 'purple',
      tag: postData.tag || 'Generale',
      image: postData.image || null,
      reactions: {},
      comments: [],
      x: postData.x || Math.floor(Math.random() * 200) + 50,
      y: postData.y || Math.floor(Math.random() * 200) + 50,
      created_at: Date.now()
    };

    const { error } = await this.supabaseClient.from('posts').insert([newPost]);
    if (error) throw new Error(error.message);

    await this.fetchFromSupabase(this.activeBoardId);
    this._broadcastUpdate();
    return newPost;
  }

  // Delete a post
  async deletePost(id) {
    if (!this.supabaseClient || !this.activeBoardId) return;

    const posts = this.getPosts().filter(p => p.id !== id);
    this._saveLocal(posts);
    this._notifyListeners();

    const { error } = await this.supabaseClient.from('posts').delete().eq('id', id);
    if (error) console.error('Errore eliminazione Supabase:', error.message);

    await this.fetchFromSupabase(this.activeBoardId);
    this._broadcastUpdate();
  }

  // Add/Toggle reaction (Instant UI update + Async Supabase sync)
  async addReaction(postId, reactionEmoji) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.reactions) post.reactions = {};
    post.reactions[reactionEmoji] = (post.reactions[reactionEmoji] || 0) + 1;

    // Instant optimistic UI update
    this._saveLocal(posts);
    this._notifyListeners();

    if (this.supabaseClient) {
      try {
        await this.supabaseClient
          .from('posts')
          .update({ reactions: post.reactions })
          .eq('id', postId);
      } catch (err) {
        console.error('Errore reazione Supabase:', err);
      }
    }
  }

  // Add a comment (Instant UI update + Async Supabase sync)
  async addComment(postId, commentObj) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.comments) post.comments = [];
    post.comments.push(commentObj);

    // Instant optimistic UI update
    this._saveLocal(posts);
    this._notifyListeners();

    if (this.supabaseClient) {
      try {
        await this.supabaseClient
          .from('posts')
          .update({ comments: post.comments })
          .eq('id', postId);
      } catch (err) {
        console.error('Errore commento Supabase:', err);
      }
    }
  }

  // Update canvas coordinates (x, y)
  async updatePostPosition(postId, x, y) {
    if (!this.supabaseClient || !this.activeBoardId) return;

    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    post.x = x;
    post.y = y;

    this._saveLocal(posts);

    await this.supabaseClient
      .from('posts')
      .update({ x, y })
      .eq('id', postId);
  }

  _broadcastUpdate() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage('posts_updated');
    }
  }
}

export const db = new DatabaseService();
