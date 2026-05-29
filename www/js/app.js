/**
 * BantingScore - 4-Player Scorekeeper App Logic
 * Designed for mobile-first Android PWA with offline & haptic features.
 */

// Application State
let gameState = {
  players: [
    { id: 1, name: 'Pemain 1', score: 0, color: 'var(--player-1)' },
    { id: 2, name: 'Pemain 2', score: 0, color: 'var(--player-2)' },
    { id: 3, name: 'Pemain 3', score: 0, color: 'var(--player-3)' },
    { id: 4, name: 'Pemain 4', score: 0, color: 'var(--player-4)' }
  ],
  rounds: [], // Array of { roundNum: 1, scores: [p1, p2, p3, p4], cumulatives: [p1, p2, p3, p4], jokerIdx: 0 }
  settings: {
    winCondition: 'highest', // 'highest' or 'lowest'
    targetScore: 100, // Score limit, or null
    theme: 'violet', // 'violet', 'teal', 'rose'
    darkMode: false,
    soundEnabled: true,
    vibrateEnabled: true
  },
  matchActive: false,
  completedMatches: [], // History of old matches
  tempInputScores: ['', '', '', ''], // Temp scores during keypad entry
  activeInputPlayerIndex: 0, // Index (0-3) currently typing in keypad
  jokerPlayerIndex: 0 // Index of player who picks joker THIS round
};

// Web Audio API Context for synthesizer sounds
let audioCtx = null;

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initTheme();
  setupEventListeners();
  registerServiceWorker();
  
  if (gameState.matchActive) {
    showView('dashboard');
    updateDashboardUI();
  } else {
    showView('home');
    openNewGameModal();
  }
  
  // Render completed match history list
  renderMatchHistory();
});

// Register PWA Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Registration Failed:', err));
  }
}

// Local Storage Helpers
function saveToStorage() {
  localStorage.setItem('bantingscore_state', JSON.stringify(gameState));
}

function loadFromStorage() {
  const data = localStorage.getItem('bantingscore_state');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      // Deep merge settings
      gameState = { ...gameState, ...parsed };
      gameState.settings = { ...gameState.settings, ...parsed.settings };
    } catch (e) {
      console.error('Error loading saved state:', e);
    }
  }
}

// Haptic feedback using device vibrator
function triggerHaptic(duration = 20) {
  if (gameState.settings.vibrateEnabled && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Ignore vibration errors (security policies in some browsers)
    }
  }
}

// Audio Synthesizer chiptune generator using Web Audio API
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!gameState.settings.soundEnabled) return;
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.08);
      osc.frequency.setValueAtTime(900, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'undo') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'victory') {
      // Triumphant fanfare
      const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25]; // C4, E4, G4, C5, G4, C5
      const times = [0, 0.08, 0.16, 0.24, 0.36, 0.48];
      const durations = [0.08, 0.08, 0.08, 0.12, 0.12, 0.4];

      notes.forEach((freq, idx) => {
        const noteOsc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        noteOsc.connect(noteGain);
        noteGain.connect(audioCtx.destination);
        
        noteOsc.type = 'sine';
        noteOsc.frequency.setValueAtTime(freq, now + times[idx]);
        noteGain.gain.setValueAtTime(0.1, now + times[idx]);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + durations[idx]);
        
        noteOsc.start(now + times[idx]);
        noteOsc.stop(now + times[idx] + durations[idx]);
      });
    }
  } catch (e) {
    console.warn('Audio feedback error:', e);
  }
}

// Theme Management
function initTheme() {
  const body = document.body;
  
  // Set theme color class
  body.className = '';
  if (gameState.settings.darkMode) {
    body.classList.add('dark-theme');
    document.getElementById('btn-dark-mode-icon').innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.38.39-1.02 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.38.39-1.02 0-1.41Z"/>';
  } else {
    body.classList.add('light-theme');
    document.getElementById('btn-dark-mode-icon').innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.57.83-1.53 1.36-2.61 1.36-1.77 0-3.2-1.43-3.2-3.2 0-1.08.53-2.04 1.36-2.61A8.86 8.86 0 0 0 12 3z"/>';
  }
  
  if (gameState.settings.theme) {
    body.classList.add(`theme-${gameState.settings.theme}`);
  }
  
  // Set selected color values for UI inputs
  document.querySelectorAll('.theme-dot').forEach(dot => {
    if (dot.dataset.theme === gameState.settings.theme) {
      dot.classList.add('selected');
    } else {
      dot.classList.remove('selected');
    }
  });

  // Set theme toggles in Settings
  document.getElementById('setting-darkmode').checked = gameState.settings.darkMode;
  document.getElementById('setting-sound').checked = gameState.settings.soundEnabled;
  document.getElementById('setting-vibrate').checked = gameState.settings.vibrateEnabled;
  document.getElementById('setting-wincondition').value = gameState.settings.winCondition;
  document.getElementById('setting-target').value = gameState.settings.targetScore || '';
}

function toggleDarkMode() {
  triggerHaptic(30);
  gameState.settings.darkMode = !gameState.settings.darkMode;
  saveToStorage();
  initTheme();
}

function changeTheme(themeName) {
  triggerHaptic(30);
  gameState.settings.theme = themeName;
  saveToStorage();
  initTheme();
  playSound('tap');
}

