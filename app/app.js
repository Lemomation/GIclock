// GIclock - Study with Teyvat
// Core game logic and timer management

class GIClock {
  constructor() {
    // Game state
    this.state = {
      gems: 0,
      fates: 0,
      sessionsCompleted: 0,
      totalStudyTime: 0,
      streak: 0,
      lastStudyDate: null,
      equippedCharacter: null,
      roster: [],
      pity5star: 0,
      pity4star: 0,
      settings: {
        pomodoroDuration: 25,
        shortBreak: 5,
        longBreak: 15,
        gemsPerMinute: 1
      }
    };

    // Timer state
    this.timer = null;
    this.timeLeft = 0;
    this.totalTime = 0;
    this.isRunning = false;
    this.mode = 'pomodoro'; // 'pomodoro', 'short_break', 'long_break'
    this.sessionsInCycle = 0;

    // Pity system constants (matching Genshin)
    this.PITY_5STAR_HARD = 90;
    this.PITY_5STAR_SOFT = 74;
    this.PITY_4STAR_HARD = 10;
    this.PROBABILITY_5STAR_BASE = 0.006;
    this.PROBABILITY_4STAR_BASE = 0.051;

    // Character data
    this.characters = [
      {
        id: 'char_Columbina',
        name: 'Columbina',
        rarity: 5,
        element: 'Hydro',
        pfp: 'assets/characters/char_Columbina/pfp.jpg',
        background: 'assets/characters/char_Columbina/bg.jpg',
        namecard: 'assets/characters/char_Columbina/namecard.jpg',
        banner: 'assets/characters/char_Columbina/banner.jpg',
        friendshipLevels: [
          { level: 2, reward: 'pfp' },
          { level: 4, reward: 'background' },
          { level: 6, reward: 'accent' },
          { level: 10, reward: 'namecard' }
        ]
      }
    ];

    this.init();
  }

  init() {
    this.loadState();
    this.setupEventListeners();
    this.updateUI();
    this.checkStreak();
  }

  loadState() {
    const saved = localStorage.getItem('giclock_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    }
  }

  saveState() {
    localStorage.setItem('giclock_state', JSON.stringify(this.state));
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Timer controls
    document.getElementById('start-btn').addEventListener('click', () => this.toggleTimer());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetTimer());

    // Pull buttons
    document.getElementById('pull-1').addEventListener('click', () => this.pull(1));
    document.getElementById('pull-10').addEventListener('click', () => this.pull(10));

    // Settings
    document.getElementById('pomodoro-time').addEventListener('change', (e) => {
      this.state.settings.pomodoroDuration = parseInt(e.target.value);
      this.saveState();
    });
    document.getElementById('gems-per-min').addEventListener('change', (e) => {
      this.state.settings.gemsPerMinute = parseInt(e.target.value);
      this.saveState();
    });
  }

