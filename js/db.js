/* ==========================================================================
   THE PAD - Database Layer (db.js)
   Embedded Supabase Realtime Database Connection
   ========================================================================== */

const STORAGE_KEY = 'the_pad_posts_v1';
const CHANNEL_NAME = 'the_pad_sync_channel';

// Hardcoded Supabase Credentials
const SUPABASE_URL = 'https://zeeoombtaehsavzejaue.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3vietzxqEFQxRj90McPFQA_V8FcoPnf';

class DatabaseService {
  constructor() {
    this.listeners = [];
    this.connectionState = 'connecting'; // 'connecting', 'connected', 'error'
    this.connectionError = null;
    this.supabaseClient = null;
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
        console.log('⚡ Connesso nativamente a Supabase Database');
        
        // Fetch posts from Cloud
        this.fetchFromSupabase();

        // Real-time Supabase Subscription
        this.supabaseClient
          .channel('public:posts')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
            this.fetchFromSupabase();
          })
          .subscribe();
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

  async fetchFromSupabase() {
    if (!this.supabaseClient) return;
    try {
      const { data, error } = await this.supabaseClient
        .from('posts')
        .select('*')
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
    if (this.connectionState !== 'connected' || !this.supabaseClient) {
      throw new Error('Impossibile pubblicare: connessione a Supabase non disponibile');
    }

    const newPost = {
      id: 'post-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: postData.title || '',
      content: postData.content || '',
      author: postData.author || 'Anonimo',
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

    await this.fetchFromSupabase();
    this._broadcastUpdate();
    return newPost;
  }

  // Delete a post
  async deletePost(id) {
    if (this.connectionState !== 'connected' || !this.supabaseClient) return;

    const { error } = await this.supabaseClient.from('posts').delete().eq('id', id);
    if (error) console.error('Errore eliminazione Supabase:', error.message);

    await this.fetchFromSupabase();
    this._broadcastUpdate();
  }

  // Add/Toggle reaction
  async addReaction(postId, reactionEmoji) {
    if (this.connectionState !== 'connected' || !this.supabaseClient) return;

    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.reactions) post.reactions = {};
    post.reactions[reactionEmoji] = (post.reactions[reactionEmoji] || 0) + 1;

    await this.supabaseClient
      .from('posts')
      .update({ reactions: post.reactions })
      .eq('id', postId);

    this._broadcastUpdate();
  }

  // Add a comment to a post
  async addComment(postId, commentObj) {
    if (this.connectionState !== 'connected' || !this.supabaseClient) return;

    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.comments) post.comments = [];
    post.comments.push(commentObj);

    await this.supabaseClient
      .from('posts')
      .update({ comments: post.comments })
      .eq('id', postId);

    this._broadcastUpdate();
  }

  // Update canvas coordinates (x, y)
  async updatePostPosition(postId, x, y) {
    if (this.connectionState !== 'connected' || !this.supabaseClient) return;

    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    post.x = x;
    post.y = y;

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