// Screen Routing / View Management
function showView(viewId) {
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const activePanel = document.getElementById(`view-${viewId}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }
  
  // Update Bottom Nav state
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.dataset.view === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // If view is stats, draw the chart
  if (viewId === 'stats') {
    setTimeout(renderStatsView, 100);
  }
  if (viewId === 'history') {
    renderHistoryTab();
  }
  
  triggerHaptic(15);
}

// Modal Helpers
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  triggerHaptic(20);
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 250);
  triggerHaptic(15);
}

// Event Listeners Setup
function setupEventListeners() {
  // Bottom navigation buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'dashboard' && !gameState.matchActive) {
        openNewGameModal();
      } else {
        showView(view);
      }
    });
  });

  // Header Actions
  document.getElementById('btn-dark-mode').addEventListener('click', toggleDarkMode);
  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (gameState.matchActive) {
      if (confirm('Apakah Anda ingin membatalkan pertandingan saat ini dan mulai yang baru?')) {
        openNewGameModal();
      }
    } else {
      openNewGameModal();
    }
  });
  
  document.getElementById('btn-settings').addEventListener('click', () => {
    openModal('modal-settings');
  });

  // Modal Close Buttons
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Theme dot selectors
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      changeTheme(dot.dataset.theme);
    });
  });

  // Settings Save
  document.getElementById('btn-save-settings').addEventListener('click', saveSettingsFromForm);
  
  // New Game Start Form
  document.getElementById('btn-start-game').addEventListener('click', startNewGame);

  // Keypad click handlers
  document.querySelectorAll('.btn-key').forEach(btn => {
    btn.addEventListener('click', () => handleKeypadInput(btn.dataset.key));
  });


  // Keypad display clicks to change active player
  document.querySelectorAll('.player-input-column').forEach(col => {
    col.addEventListener('click', () => {
      const idx = parseInt(col.dataset.idx);
      setActiveInputPlayer(idx);
      playSound('tap');
    });
  });

  // Save Round button in Keypad modal
  document.getElementById('btn-save-round').addEventListener('click', saveRoundScore);
  
  // Main Dashboard score input button
  document.getElementById('btn-add-scores').addEventListener('click', openRoundInputModal);

  // Undo button
  document.getElementById('btn-undo-action').addEventListener('click', triggerUndo);
  
  // Reset Game Button in Dashboard
  document.getElementById('btn-reset-match').addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin mengulang skor pertandingan ini dari nol?')) {
      resetCurrentMatch();
    }
  });

  // Complete Match button in Dashboard
  document.getElementById('btn-complete-match').addEventListener('click', () => {
    if (gameState.rounds.length === 0) {
      alert('Mainkan minimal 1 ronde terlebih dahulu sebelum menyelesaikan pertandingan.');
      return;
    }
    if (confirm('Selesaikan pertandingan ini dan simpan di riwayat?')) {
      completeCurrentMatch();
    }
  });

  // Winner Screen Share and New Game Buttons
  document.getElementById('btn-share-result').addEventListener('click', shareMatchResult);
  document.getElementById('btn-winner-new-game').addEventListener('click', () => {
    closeModal('modal-winner');
    openNewGameModal();
  });

  // +/- toggle buttons in edit round modal
  document.querySelectorAll('.btn-toggle-sign').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const current = input.value.trim();
      if (current === '' || current === '0' || current === '-0') {
        input.value = '0';
        return;
      }
      if (current.startsWith('-')) {
        input.value = current.substring(1);
      } else {
        input.value = '-' + current;
      }
      triggerHaptic(15);
      playSound('tap');
    });
  });
}

// Settings Form Handlers
function saveSettingsFromForm() {
  gameState.settings.darkMode = document.getElementById('setting-darkmode').checked;
  gameState.settings.soundEnabled = document.getElementById('setting-sound').checked;
  gameState.settings.vibrateEnabled = document.getElementById('setting-vibrate').checked;
  gameState.settings.winCondition = document.getElementById('setting-wincondition').value;
  
  const targetVal = document.getElementById('setting-target').value;
  gameState.settings.targetScore = targetVal ? parseInt(targetVal) : null;
  
  saveToStorage();
  initTheme();
  closeModal('modal-settings');
  playSound('success');
  
  if (gameState.matchActive) {
    updateDashboardUI();
  }
}

// Open modal to configure new match
function openNewGameModal() {
  // Pre-fill names if existing
  document.getElementById('p1-name-input').value = gameState.players[0].name || 'Pemain 1';
  document.getElementById('p2-name-input').value = gameState.players[1].name || 'Pemain 2';
  document.getElementById('p3-name-input').value = gameState.players[2].name || 'Pemain 3';
  document.getElementById('p4-name-input').value = gameState.players[3].name || 'Pemain 4';
  
  document.getElementById('game-wincondition').value = gameState.settings.winCondition;
  document.getElementById('game-target').value = gameState.settings.targetScore || '';
  
  openModal('modal-new-game');
}

// Start Game from form
function startNewGame() {
  const p1 = document.getElementById('p1-name-input').value.trim() || 'Pemain 1';
  const p2 = document.getElementById('p2-name-input').value.trim() || 'Pemain 2';
  const p3 = document.getElementById('p3-name-input').value.trim() || 'Pemain 3';
  const p4 = document.getElementById('p4-name-input').value.trim() || 'Pemain 4';
  
  gameState.players[0].name = p1;
  gameState.players[0].score = 0;
  
  gameState.players[1].name = p2;
  gameState.players[1].score = 0;
  
  gameState.players[2].name = p3;
  gameState.players[2].score = 0;
  
  gameState.players[3].name = p4;
  gameState.players[3].score = 0;
  
  gameState.rounds = [];
  gameState.matchActive = true;
  
  // Randomize who picks joker first
  gameState.jokerPlayerIndex = Math.floor(Math.random() * 4);
  
  // Set Game rules
  gameState.settings.winCondition = document.getElementById('game-wincondition').value;
  const targetVal = document.getElementById('game-target').value;
  gameState.settings.targetScore = targetVal ? parseInt(targetVal) : null;
  
  saveToStorage();
  
  closeModal('modal-new-game');
  playSound('success');
  showView('dashboard');
  updateDashboardUI();

  // Show popup: siapa yang ambil joker di ronde pertama (acak)
  const firstJoker = gameState.players[gameState.jokerPlayerIndex];
  setTimeout(() => showJokerPopup(firstJoker.name, firstJoker.color, 1), 400);
}

// Reset current match scores to 0
function resetCurrentMatch() {
  gameState.players.forEach(p => p.score = 0);
  gameState.rounds = [];
  saveToStorage();
  updateDashboardUI();
  playSound('undo');
}

// Complete the active match, push to history
function completeCurrentMatch() {
  // Determine winner
  const ranks = getPlayerRanks();
  const winnerIndex = ranks[0];
  const winner = gameState.players[winnerIndex];
  
  // Save match summary
  const matchSummary = {
    id: Date.now(),
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    players: JSON.parse(JSON.stringify(gameState.players)),
    roundsCount: gameState.rounds.length,
    winCondition: gameState.settings.winCondition,
    targetScore: gameState.settings.targetScore,
    winner: winner.name,
    winnerScore: winner.score
  };
  
  gameState.completedMatches.unshift(matchSummary);
  gameState.matchActive = false;
  saveToStorage();
  
  renderMatchHistory();
  
  // Trigger Winner Modal with animation
  document.getElementById('winner-crown-name').innerText = winner.name;
  document.getElementById('winner-crown-score').innerText = `Skor Akhir: ${winner.score} (${gameState.rounds.length} Ronde)`;
  
  openModal('modal-winner');
  playSound('victory');
  triggerConfetti();
}

// Check if any player has reached target score
function checkGameEndCondition() {
  if (!gameState.settings.targetScore) return;
  
  const target = gameState.settings.targetScore;
  const isHighestWin = gameState.settings.winCondition === 'highest';
  
  let reachedTarget = false;
  let crossedPlayers = [];
  
  gameState.players.forEach((p) => {
    if (isHighestWin) {
      if (p.score >= target) {
        reachedTarget = true;
        crossedPlayers.push(p.name);
      }
    } else {
      // In lowest-win games, usually the target acts as a bust/limit score (e.g. reach 100 you lose, game ends).
      if (p.score >= target) {
        reachedTarget = true;
        crossedPlayers.push(p.name);
      }
    }
  });
  
  if (reachedTarget) {
    setTimeout(() => {
      alert(`Pertandingan selesai! ${crossedPlayers.join(', ')} telah mencapai batas skor target ${target} poin.`);
      completeCurrentMatch();
    }, 600);
  }
}

// Compute player ranking indexes sorted by score (first in array is Leader)
function getPlayerRanks() {
  const indices = [0, 1, 2, 3];
  const isHighestWin = gameState.settings.winCondition === 'highest';
  
  indices.sort((a, b) => {
    const scoreA = gameState.players[a].score;
    const scoreB = gameState.players[b].score;
    if (isHighestWin) {
      return scoreB - scoreA; // Descending
    } else {
      return scoreA - scoreB; // Ascending
    }
  });
  
  return indices;
}

// Update the entire Dashboard screen UI
function updateDashboardUI() {
  if (!gameState.matchActive) return;
  
  // Update header titles & sub info
  document.getElementById('bar-round-num').innerText = gameState.rounds.length;
  document.getElementById('bar-target-info').innerText = gameState.settings.targetScore ? `Target: ${gameState.settings.targetScore}` : 'Tanpa Batas';
  document.getElementById('bar-rule-info').innerText = gameState.settings.winCondition === 'highest' ? 'Tinggi Menang' : 'Rendah Menang';

  // Get Rankings
  const ranks = getPlayerRanks();
  const scores = gameState.players.map(p => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const hasMultipleScores = minScore !== maxScore;
  
  // Render each player card
  gameState.players.forEach((p, idx) => {
    const card = document.getElementById(`player-card-${p.id}`);
    card.dataset.idx = idx;
    
    // Set names and scores
    card.querySelector('.player-name').innerText = p.name;
    card.querySelector('.score-number').innerText = p.score;
    
    // Set colors
    card.querySelector('.player-color-dot').style.backgroundColor = p.color;
    
    // Set Ranks
    const rankPos = ranks.indexOf(idx) + 1;
    const badge = card.querySelector('.rank-badge');
    badge.innerText = `#${rankPos}`;

    // Highlight leader card with leading class if rounds are played and scores are not all tied
    if (rankPos === 1 && gameState.rounds.length > 0 && hasMultipleScores) {
      card.classList.add('leading');
    } else {
      card.classList.remove('leading');
    }

    // Highlight lowest score card with lowest-score class if rounds are played and scores are not all tied
    if (p.score === minScore && gameState.rounds.length > 0 && hasMultipleScores) {
      card.classList.add('lowest-score');
    } else {
      card.classList.remove('lowest-score');
    }

    // Show/hide joker badge on this card
    let jokerBadge = card.querySelector('.joker-badge');
    if (gameState.matchActive && idx === gameState.jokerPlayerIndex) {
      if (!jokerBadge) {
        jokerBadge = document.createElement('div');
        jokerBadge.className = 'joker-badge';
        jokerBadge.title = 'Ambil Joker ronde ini';
        jokerBadge.innerHTML = `
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 2H5C3.9 2 3 2.9 3 4v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H5V4h14v16z"/>
            <text x="12" y="16" font-size="10" text-anchor="middle" font-weight="900" font-family="serif">&#9827;</text>
          </svg>
          <span>Joker</span>
        `;
        card.appendChild(jokerBadge);
      }
      jokerBadge.style.display = 'flex';
    } else if (jokerBadge) {
      jokerBadge.style.display = 'none';
    }
  });
  
  // Toggle undo button availability
  document.getElementById('btn-undo-action').disabled = gameState.rounds.length === 0;

  // Render rounds history table below the score cards on the dashboard
  renderHistoryTab();
  
  // Redraw charts if we are on stats page
  if (document.getElementById('view-stats').classList.contains('active')) {
    renderStatsView();
  }
}

