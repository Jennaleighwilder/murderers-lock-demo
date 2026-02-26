const CORRECT_PASSWORD = 'quantum33';
let attempts = 0;
let unlockedGates = new Set();

// Create 33 gates
function createGates() {
  const grid = document.getElementById('gatesGrid');
  
  for (let i = 1; i <= 33; i++) {
    const gate = document.createElement('div');
    gate.className = 'gate';
    gate.dataset.gate = i;
    
    // Gate number
    const number = document.createElement('div');
    number.className = 'gate-number';
    number.textContent = `#${i}`;
    gate.appendChild(number);
    
    // Tumblers (5 per gate)
    const tumblers = document.createElement('div');
    tumblers.className = 'tumblers';
    for (let t = 0; t < 5; t++) {
      const tumbler = document.createElement('div');
      tumbler.className = 'tumbler';
      tumblers.appendChild(tumbler);
    }
    gate.appendChild(tumblers);
    
    // Lock icon
    const lock = document.createElement('div');
    lock.className = 'lock-icon';
    lock.textContent = '🔒';
    gate.appendChild(lock);
    
    // Frequency wave
    const wave = document.createElement('div');
    wave.className = 'frequency-wave';
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 20;
    wave.appendChild(canvas);
    gate.appendChild(wave);
    
    // Draw initial frequency wave
    drawFrequencyWave(canvas, false);
    
    grid.appendChild(gate);
  }
}

// Draw frequency wave visualization
function drawFrequencyWave(canvas, active) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const centerY = canvas.height / 2;
  const amplitude = active ? 8 : 3;
  const frequency = active ? 0.3 : 0.1;
  const color = active ? '#39FF14' : '#333';
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  for (let x = 0; x < canvas.width; x++) {
    const y = centerY + Math.sin(x * frequency + Date.now() * 0.005) * amplitude;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();
}

// Update all frequency waves
function updateWaves() {
  document.querySelectorAll('.frequency-wave canvas').forEach((canvas, index) => {
    const gateNum = index + 1;
    const isUnlocked = unlockedGates.has(gateNum);
    drawFrequencyWave(canvas, isUnlocked);
  });
  requestAnimationFrame(updateWaves);
}

// Attempt to unlock gates
async function attemptUnlock() {
  const password = document.getElementById('passwordInput').value;
  const status = document.getElementById('status');
  
  if (!password) {
    status.className = 'status error';
    status.textContent = '⚠️ Error: Master password required';
    return;
  }
  
  attempts++;
  document.getElementById('attemptCount').textContent = attempts;
  document.getElementById('remainingAttempts').textContent = Math.max(0, 33 - attempts);
  
  if (password === CORRECT_PASSWORD) {
    // SUCCESS - Unlock all gates sequentially
    status.className = 'status success';
    status.textContent = '✓ Master password verified. Unlocking gates...';
    
    for (let i = 1; i <= 33; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      unlockGate(i);
    }
    
    status.textContent = '✓ ALL GATES UNLOCKED - Vault access granted';
    
  } else {
    // FAILURE - Show failed attempt
    status.className = 'status error';
    
    if (attempts >= 33) {
      status.textContent = '🚨 LOCKJAW ENGAGED - 33 failed attempts. Vault permanently locked.';
      document.getElementById('passwordInput').disabled = true;
      document.querySelector('button').disabled = true;
    } else {
      status.textContent = `✗ Invalid password. ${33 - attempts} attempts remaining before lockjaw.`;
      
      // Visual feedback - random gate shakes
      const randomGate = Math.floor(Math.random() * 33) + 1;
      const gateEl = document.querySelector(`[data-gate="${randomGate}"]`);
      gateEl.classList.add('failed');
      setTimeout(() => gateEl.classList.remove('failed'), 500);
    }
  }
}

// Unlock a specific gate
function unlockGate(gateNum) {
  unlockedGates.add(gateNum);
  const gate = document.querySelector(`[data-gate="${gateNum}"]`);
  gate.classList.add('unlocked');
  gate.querySelector('.lock-icon').textContent = '🔓';
  
  document.getElementById('unlockedCount').textContent = unlockedGates.size;
  
  // Sound effect (optional)
  playUnlockSound();
}

// Simple unlock sound
function playUnlockSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
}

    // Initialize
    createGates();
    updateWaves();

    // Button click (CSP: no onclick)
    document.getElementById('unlockBtn').addEventListener('click', attemptUnlock);

    // Allow Enter key
    document.getElementById('passwordInput').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        attemptUnlock();
      }
    });
