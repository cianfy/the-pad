/* ==========================================================================
   THE PAD - Database Layer (db.js)
   Handles LocalStorage, Tab Synchronization & Supabase Cloud Realtime Sync
   ========================================================================== */

const STORAGE_KEY = 'the_pad_posts_v1';
const DB_CONFIG_KEY = 'the_pad_supabase_config_v1';
const CHANNEL_NAME = 'the_pad_sync_channel';

// Initial Demo Posts if storage is empty
const INITIAL_DEMO_POSTS = [
  {
    id: 'demo-1',
    title: '👋 Benvenuto su The Pad!',
    content: 'Questo è un post di esempio sulla tua bacheca interattiva! Puoi aggiungere note con testo, immagini, colori personalizzati e tag.',
    author: 'Admin',
    color: 'purple',
    tag: 'Benvenuto',
    image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
    reactions: { '❤️': 5, '🔥': 3, '💡': 2 },
    comments: [
      { author: 'Marco', text: 'Spettacolare questa bacheca!' },
      { author: 'Elena', text: 'Funziona benissimo anche da smartphone.' }
    ],
    x: 40,
    y: 40,
    created_at: Date.now() - 3600000 * 2
  },
  {
    id: 'demo-2',
    title: '⚡ Connesso a Supabase',
    content: 'Questa app è pronta per Supabase! Collega le tue chiavi Supabase nelle impostazioni (⚡) per condividere i post con tutti gli utenti sul web.',
    author: 'Fabio',
    color: 'teal',
    tag: 'Guide',
    image: null,
    reactions: { '🚀': 8, '👍': 4 },
    comments: [],
    x: 400,
    y: 60,
    created_at: Date.now() - 3600000
  },
  {
    id: 'demo-3',
    title: '🎨 Prova la Vista Libera!',
    content: 'Clicca sull\'icona 🖐️ in alto per passare alla modalità Bacheca Libera e trascina queste schedine dove vuoi sul canvas!',
    author: 'Design Team',
    color: 'pink',
    tag: 'Features',
    image: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=800&q=80',
    reactions: { '🔥': 6 },
    comments: [],
    x: 760,
    y: 120,
    created_at: Date.now()
  }
];

class DatabaseService {
  constructor() {
    this.listeners = [];
    this.isCloudActive = false;
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

  // Check if Supabase is configured
  _initSupabase() {
    if (typeof localStorage === 'undefined') return;
    const configRaw = localStorage.getItem(DB_CONFIG_KEY);
    
    if (configRaw && window.supabase) {
      try {
        const config = JSON.parse(configRaw);
        if (config.url && config.key) {
          this.supabaseClient = window.supabase.createClient(config.url, config.key);
          this.isCloudActive = true;
          console.log('⚡ Connesso a Supabase Realtime Database');
          
          // Initial Fetch from Supabase
          this.fetchFromSupabase();

          // Real-time Supabase Subscription
          this.supabaseClient
            .channel('public:posts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
              this.fetchFromSupabase();
            })
            .subscribe();
        }
      } catch (e) {
        console.error('Errore inizializzazione Supabase config:', e);
      }
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
        return;
      }

      if (data) {
        this._saveLocal(data);
        this._notifyListeners();
      }
    } catch (err) {
      console.error('Errore fetch Supabase:', err);
    }
  }

  // Subscribe to Post Updates
  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getPosts());
  }

  _notifyListeners() {
    const posts = this.getPosts();
    this.listeners.forEach(cb => cb(posts));
  }

  // Get all posts (local or cached)
  getPosts() {
    if (typeof localStorage === 'undefined') return INITIAL_DEMO_POSTS;
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this._saveLocal(INITIAL_DEMO_POSTS);
      return INITIAL_DEMO_POSTS;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return INITIAL_DEMO_POSTS;
    }
  }

  _saveLocal(posts) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    }
  }

  // Add a new post
  async addPost(postData) {
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

    const posts = this.getPosts();
    posts.unshift(newPost);
    this._saveLocal(posts);

    if (this.isCloudActive && this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient.from('posts').insert([newPost]);
        if (error) console.error('Errore inserimento Supabase:', error.message);
      } catch (err) {
        console.error('Errore salvataggio Supabase Cloud:', err);
      }
    }

    this._broadcastUpdate();
    return newPost;
  }

  // Delete a post
  async deletePost(id) {
    let posts = this.getPosts();
    posts = posts.filter(p => p.id !== id);
    this._saveLocal(posts);

    if (this.isCloudActive && this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient.from('posts').delete().eq('id', id);
        if (error) console.error('Errore eliminazione Supabase:', error.message);
      } catch (err) {
        console.error('Errore eliminazione Supabase Cloud:', err);
      }
    }

    this._broadcastUpdate();
  }

  // Add/Toggle reaction
  async addReaction(postId, reactionEmoji) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.reactions) post.reactions = {};
    post.reactions[reactionEmoji] = (post.reactions[reactionEmoji] || 0) + 1;

    this._saveLocal(posts);

    if (this.isCloudActive && this.supabaseClient) {
      try {
        await this.supabaseClient
          .from('posts')
          .update({ reactions: post.reactions })
          .eq('id', postId);
      } catch (err) {
        console.error('Errore reazione Supabase:', err);
      }
    }

    this._broadcastUpdate();
  }

  // Add a comment to a post
  async addComment(postId, commentObj) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.comments) post.comments = [];
    post.comments.push(commentObj);

    this._saveLocal(posts);

    if (this.isCloudActive && this.supabaseClient) {
      try {
        await this.supabaseClient
          .from('posts')
          .update({ comments: post.comments })
          .eq('id', postId);
      } catch (err) {
        console.error('Errore commento Supabase:', err);
      }
    }

    this._broadcastUpdate();
  }

  // Update canvas coordinates (x, y)
  async updatePostPosition(postId, x, y) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    post.x = x;
    post.y = y;

    this._saveLocal(posts);

    if (this.isCloudActive && this.supabaseClient) {
      try {
        await this.supabaseClient
          .from('posts')
          .update({ x, y })
          .eq('id', postId);
      } catch (err) {
        console.error('Errore posizione Supabase:', err);
      }
    }
  }

  // Save Supabase Config
  saveSupabaseConfig(config) {
    localStorage.setItem(DB_CONFIG_KEY, JSON.stringify(config));
    location.reload();
  }

  // Disconnect Cloud
  disconnectCloud() {
    localStorage.removeItem(DB_CONFIG_KEY);
    location.reload();
  }

  _broadcastUpdate() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage('posts_updated');
    }
    this._notifyListeners();
  }
}

export const db = new DatabaseService();