// Undo last round
function triggerUndo() {
  if (gameState.rounds.length === 0) return;
  
  if (confirm('Apakah Anda yakin ingin membatalkan ronde terakhir?')) {
    triggerHaptic(50);
    gameState.rounds.pop();
    
    // Recalculate player totals
    if (gameState.rounds.length > 0) {
      const lastRound = gameState.rounds[gameState.rounds.length - 1];
      gameState.players.forEach((p, idx) => {
        p.score = lastRound.cumulatives[idx];
      });
    } else {
      gameState.players.forEach(p => p.score = 0);
    }
    
    saveToStorage();
    updateDashboardUI();
    playSound('undo');
  }
}

// ==========================================
// Virtual Keypad / Round Score Input Logic
// ==========================================
function openRoundInputModal() {
  // Clear temp inputs
  gameState.tempInputScores = ['', '', '', ''];
  gameState.activeInputPlayerIndex = 0;
  
  // Setup labels in Keypad Header
  gameState.players.forEach((p, idx) => {
    const col = document.getElementById(`keypad-player-col-${idx + 1}`);
    col.querySelector('.input-player-name').innerText = p.name;
    col.querySelector('.input-player-dot').style.backgroundColor = p.color;
  });
  
  updateKeypadDisplay();
  openModal('modal-round-input');
}

