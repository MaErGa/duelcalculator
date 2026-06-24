// ====== ESTADO ======
const state = {
  lp1: 8000,
  lp2: 8000,
  history1: [],
  history2: [],
};

const DIGIT_HEIGHT_VAR = '--digit-h'; // referencia, la altura real se mide en runtime

// ====== ANIMACIÓN DE CONTEO (igual al efecto del video de referencia) ======

// Cada contador lleva registro de su valor actualmente mostrado y de
// la animación en curso, para poder encadenar cambios rápidos sin trabarse.
const counters = {}; // { lp1: { shown, raf, target } }

function ensureCounter(id, initialValue) {
  if (!counters[id]) {
    counters[id] = { shown: initialValue, raf: null };
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateCounter(containerEl, id, from, to) {
  ensureCounter(id, from);
  const counterState = counters[id];

  // Si ya había una animación corriendo, la cancelamos para arrancar limpio.
  if (counterState.raf) {
    cancelAnimationFrame(counterState.raf);
  }

  const diff = to - from;
  if (diff === 0) return;

  // Reproduce el sonido de conteo desde el inicio en cada cambio.
  const tickSound = document.getElementById('lpTickSound');
  if (tickSound) {
    tickSound.currentTime = 0;
    tickSound.play().catch(() => {
      // El navegador puede bloquear el autoplay hasta la primera interacción; se ignora.
    });
  }

  // Duración proporcional a la magnitud del cambio, con tope para que
  // cambios grandes no demoren demasiado y chicos no sean instantáneos.
  const duration = Math.min(900, Math.max(350, Math.abs(diff) * 0.6));
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(t);
    const current = Math.round(from + diff * eased);

    containerEl.textContent = current;
    counterState.shown = current;

    if (t < 1) {
      counterState.raf = requestAnimationFrame(step);
    } else {
      containerEl.textContent = to;
      counterState.shown = to;
      counterState.raf = null;
      const tickSound = document.getElementById('lpTickSound');
      if (tickSound) {
        tickSound.pause();
        tickSound.currentTime = 0;
      }
      const finishSound = document.getElementById('lpFinishSound');
      if (finishSound) {
        finishSound.currentTime = 0;
        finishSound.play().catch(() => {});
      }
    }
  }

  counterState.raf = requestAnimationFrame(step);
}

function renderCounter(containerEl, value, isIncrease, id) {
  const from = counters[id] ? counters[id].shown : parseInt(containerEl.textContent, 10) || 0;
  animateCounter(containerEl, id, from, value);
}

// ====== LÓGICA DE PUNTOS DE VIDA ======

function applyChange(player, amount) {
  if (!amount || isNaN(amount)) return;

  const key = `lp${player}`;
  const before = state[key];
  let after = before + amount;
  if (after < 0) after = 0;

  state[key] = after;

  // Registramos el movimiento en el historial de ese jugador.
  const historyKey = `history${player}`;
  state[historyKey].push({ amount, total: after });
  renderHistory(player);

  const el = document.getElementById(`lp${player}`);
  renderCounter(el, after, amount > 0, key);

  // Si el LP llegó a 0, el otro jugador gana el duelo.
  if (before > 0 && after === 0) {
    const winnerPlayer = player === '1' ? '2' : '1';
    setTimeout(() => {
      showVictory(winnerPlayer);
    }, 950);
  }
}

function showVictory(winnerPlayer) {
  const nameInput = document.querySelectorAll('.player-name')[winnerPlayer === '1' ? 0 : 1];
  const winnerName = (nameInput && nameInput.value) || `Jugador ${winnerPlayer}`;

  document.getElementById('victoryName').textContent = winnerName;
  document.getElementById('victoryOverlay').classList.add('show');
}

function hideVictory() {
  document.getElementById('victoryOverlay').classList.remove('show');
}

// Dibuja la lista de historial de un jugador (más reciente arriba).
function renderHistory(player) {
  const listEl = document.getElementById(`history${player}`);
  const entries = state[`history${player}`];

  if (entries.length === 0) {
    listEl.innerHTML = '<li class="history-empty">Sin movimientos todavía</li>';
    return;
  }

  listEl.innerHTML = entries
    .slice()
    .reverse()
    .map((entry) => {
      const sign = entry.amount > 0 ? '+' : '';
      const cls = entry.amount > 0 ? 'positive' : 'negative';
      return `<li><span class="amount ${cls}">${sign}${entry.amount}</span><span class="total">${entry.total}</span></li>`;
    })
    .join('');
}

function clearHistory(player) {
  state[`history${player}`] = [];
  renderHistory(player);
}

function setStartingLP(value) {
  if (isNaN(value) || value < 0) return;
  const from1 = counters.lp1 ? counters.lp1.shown : state.lp1;
  const from2 = counters.lp2 ? counters.lp2.shown : state.lp2;
  state.lp1 = value;
  state.lp2 = value;
  renderCounter(document.getElementById('lp1'), value, value >= from1, 'lp1');
  renderCounter(document.getElementById('lp2'), value, value >= from2, 'lp2');
}

// ====== EVENTOS: BOTONES RÁPIDOS (+/- 1000, 500, 100) ======

document.querySelectorAll('.btn.plus, .btn.minus').forEach((btn) => {
  btn.addEventListener('click', () => {
    const player = btn.dataset.player;
    const amount = parseInt(btn.dataset.amount, 10);
    applyChange(player, amount);
  });
});

// ====== EVENTOS: SUMA/RESTA MANUAL ======

document.querySelectorAll('.btn.manual-add').forEach((btn) => {
  btn.addEventListener('click', () => {
    const player = btn.dataset.player;
    const input = document.getElementById(`manual${player}`);
    const amount = parseInt(input.value, 10);
    if (!isNaN(amount) && amount !== 0) {
      applyChange(player, Math.abs(amount));
      input.value = '';
    }
  });
});

document.querySelectorAll('.btn.manual-sub').forEach((btn) => {
  btn.addEventListener('click', () => {
    const player = btn.dataset.player;
    const input = document.getElementById(`manual${player}`);
    const amount = parseInt(input.value, 10);
    if (!isNaN(amount) && amount !== 0) {
      applyChange(player, -Math.abs(amount));
      input.value = '';
    }
  });
});

// Permitir Enter en el input manual para sumar por defecto
document.querySelectorAll('.manual-input').forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const player = input.id.replace('manual', '');
      const amount = parseInt(input.value, 10);
      if (!isNaN(amount) && amount !== 0) {
        applyChange(player, Math.abs(amount));
        input.value = '';
      }
    }
  });
});

