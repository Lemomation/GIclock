// Supabase sync layer for GIclock
// Works offline-first: stores to localStorage, syncs to Supabase when connected

const SUPABASE_URL = 'https://ronwmksgdwvibqkdngty.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbndta3NnZHd2aWJxNGRuZ3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAxNTYwMDAwMH0.DEVELOPER_KEY_HERE';

class SupabaseSync {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingOps = [];
    this.listeners = [];
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async fetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const defaultOptions = {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    };
    
    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Supabase fetch error:', error);
      this.enqueueOp(endpoint, options);
      return null;
    }
  }

  async get(table, query = '*', filters = {}) {
    let endpoint = `${table}?${Object.entries(filters).map(([k,v]) => `${k}=eq.${v}`).join('&')}`;
    if (query !== '*') endpoint += `&select=${query}`;
    return this.fetch(endpoint, { method: 'GET' });
  }

  async insert(table, data) {
    return this.fetch(table, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async update(table, id, data) {
    return this.fetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async upsertProfile(profileData) {
    // Try to get existing profile
    const existing = await this.get('profile', 'id', { user_id: 'self' });
    
    if (existing && existing.length > 0) {
      return this.update('profile', existing[0].id, profileData);
    } else {
      return this.insert('profile', { ...profileData, user_id: 'self' });
    }
  }

  async saveSession(sessionData) {
    return this.insert('sessions', sessionData);
  }

  async saveUnlocks(unlockData) {
    return this.insert('unlocks', unlockData);
  }

  enqueueOp(endpoint, options) {
    this.pendingOps.push({ endpoint, options, timestamp: Date.now() });
    localStorage.setItem('giclock_pending_ops', JSON.stringify(this.pendingOps));
  }

  async flushPendingOps() {
    if (this.pendingOps.length === 0) return;
    
    const ops = [...this.pendingOps];
    this.pendingOps = [];
    localStorage.removeItem('giclock_pending_ops');
    
    for (const op of ops) {
      await this.fetch(op.endpoint, op.options);
    }
  }

  handleOnline() {
    this.isOnline = true;
    this.flushPendingOps();
    this.notifyListeners('online');
  }

  handleOffline() {
    this.isOnline = false;
    this.notifyListeners('offline');
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(status) {
    this.listeners.forEach(cb => cb(status));
  }

  async syncAll(state) {
    if (!this.isOnline) return;
    
    try {
      await this.upsertProfile({
        gems: state.gems,
        fates: state.fates,
        sessions_completed: state.sessionsCompleted,
        total_study_time: state.totalStudyTime,
        streak: state.streak,
        last_study_date: state.lastStudyDate,
        equipped_character: state.equippedCharacter,
        pity_5star: state.pity5star,
        pity_4star: state.pity4star
      });
      
      // Save roster
      const rosterData = JSON.stringify(state.roster);
      await this.update('profile', 1, { roster_data: rosterData });
      
    } catch (error) {
      console.error('Sync error:', error);
      this.enqueueOp('profile', { method: 'POST' });
    }
  }
}

// Initialize sync
const sync = new SupabaseSync();

// Register sync listeners
sync.onStatusChange((status) => {
  const indicator = document.getElementById('sync-status');
  if (indicator) {
    indicator.textContent = status === 'online' ? '🟢 Synced' : '🟡 Offline';
  }
});

// Hook into app saveState
const originalSaveState = GIClock.prototype.saveState;
GIClock.prototype.saveState = function() {
  originalSaveState.call(this);
  setTimeout(() => sync.syncAll(this.state), 1000);
};