function setActiveInputPlayer(index) {
  gameState.activeInputPlayerIndex = index;
  updateKeypadDisplay();
}

function updateKeypadDisplay() {
  gameState.players.forEach((p, idx) => {
    const col = document.getElementById(`keypad-player-col-${idx + 1}`);
    const displayBox = col.querySelector('.score-display-box');
    
    // Show typed number or zero/placeholder
    const val = gameState.tempInputScores[idx];
    displayBox.innerText = val === '' ? '0' : val;
    
    if (idx === gameState.activeInputPlayerIndex) {
      col.classList.add('active');
    } else {
      col.classList.remove('active');
    }
  });
}

function handleKeypadInput(key) {
  triggerHaptic(15);
  playSound('tap');
  
  let currentVal = gameState.tempInputScores[gameState.activeInputPlayerIndex];
  
  if (key === 'C') {
    // Clear current value
    currentVal = '';
  } else if (key === 'backspace') {
    // Delete last character
    if (currentVal.length > 0) {
      currentVal = currentVal.slice(0, -1);
    }
  } else if (key === '-') {
    // Toggle negative sign
    if (currentVal.startsWith('-')) {
      currentVal = currentVal.substring(1);
    } else {
      if (currentVal === '') {
        currentVal = '-';
      } else {
        currentVal = '-' + currentVal;
      }
    }
  } else if (key === 'next') {
    // Cycle to next player
    gameState.activeInputPlayerIndex = (gameState.activeInputPlayerIndex + 1) % 4;
  } else {
    // Number input (0-9)
    // Avoid double minus or leading zeros
    if (currentVal === '0') {
      currentVal = key;
    } else if (currentVal === '-0') {
      currentVal = '-' + key;
    } else {
      currentVal += key;
    }
    
    // Max length validation (limit score to 4 digits e.g. -9999 to 9999)
    if (currentVal.replace('-', '').length > 4) {
      playSound('error');
      return;
    }
  }
  
  gameState.tempInputScores[gameState.activeInputPlayerIndex] = currentVal;
  updateKeypadDisplay();
}

function saveRoundScore() {
  // Parse inputs. Empty string counts as 0
  const roundScores = gameState.tempInputScores.map(v => {
    if (v === '' || v === '-') return 0;
    return parseInt(v);
  });
  
  const roundNum = gameState.rounds.length + 1;
  const prevCumulatives = roundNum > 1 ? gameState.rounds[gameState.rounds.length - 1].cumulatives : [0, 0, 0, 0];
  const thisRoundJokerIdx = gameState.jokerPlayerIndex;
  
  // Calculate tentative new cumulatives
  let tentativeCumulatives = prevCumulatives.map((prev, idx) => prev + roundScores[idx]);
  let finalCumulatives = [...tentativeCumulatives];
  let resets = [false, false, false, false];
  let resetReasons = [];

  // Check overtakes
  // Aturan: pemain j di-reset ke 0 HANYA jika pemain i sebelumnya BENAR-BENAR di belakang j
  // (bukan sejajar/seri). Jika sebelumnya skor sama, tidak dianggap menyusul.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      
      const wasStrictlyBehind = prevCumulatives[i] < prevCumulatives[j];
      const isNowAhead = tentativeCumulatives[i] > tentativeCumulatives[j];
      
      if (wasStrictlyBehind && isNowAhead && tentativeCumulatives[j] > 100) {
        resets[j] = true;
        resetReasons.push(`${gameState.players[j].name} dilampaui ${gameState.players[i].name} (dari ${tentativeCumulatives[j]} jadi 0)`);
      }
    }
  }

  // Apply resets
  for (let j = 0; j < 4; j++) {
    if (resets[j]) {
      finalCumulatives[j] = 0;
    }
  }
  
  // Push to rounds history (include joker info)
  gameState.rounds.push({
    roundNum,
    scores: roundScores,
    cumulatives: finalCumulatives,
    jokerIdx: thisRoundJokerIdx
  });
  
  // Rotate joker to next player for the next round
  gameState.jokerPlayerIndex = (thisRoundJokerIdx + 1) % 4;
  
  // Update current player scores
  gameState.players.forEach((p, idx) => {
    p.score = finalCumulatives[idx];
  });
  
  saveToStorage();
  closeModal('modal-round-input');
  playSound('success');
  updateDashboardUI();
  
  // Show quick popup on cards with the added score
  gameState.players.forEach((p, idx) => {
    const amount = roundScores[idx];
    const badge = document.getElementById(`score-diff-${p.id}`);
    badge.innerText = amount >= 0 ? `+${amount}` : amount;
    badge.className = `score-diff-badge show ${amount >= 0 ? 'positive' : 'negative'}`;
    setTimeout(() => {
      badge.classList.remove('show');
    }, 2000);
  });
  
  // Trigger custom toast if a score was reset to 0
  if (resetReasons.length > 0) {
    setTimeout(() => {
      showOvertakeAlert(resetReasons);
    }, 600);
  }
  
  // Check if someone crossed the score threshold
  checkGameEndCondition();

  // Show popup: siapa yang ambil joker di ronde BERIKUTNYA (sudah dirotasi)
  const nextJoker = gameState.players[gameState.jokerPlayerIndex];
  const nextRoundNum = gameState.rounds.length + 1;
  setTimeout(() => showJokerPopup(nextJoker.name, nextJoker.color, nextRoundNum), 500);
}