// ====== LP INICIAL PERSONALIZADO ======

document.getElementById('applyStartLp').addEventListener('click', () => {
  const value = parseInt(document.getElementById('startLp').value, 10);
  setStartingLP(value);
});

// ====== REINICIAR DUELO ======

document.getElementById('resetBtn').addEventListener('click', () => {
  const startValue = parseInt(document.getElementById('startLp').value, 10) || 8000;
  setStartingLP(startValue);
  document.getElementById('coinResult').textContent = '';
  clearHistory('1');
  clearHistory('2');
  hideVictory();
});

document.getElementById('victoryRestartBtn').addEventListener('click', () => {
  document.getElementById('resetBtn').click();
});

// ====== LANZAMIENTO DE MONEDA ======

let coinSpins = 0; // acumula vueltas para que cada lanzamiento siga girando hacia el mismo lado

document.getElementById('coinFlipBtn').addEventListener('click', () => {
  const btn = document.getElementById('coinFlipBtn');
  const coin = document.getElementById('coin');
  const resultEl = document.getElementById('coinResult');

  btn.disabled = true;
  resultEl.textContent = 'Lanzando...';

  const isHeads = Math.random() < 0.5;
  const extraTurns = 5; // vueltas completas antes de frenar
  coinSpins += 360 * extraTurns + (isHeads ? 0 : 180);

  coin.style.transform = `rotateY(${coinSpins}deg)`;

  setTimeout(() => {
    const player1Name = document.querySelectorAll('.player-name')[0].value || 'Jugador 1';
    const player2Name = document.querySelectorAll('.player-name')[1].value || 'Jugador 2';

    const winnerName = isHeads ? player1Name : player2Name;
    const faceLabel = isHeads ? 'Cara' : 'Cruz';

    resultEl.textContent = `${faceLabel} — ¡Empieza ${winnerName}!`;
    btn.disabled = false;
  }, 1900);
});

// ====== LANZAMIENTO DE DADO ======

// Rotación necesaria para que cada cara quede mirando al jugador.
const dieFaceRotation = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: -90, y: 0 },
  5: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
};

let dieSpinsX = -15; // arranca igual que la rotación inicial en reposo
let dieSpinsY = 25;

document.getElementById('diceRollBtn').addEventListener('click', () => {
  const btn = document.getElementById('diceRollBtn');
  const die = document.getElementById('die');
  const resultEl = document.getElementById('coinResult');

  btn.disabled = true;

  const player1Name = document.querySelectorAll('.player-name')[0].value || 'Jugador 1';
  const player2Name = document.querySelectorAll('.player-name')[1].value || 'Jugador 2';

  const roll1 = Math.floor(Math.random() * 6) + 1;
  const roll2 = Math.floor(Math.random() * 6) + 1;

  // --- Tirada del Jugador 1 ---
  resultEl.textContent = `Tirando por ${player1Name}...`;
  rollDieTo(die, roll1);

  setTimeout(() => {
    resultEl.textContent = `${player1Name}: ${roll1}. Tirando por ${player2Name}...`;

    // --- Tirada del Jugador 2 ---
    rollDieTo(die, roll2);

    setTimeout(() => {
      let message;
      if (roll1 === roll2) {
        message = `Empate (${roll1} y ${roll2}) — ¡Vuelvan a tirar!`;
      } else {
        const winnerName = roll1 > roll2 ? player1Name : player2Name;
        message = `${player1Name}: ${roll1} · ${player2Name}: ${roll2} — ¡Empieza ${winnerName}!`;
      }
      resultEl.textContent = message;
      btn.disabled = false;
    }, 1900);
  }, 1900);
});

// Gira el dado hasta mostrar la cara indicada, acumulando vueltas extra.
function rollDieTo(die, result) {
  const target = dieFaceRotation[result];
  const extraTurns = 2;

  dieSpinsX += 360 * extraTurns + target.x - (dieSpinsX % 360);
  dieSpinsY += 360 * extraTurns + target.y - (dieSpinsY % 360);

  die.style.transform = `rotateX(${dieSpinsX}deg) rotateY(${dieSpinsY}deg)`;
}

// ====== INICIALIZACIÓN ======

function init() {
  ensureCounter('lp1', state.lp1);
  ensureCounter('lp2', state.lp2);
  document.getElementById('lp1').textContent = state.lp1;
  document.getElementById('lp2').textContent = state.lp2;
  renderHistory('1');
  renderHistory('2');
}

init();