  switchTab(tab) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Close all modals
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));

    // Show relevant modal
    if (tab === 'banner') {
      this.openBannerModal();
    } else if (tab === 'roster') {
      this.openRosterModal();
    } else if (tab === 'settings') {
      this.openSettingsModal();
    }
  }

  // ===== TIMER FUNCTIONS =====

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    this.isRunning = true;
    document.getElementById('start-btn').textContent = 'Pause';
    document.getElementById('timer-container').classList.add('timer-active');

    if (this.timeLeft === 0) {
      this.timeLeft = this.state.settings.pomodoroDuration * 60;
      this.totalTime = this.timeLeft;
    }

    const startTime = Date.now();
    const startGems = this.state.gems;
    const gemsPerSecond = this.state.settings.gemsPerMinute / 60;

    this.timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.timeLeft = Math.max(0, this.totalTime - elapsed);

      // Award gems
      const newGems = Math.floor(elapsed * gemsPerSecond);
      if (newGems > 0) {
        this.state.gems += newGems;
        this.showGemEarned(newGems);
      }

      this.updateTimerDisplay();
      this.updateUI();
      this.saveState();

      if (this.timeLeft <= 0) {
        this.completeSession();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.timer);
    document.getElementById('start-btn').textContent = 'Resume';
    document.getElementById('timer-container').classList.remove('timer-active');
  }

  resetTimer() {
    this.pauseTimer();
    this.timeLeft = this.state.settings.pomodoroDuration * 60;
    this.totalTime = this.timeLeft;
    document.getElementById('start-btn').textContent = 'Start';
    this.updateTimerDisplay();
  }

  completeSession() {
    this.pauseTimer();
    
    // Record session
    this.state.sessionsCompleted++;
    this.state.totalStudyTime += this.totalTime / 60;
    this.sessionsInCycle++;

    // Long break after 4 sessions
    if (this.sessionsInCycle >= 4) {
      this.sessionsInCycle = 0;
      this.mode = 'long_break';
      this.timeLeft = this.state.settings.longBreak * 60;
    } else {
      this.mode = 'short_break';
      this.timeLeft = this.state.settings.shortBreak * 60;
    }
    this.totalTime = this.timeLeft;

    // Award bonus gems for completion
    const bonusGems = this.state.settings.gemsPerMinute * 5;
    this.state.gems += bonusGems;
    this.showNotification(`Session complete! +${bonusGems} 💎 bonus`);

    // Update companion friendship
    this.updateFriendship(this.totalTime / 60);

    // Update streak
    this.updateStreak();

    this.updateUI();
    this.saveState();

    // Auto-start break
    setTimeout(() => {
      document.getElementById('mode-label').textContent = 
        this.mode === 'long_break' ? 'Long Break' : 'Short Break';
      this.showNotification(`${this.mode === 'long_break' ? 'Long' : 'Short'} break! Relax 🧃`);
    }, 500);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    document.getElementById('timer-text').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update progress ring
    const progress = (this.totalTime - this.timeLeft) / this.totalTime;
    const circle = document.getElementById('progress-circle');
    const circumference = 2 * Math.PI * 90;
    circle.style.strokeDashoffset = circumference * (1 - progress);
  }

  showGemEarned(amount) {
    // Visual feedback for gem earning
    const gemEl = document.querySelector('.gems-display');
    gemEl.classList.add('gem-earned');
    setTimeout(() => gemEl.classList.remove('gem-earned'), 500);
  }

  // ===== GACHA SYSTEM =====

  openBannerModal() {
    const modal = document.getElementById('banner-modal');
    const char = this.characters[0]; // Columbina for now
    
    document.getElementById('banner-image').src = char.banner;
    document.getElementById('banner-title').textContent = char.name;
    
    // Update pity display
    this.updatePityDisplay();
    
    modal.classList.add('show');
  }

  pull(count) {
    const cost = count * 160;
    if (this.state.gems < cost) {
      this.showNotification('Not enough primogems! 💎', 'error');
      return;
    }

    this.state.gems -= cost;
    const results = [];

    for (let i = 0; i < count; i++) {
      this.state.pity5star++;
      this.state.pity4star++;

      let rarity = 1;
      let chance = this.get5StarProbability();

      if (this.state.pity5star >= this.PITY_5STAR_HARD || Math.random() < chance) {
        rarity = 5;
        this.state.pity5star = 0;
      } else if (this.state.pity4star >= this.PITY_4STAR_HARD || Math.random() < this.PROBABILITY_4STAR_BASE) {
        rarity = 4;
        this.state.pity4star = 0;
      }

      if (rarity === 5) {
        // Get a random 5-star character
        const char = this.characters.find(c => c.rarity === 5);
        if (char && !this.state.roster.find(r => r.id === char.id)) {
          this.addCharacter(char);
          results.push({ rarity, character: char, new: true });
        } else {
          // Convert to fate
          this.state.fates++;
          results.push({ rarity, fate: true });
        }
      } else if (rarity === 4) {
        // 4-star gives half fate
        if (Math.random() < 0.5) {
          this.state.fates++;
          results.push({ rarity, fate: true });
        }
      }
    }

    this.updateUI();
    this.updatePityDisplay();
    this.saveState();
    this.showNotification(`Pulled ${results.length} item(s)! 🎊`);
  }

  get5StarProbability() {
    if (this.state.pity5star < this.PITY_5STAR_SOFT) {
      return this.PROBABILITY_5STAR_BASE;
    }
    // Soft pity: probability ramps up
    return this.PROBABILITY_5STAR_BASE + ((this.state.pity5star - this.PITY_5STAR_SOFT) * 0.06);
  }

  addCharacter(char) {
    const existing = this.state.roster.find(r => r.id === char.id);
    if (existing) {
      // Duplicate: convert to fate
      this.state.fates++;
      this.showNotification(`${char.name} duplicate! Converted to fate 🎯`);
    } else {
      this.state.roster.push({
        ...char,
        friendshipLevel: 1,
        friendshipXP: 0
      });
      this.showNotification(`New companion: ${char.name}! 🌟`);
    }
  }

  updatePityDisplay() {
    const pct5 = (this.state.pity5star / this.PITY_5STAR_HARD) * 100;
    const pct4 = (this.state.pity4star / this.PITY_4STAR_HARD) * 100;
    
    document.getElementById('pity-fill').style.width = `${pct5}%`;
    document.getElementById('pity-count').textContent = 
      `${this.state.pity5star}/${this.PITY_5STAR_HARD} (5★) | ${this.state.pity4star}/${this.PITY_4STAR_HARD} (4★)`;
  }

  // ===== COMPANION SYSTEM =====

  openRosterModal() {
    const modal = document.getElementById('roster-modal');
    const grid = document.getElementById('roster-grid');
    
    // Clear existing cards (except close button)
    Array.from(grid.children).forEach(child => {
      if (child.classList.contains('char-card')) child.remove();
    });

    this.state.roster.forEach(char => {
      const card = document.createElement('div');
      card.className = 'char-card';
      if (this.state.equippedCharacter === char.id) {
        card.classList.add('equipped');
      }
      
      card.innerHTML = `
        <img src="${char.pfp}" alt="${char.name}">
        <div class="char-name">${char.name}</div>
        <div class="char-level">Lv. ${char.friendshipLevel}</div>
      `;
      
      card.addEventListener('click', () => this.equipCharacter(char.id));
      grid.appendChild(card);
    });

    if (this.state.roster.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No companions yet! Pull some characters first 🎊</p>';
    }

    modal.classList.add('show');
  }

  equipCharacter(charId) {
    this.state.equippedCharacter = charId;
    this.saveState();
    this.updateUI();
    this.openRosterModal(); // Refresh
  }

  updateFriendship(studyMinutes) {
    if (!this.state.equippedCharacter) return;
    
    const char = this.state.roster.find(r => r.id === this.state.equippedCharacter);
    if (!char) return;

    // Friendship XP: 100 XP per minute of study
    char.friendshipXP += studyMinutes * 100;

    // Check level up
    const xpNeeded = this.getFriendshipXPForLevel(char.friendshipLevel);
    if (char.friendshipXP >= xpNeeded && char.friendshipLevel < 10) {
      char.friendshipLevel++;
      char.friendshipXP -= xpNeeded;
      this.showNotification(`${char.name} reached Friendship Lv. ${char.friendshipLevel}! 🌟`);
      this.unlockReward(char);
    }
  }

  getFriendshipXPForLevel(level) {
    // Exponential scaling
    return Math.floor(1000 * Math.pow(1.5, level - 1));
  }

  unlockReward(char) {
    const rewardLevel = char.friendshipLevels.find(l => l.level === char.friendshipLevel);
    if (!rewardLevel) return;

    this.showNotification(`Unlocked: ${rewardLevel.reward} for ${char.name}! 🎁`);
    
    // Update equipped character's reward status
    if (this.state.equippedCharacter === char.id) {
      this.updateActiveCompanion();
    }
  }

  updateActiveCompanion() {
    if (!this.state.equippedCharacter) {
      document.getElementById('active-companion').style.display = 'none';
      return;
    }

    const char = this.state.roster.find(r => r.id === this.state.equippedCharacter);
    if (!char) return;

    document.getElementById('active-companion').style.display = 'flex';
    document.getElementById('companion-pfp').src = char.pfp;
    document.getElementById('companion-name').textContent = char.name;
    
    const xpNeeded = this.getFriendshipXPForLevel(char.friendshipLevel);
    const xpPct = (char.friendshipXP / xpNeeded) * 100;
    document.getElementById('friendship-fill').style.width = `${xpPct}%`;
    document.getElementById('friendship-text').textContent = `Lv. ${char.friendshipLevel} • ${char.friendshipXP}/${xpNeeded} XP`;
  }

  // ===== STREAK SYSTEM =====

  checkStreak() {
    const today = new Date().toDateString();
    if (this.state.lastStudyDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (this.state.lastStudyDate !== yesterday) {
        this.state.streak = 0;
      }
    }
  }

  updateStreak() {
    const today = new Date().toDateString();
    if (this.state.lastStudyDate !== today) {
      this.state.streak++;
      this.state.lastStudyDate = today;
    }
  }

  // ===== SETTINGS =====

  openSettingsModal() {
    document.getElementById('settings-modal').classList.add('show');
    document.getElementById('pomodoro-time').value = this.state.settings.pomodoroDuration;
    document.getElementById('gems-per-min').value = this.state.settings.gemsPerMinute;
  }

  saveSettings() {
    this.state.settings.pomodoroDuration = parseInt(document.getElementById('pomodoro-time').value) || 25;
    this.state.settings.gemsPerMinute = parseInt(document.getElementById('gems-per-min').value) || 1;
    this.saveState();
    this.resetTimer();
    closeModal('settings-modal');
    this.showNotification('Settings saved! ✅');
  }

  // ===== UI UPDATE =====

  updateUI() {
    // Resources
    document.getElementById('gem-count').textContent = this.state.gems.toLocaleString();
    document.getElementById('fate-count').textContent = this.state.fates;

    // Stats
    document.getElementById('sessions-today').textContent = this.state.sessionsCompleted;
    document.getElementById('total-gems').textContent = this.state.gems.toLocaleString();
    document.getElementById('streak').textContent = this.state.streak;

    // Active companion
    this.updateActiveCompanion();
  }

  showNotification(message, type = 'info') {
    // Simple notification
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? 'var(--danger)' : 'var(--success)'};
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-weight: bold;
      z-index: 2000;
      animation: fadeIn 0.3s ease;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
}

// ===== GLOBAL FUNCTIONS =====

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Initialize app
const app = new GIClock();