// Show joker picker popup at start of each round
function showJokerPopup(playerName, playerColor, roundNum) {
  triggerHaptic(40);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.55); z-index: 998;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.25s ease;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: var(--md-surface-container-low);
    border-radius: var(--radius-xl);
    padding: 28px 24px 20px;
    text-align: center;
    max-width: 300px;
    width: 85%;
    box-shadow: var(--shadow-3);
    transform: scale(0.85);
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
    border-top: 5px solid ${playerColor};
  `;

  box.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 6px; line-height:1;">&#127137;</div>
    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--md-outline); margin-bottom: 4px;">Ronde ${roundNum}</div>
    <div style="font-size: 14px; font-weight: 600; color: var(--md-on-surface-variant); margin-bottom: 2px;">Yang mengambil Joker:</div>
    <div style="font-size: 26px; font-weight: 900; color: ${playerColor}; margin: 6px 0 16px;">${playerName}</div>
    <button id="btn-close-joker-popup" style="
      height: 40px; padding: 0 28px;
      background: ${playerColor};
      color: white; border: none;
      border-radius: var(--radius-pill);
      font-family: var(--font-sans);
      font-size: 14px; font-weight: 700;
      cursor: pointer; box-shadow: var(--shadow-1);
    ">Siap! 🃏</button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    box.style.transform = 'scale(1)';
  });

  // Close on button click
  box.querySelector('#btn-close-joker-popup').addEventListener('click', () => {
    triggerHaptic(20);
    playSound('tap');
    overlay.style.opacity = '0';
    box.style.transform = 'scale(0.85)';
    setTimeout(() => overlay.remove(), 250);
  });

  // Auto-close after 4 seconds if user doesn't tap
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    }
  }, 4000);
}

// Show a premium haptic & chiptune alert for overtake reset
function showOvertakeAlert(reasons) {
  playSound('error');
  triggerHaptic(120);
  
  // Create a modal popup programmatically
  const alertOverlay = document.createElement('div');
  alertOverlay.style.position = 'fixed';
  alertOverlay.style.top = '0';
  alertOverlay.style.left = '0';
  alertOverlay.style.width = '100%';
  alertOverlay.style.height = '100%';
  alertOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  alertOverlay.style.zIndex = '999';
  alertOverlay.style.display = 'flex';
  alertOverlay.style.alignItems = 'center';
  alertOverlay.style.justifyContent = 'center';
  alertOverlay.style.opacity = '0';
  alertOverlay.style.transition = 'opacity 0.3s ease';
  
  const alertBox = document.createElement('div');
  alertBox.style.background = 'linear-gradient(135deg, var(--md-error) 0%, #601410 100%)';
  alertBox.style.color = 'white';
  alertBox.style.padding = '24px';
  alertBox.style.borderRadius = 'var(--radius-lg)';
  alertBox.style.boxShadow = 'var(--shadow-3)';
  alertBox.style.textAlign = 'center';
  alertBox.style.maxWidth = '360px';
  alertBox.style.width = '85%';
  alertBox.style.transform = 'scale(0.8)';
  alertBox.style.transition = 'transform 0.3s ease';
  
  let reasonsHtml = '';
  reasons.forEach(r => {
    reasonsHtml += `<div style="font-weight: 700; font-size:16px; margin: 12px 0; background:rgba(0,0,0,0.2); padding: 8px 12px; border-radius:var(--radius-sm);">⚡ ${r} ⚡</div>`;
  });
  
  alertBox.innerHTML = `
    <div style="font-size:48px; margin-bottom:8px; animation: crown-bounce 1s infinite alternate;">⚠️</div>
    <div style="font-size:22px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">RESET SKOR!</div>
    <div style="font-size:13px; opacity:0.9; margin-bottom:12px;">Ada skor pemain yang terlampaui dan kembali ke 0:</div>
    ${reasonsHtml}
    <button id="btn-close-overtake-alert" style="margin-top:12px; height:38px; border:none; background-color:white; color:var(--md-error); font-weight:800; padding: 0 24px; border-radius:var(--radius-pill); cursor:pointer; font-family:var(--font-sans); font-size:12px; box-shadow:var(--shadow-1);">
      OK, LANJUTKAN
    </button>
  `;
  
  alertOverlay.appendChild(alertBox);
  document.body.appendChild(alertOverlay);
  
  // Show animations
  setTimeout(() => {
    alertOverlay.style.opacity = '1';
    alertBox.style.transform = 'scale(1)';
  }, 10);
  
  const closeBtn = alertBox.querySelector('#btn-close-overtake-alert');
  closeBtn.addEventListener('click', () => {
    triggerHaptic(20);
    playSound('tap');
    alertOverlay.style.opacity = '0';
    alertBox.style.transform = 'scale(0.8)';
    setTimeout(() => {
      alertOverlay.remove();
    }, 300);
  });
}


// ==========================================
// Stats and SVG Line Chart Generation
// ==========================================
function renderStatsView() {
  if (!gameState.matchActive) {
    document.getElementById('view-stats').innerHTML = '<div class="history-empty"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg><p>Mulai pertandingan baru untuk melihat grafik statistik.</p></div>';
    return;
  }
  
  // Build Stats DOM structure
  const statsContainer = document.getElementById('view-stats');
  statsContainer.innerHTML = '';
  
  // Match Info Banner
  const banner = document.createElement('div');
  banner.className = 'match-status-bar mb-12';
  banner.style.borderRadius = 'var(--radius-md)';
  banner.innerHTML = `
    <span>Aturan: ${gameState.settings.winCondition === 'highest' ? 'Skor Tinggi Menang' : 'Skor Rendah Menang'}</span>
    <span>Target: ${gameState.settings.targetScore || 'Tanpa Batas'}</span>
  `;
  statsContainer.appendChild(banner);
  
  // Cards Container
  const cardsDiv = document.createElement('div');
  cardsDiv.className = 'stats-cards-container';
  
  // 1. Leader card
  const ranks = getPlayerRanks();
  const leader = gameState.players[ranks[0]];
  const leaderCard = document.createElement('div');
  leaderCard.className = 'stat-card';
  leaderCard.innerHTML = `
    <div class="stat-card-title">Pemimpin Klasemen</div>
    <div class="stat-card-value" style="color: ${leader.color}">👑 ${leader.name}</div>
    <div class="stat-card-desc">Skor saat ini: ${leader.score}</div>
  `;
  cardsDiv.appendChild(leaderCard);
  
  // 2. Highest Round Score card
  let maxRoundScore = -Infinity;
  let maxRoundPlayer = 'Belum ada';
  let maxRoundNum = 0;
  
  gameState.rounds.forEach(r => {
    r.scores.forEach((s, idx) => {
      if (s > maxRoundScore) {
        maxRoundScore = s;
        maxRoundPlayer = gameState.players[idx].name;
        maxRoundNum = r.roundNum;
      }
    });
  });
  
  const topRoundCard = document.createElement('div');
  topRoundCard.className = 'stat-card';
  topRoundCard.innerHTML = `
    <div class="stat-card-title">Skor Ronde Tertinggi</div>
    <div class="stat-card-value">${maxRoundScore === -Infinity ? '0' : `+${maxRoundScore}`}</div>
    <div class="stat-card-desc">${maxRoundScore === -Infinity ? 'Belum ada ronde' : `${maxRoundPlayer} (Ronde ${maxRoundNum})`}</div>
  `;
  cardsDiv.appendChild(topRoundCard);
  
  statsContainer.appendChild(cardsDiv);
  
  // Draw SVG Chart Card
  const chartCard = document.createElement('div');
  chartCard.className = 'chart-card';
  chartCard.innerHTML = `
    <div class="chart-title">Grafik Perkembangan Skor</div>
    <div class="chart-container" id="svg-chart-wrapper"></div>
    <div class="chart-legend" id="svg-chart-legend"></div>
  `;
  statsContainer.appendChild(chartCard);
  
  // Render Legend
  const legendDiv = document.getElementById('svg-chart-legend');
  gameState.players.forEach(p => {
    legendDiv.innerHTML += `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${p.color}"></div>
        <span>${p.name} (${p.score})</span>
      </div>
    `;
  });
  
  // Render SVG Chart inside wrapper
  generateSVGChart();
}

function generateSVGChart() {
  const container = document.getElementById('svg-chart-wrapper');
  if (!container) return;
  
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  
  // Need at least some round data to draw a chart, otherwise show empty message
  if (gameState.rounds.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:13px;color:var(--md-outline)">Mainkan ronde pertama untuk melihat grafik tren.</div>';
    return;
  }
  
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  
  // Calculate Min and Max scores across the entire game history to scale Y axis
  let minScore = 0;
  let maxScore = 0;
  
  // Initial point is 0 for all players
  const allScoreHistory = [[0, 0, 0, 0]];
  gameState.rounds.forEach(r => {
    allScoreHistory.push(r.cumulatives);
  });
  
  allScoreHistory.forEach(scores => {
    scores.forEach(s => {
      if (s < minScore) minScore = s;
      if (s > maxScore) maxScore = s;
    });
  });
  
  // Add padding to range
  const scoreRange = maxScore - minScore;
  const yPadding = scoreRange === 0 ? 10 : scoreRange * 0.1;
  const yMin = minScore - yPadding;
  const yMax = maxScore + yPadding;
  const yRange = yMax - yMin;
  
  const roundsCount = allScoreHistory.length;
  
  // X scale helper
  const getX = (roundIdx) => {
    if (roundsCount <= 1) return paddingLeft;
    return paddingLeft + (roundIdx / (roundsCount - 1)) * chartW;
  };
  
  // Y scale helper
  const getY = (score) => {
    return paddingTop + chartH - ((score - yMin) / yRange) * chartH;
  };
  
  // Start SVG string
  let svg = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Draw Grid Lines & Y ticks
  const ticksCount = 4;
  for (let i = 0; i <= ticksCount; i++) {
    const scoreVal = Math.round(yMin + (i / ticksCount) * yRange);
    const y = getY(scoreVal);
    
    // Line
    svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" class="chart-grid-line" />`;
    
    // Label
    svg += `<text x="${paddingLeft - 8}" y="${y + 4}" class="chart-text" text-anchor="end">${scoreVal}</text>`;
  }
  
  // Draw X ticks (Rounds)
  allScoreHistory.forEach((_, idx) => {
    const x = getX(idx);
    const label = idx === 0 ? 'Mulai' : `R${idx}`;
    svg += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartH}" class="chart-grid-line" />`;
    svg += `<text x="${x}" y="${paddingTop + chartH + 18}" class="chart-text" text-anchor="middle">${label}</text>`;
  });
  
  // Draw Line Paths for each player
  for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
    const player = gameState.players[playerIdx];
    let pathD = '';
    
    allScoreHistory.forEach((scores, roundIdx) => {
      const x = getX(roundIdx);
      const y = getY(scores[playerIdx]);
      
      if (roundIdx === 0) {
        pathD += `M ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
    });
    
    // Draw the path
    svg += `<path d="${pathD}" class="chart-line" stroke="${player.color}" />`;
    
    // Draw dots at each round point
    allScoreHistory.forEach((scores, roundIdx) => {
      const x = getX(roundIdx);
      const y = getY(scores[playerIdx]);
      svg += `<circle cx="${x}" cy="${y}" r="4" class="chart-dot" stroke="${player.color}" data-player="${player.name}" data-score="${scores[playerIdx]}" data-round="${roundIdx}" />`;
    });
  }
  
  // Close SVG
  svg += `</svg>`;
  container.innerHTML = svg;
  
  // Add interactivity to dots
  container.querySelectorAll('.chart-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      const player = e.target.dataset.player;
      const score = e.target.dataset.score;
      const round = e.target.dataset.round;
      const roundLabel = round === '0' ? 'Permulaan' : `Ronde ${round}`;
      
      triggerHaptic(20);
      alert(`${player}: ${score} poin di ${roundLabel}`);
    });
  });
}

// ==========================================
// History Log & Rounds Editing
// ==========================================
function renderHistoryTab() {
  const tableBody = document.getElementById('history-table-body');
  const container = document.getElementById('history-table-container-div');
  const emptyDiv = document.getElementById('history-empty-div');
  
  if (!gameState.matchActive || gameState.rounds.length === 0) {
    container.style.display = 'none';
    emptyDiv.style.display = 'flex';
    return;
  }
  
  container.style.display = 'block';
  emptyDiv.style.display = 'none';
  
  // Render table headers with Player names
  const headersRow = document.getElementById('history-table-headers');
  headersRow.innerHTML = '<th>Ronde</th>';
  gameState.players.forEach(p => {
    headersRow.innerHTML += `<th style="color:${p.color}">${p.name}</th>`;
  });
  headersRow.innerHTML += '<th title="Pengambil Joker">&#127137;</th>';
  headersRow.innerHTML += '<th>Aksi</th>';
  
  // Render rows
  tableBody.innerHTML = '';
  
  // Loop backwards to show newest rounds first
  for (let i = gameState.rounds.length - 1; i >= 0; i--) {
    const round = gameState.rounds[i];
    const row = document.createElement('tr');
    
    let tds = `<td class="round-num-cell">R${round.roundNum}</td>`;
    
    for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
      const diff = round.scores[playerIdx];
      const total = round.cumulatives[playerIdx];
      
      const diffClass = diff > 0 ? 'pos' : (diff < 0 ? 'neg' : '');
      const diffText = diff > 0 ? `+${diff}` : (diff < 0 ? `${diff}` : '0');
      
      tds += `
        <td>
          <span class="cell-score-total">${total}</span>
          <span class="cell-score-diff ${diffClass}">${diffText}</span>
        </td>
      `;
    }

    // Joker column — show player name who picked joker this round
    const jokerName = (round.jokerIdx !== undefined)
      ? gameState.players[round.jokerIdx].name
      : '-';
    tds += `<td style="font-size:11px; color:var(--md-outline); font-weight:600;">&#127137;<br>${jokerName}</td>`;
    
    // Add Edit/Delete button
    tds += `
      <td class="history-item-actions">
        <button class="btn-icon" onclick="openEditRoundModal(${i})" style="width:30px; height:30px;">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
      </td>
    `;
    
    row.innerHTML = tds;
    tableBody.appendChild(row);
  }
}

// Edit an old round's scores
let editingRoundIdx = null;

window.openEditRoundModal = function(roundIndex) {
  editingRoundIdx = roundIndex;
  const round = gameState.rounds[roundIndex];
  
  // Pre-fill edit fields
  gameState.players.forEach((p, idx) => {
    document.getElementById(`edit-p${idx + 1}-label`).innerText = p.name;
    document.getElementById(`edit-p${idx + 1}-score`).value = round.scores[idx];
  });
  
  // Set delete click
  document.getElementById('btn-delete-round').onclick = () => deleteRound(roundIndex);
  document.getElementById('btn-save-edit-round').onclick = saveEditedScores;
  
  openModal('modal-edit-round');
};

function saveEditedScores() {
  const round = gameState.rounds[editingRoundIdx];
  const newScores = [];
  
  for (let idx = 0; idx < 4; idx++) {
    const raw = document.getElementById(`edit-p${idx + 1}-score`).value.trim();
    // Support negative values entered as text (e.g. "-50")
    const parsed = raw === '' || raw === '-' ? 0 : parseInt(raw, 10);
    newScores.push(isNaN(parsed) ? 0 : parsed);
  }
  
  // Update scores for this round
  round.scores = newScores;
  
  // Recalculate all subsequent rounds
  recalculateRoundsChain();
  
  closeModal('modal-edit-round');
  playSound('success');
  updateDashboardUI();
  renderHistoryTab();
}

function deleteRound(roundIndex) {
  if (confirm('Apakah Anda yakin ingin menghapus ronde ini? Skor seluruh ronde setelahnya akan otomatis dihitung ulang.')) {
    gameState.rounds.splice(roundIndex, 1);
    
    // Recalculate rounds number and totals
    recalculateRoundsChain();
    
    closeModal('modal-edit-round');
    playSound('undo');
    updateDashboardUI();
    renderHistoryTab();
  }
}

// Recalculate rounds chain (fixes cumulatives after insertions, deletions, edits)
function recalculateRoundsChain() {
  let prevCumulatives = [0, 0, 0, 0];
  
  gameState.rounds.forEach((round, idx) => {
    round.roundNum = idx + 1;
    
    let tentativeCumulatives = prevCumulatives.map((prev, pIdx) => prev + round.scores[pIdx]);
    let finalCumulatives = [...tentativeCumulatives];
    let resets = [false, false, false, false];
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        
        // Use strict < to avoid resetting players who are tied (not truly "behind")
        const wasStrictlyBehind = prevCumulatives[i] < prevCumulatives[j];
        const isNowAhead = tentativeCumulatives[i] > tentativeCumulatives[j];
        
        if (wasStrictlyBehind && isNowAhead && tentativeCumulatives[j] > 100) {
          resets[j] = true;
        }
      }
    }
    
    for (let j = 0; j < 4; j++) {
      if (resets[j]) {
        finalCumulatives[j] = 0;
      }
    }
    
    round.cumulatives = finalCumulatives;
    prevCumulatives = finalCumulatives;
  });
  
  // Update current player scores to matches final round
  if (gameState.rounds.length > 0) {
    const lastRound = gameState.rounds[gameState.rounds.length - 1];
    gameState.players.forEach((p, idx) => {
      p.score = lastRound.cumulatives[idx];
    });
  } else {
    gameState.players.forEach(p => p.score = 0);
  }
  
  saveToStorage();
}

// ==========================================
// Past Matches History Tab
// ==========================================
function renderMatchHistory() {
  const historyList = document.getElementById('completed-matches-list');
  const emptyHistory = document.getElementById('history-tab-empty');
  
  if (gameState.completedMatches.length === 0) {
    historyList.style.display = 'none';
    emptyHistory.style.display = 'flex';
    return;
  }
  
  historyList.style.display = 'flex';
  emptyHistory.style.display = 'none';
  
  historyList.innerHTML = '';
  
  gameState.completedMatches.forEach((match) => {
    const card = document.createElement('div');
    card.className = 'player-card mb-12';
    card.style.boxShadow = 'var(--shadow-1)';
    card.style.border = 'none';
    
    // Sort players in history match to list standings
    const playersCopy = [...match.players];
    const isHighest = match.winCondition === 'highest';
    playersCopy.sort((a, b) => isHighest ? b.score - a.score : a.score - b.score);
    
    let standingsHtml = '';
    playersCopy.forEach((p, idx) => {
      const crown = idx === 0 ? '👑 ' : '';
      standingsHtml += `
        <div style="display:flex; justify-content:space-between; font-size:13px; margin: 4px 0; font-weight: ${idx === 0 ? '700' : '500'}">
          <span>${idx + 1}. ${crown}${p.name}</span>
          <span>${p.score} pts</span>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--md-surface-container-high); padding-bottom:8px; margin-bottom:8px;">
        <span style="font-size:11px; font-weight:700; color:var(--md-outline)">${match.date}</span>
        <span class="status-badge" style="font-size:10px;">${match.roundsCount} Ronde</span>
      </div>
      <div>
        ${standingsHtml}
      </div>
      <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:11px; color:var(--md-outline)">Mode: ${isHighest ? 'Tertinggi Menang' : 'Terendah Menang'}</span>
        <button class="btn-icon" onclick="deleteHistoryMatch(${match.id})" style="width:32px; height:32px; color:var(--md-error)">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    
    historyList.appendChild(card);
  });
}

window.deleteHistoryMatch = function(matchId) {
  if (confirm('Apakah Anda yakin ingin menghapus riwayat pertandingan ini?')) {
    triggerHaptic(50);
    gameState.completedMatches = gameState.completedMatches.filter(m => m.id !== matchId);
    saveToStorage();
    renderMatchHistory();
    playSound('undo');
  }
};

// ==========================================
// Share & Social integration
// ==========================================
function shareMatchResult() {
  triggerHaptic(30);
  playSound('tap');
  
  // Compile scoreboard details
  let title = '🏆 HASIL PERTANDINGAN BANTINGSCORE 🏆\n\n';
  if (gameState.matchActive) {
    const ranks = getPlayerRanks();
    ranks.forEach((pIdx, idx) => {
      const p = gameState.players[pIdx];
      const emoji = idx === 0 ? '🥇 👑 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : '👤 '));
      title += `${emoji}${p.name}: ${p.score} poin\n`;
    });
    title += `\nTotal: ${gameState.rounds.length} Ronde dimainkan.`;
  } else if (gameState.completedMatches.length > 0) {
    const lastMatch = gameState.completedMatches[0];
    const playersCopy = [...lastMatch.players];
    const isHighest = lastMatch.winCondition === 'highest';
    playersCopy.sort((a, b) => isHighest ? b.score - a.score : a.score - b.score);
    
    playersCopy.forEach((p, idx) => {
      const emoji = idx === 0 ? '🥇 👑 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : '👤 '));
      title += `${emoji}${p.name}: ${p.score} poin\n`;
    });
    title += `\nDiselesaikan pada ${lastMatch.date} (${lastMatch.roundsCount} Ronde).`;
  }
  
  title += '\n\nDiisi menggunakan aplikasi BantingScore.';
  
  if (navigator.share) {
    navigator.share({
      title: 'Skor Pertandingan',
      text: title
    }).then(() => {
      console.log('Shared successfully');
    }).catch((err) => {
      console.log('Sharing failed', err);
      fallbackCopyText(title);
    });
  } else {
    fallbackCopyText(title);
  }
}

function fallbackCopyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Ringkasan skor berhasil disalin ke clipboard!');
  }).catch(() => {
    alert('Gagal menyalin teks secara otomatis. Silakan salin manual.');
  });
}

// ==========================================
// Confetti Animation System on Canvas
// ==========================================
let confettiActive = false;
let confettiParticles = [];
const confettiColors = ['#6750A4', '#006A6A', '#BA1A1A', '#8B5000', '#D0BCFF', '#FFB4AB', '#FFB866'];

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  
  confettiActive = true;
  confettiParticles = [];
  
  // Create particles
  for (let i = 0; i < 150; i++) {
    confettiParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * canvas.height,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    });
  }
  
  let animationFrameId;
  
  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let activeParticles = 0;
    
    confettiParticles.forEach((p) => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.tiltAngle);
      p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;
      
      if (p.y <= canvas.height) {
        activeParticles++;
      }
      
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    
    if (activeParticles > 0 && confettiActive) {
      animationFrameId = requestAnimationFrame(drawConfetti);
    } else {
      canvas.style.display = 'none';
      confettiActive = false;
      cancelAnimationFrame(animationFrameId);
    }
  }
  
  drawConfetti();
  
  // Auto stop after 5 seconds
  setTimeout(() => {
    confettiActive = false;
  }, 5000);
}
