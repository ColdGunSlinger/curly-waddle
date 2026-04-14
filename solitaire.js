'use strict';

// === CONSTANTS ===
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

const SUIT_SYMBOLS = {
  spades:   '♠',
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣'
};

const SUIT_COLORS = {
  spades:   'black',
  hearts:   'red',
  diamonds: 'red',
  clubs:    'black'
};

// Poatan-themed face card labels
const JACK_NAMES = {
  spades:   'ADESANYA',
  hearts:   'HILL',
  diamonds: 'JIŘÍ',
  clubs:    'ROUNTREE'
};

const QUEEN_MOVES = {
  spades:   'LEFT HOOK',
  hearts:   'HEAD KICK',
  diamonds: 'BODY KICK',
  clubs:    'UPPERCUT'
};

const KING_FIGHTS = {
  spades:   'UFC 281',
  hearts:   'UFC 287',
  diamonds: 'UFC 300',
  clubs:    'UFC 303'
};

function rankLabel(rank) {
  if (rank === 1)  return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

// === STATE ===
let state = {
  stock:       null,
  waste:       null,
  foundations: [],
  tableau:     [],
  dragging:    null,
  drawCount:   1,
  moves:       0,
  won:         false
};

// === DECK ===
function createDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
    }
  }
  return cards;
}

function shuffleDeck(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// === DEAL ===
function newGame() {
  const toggle = document.getElementById('draw-toggle');
  const drawCount = toggle && toggle.checked ? 3 : 1;
  const deck = shuffleDeck(createDeck());

  // Deal tableau: col i gets i+1 cards, top one face-up
  const tableau = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const cards = [];
    for (let row = 0; row <= col; row++) {
      const card = deck[idx++];
      card.faceUp = (row === col);
      cards.push(card);
    }
    tableau.push({ type: 'tableau', id: `tableau-${col}`, cards });
  }

  // Remaining 24 cards go to stock, face-down
  const stockCards = deck.slice(idx);
  stockCards.forEach(c => { c.faceUp = false; });

  state = {
    stock:       { type: 'stock', id: 'stock', cards: stockCards },
    waste:       { type: 'waste', id: 'waste', cards: [] },
    foundations: SUITS.map((suit, i) => ({
      type: 'foundation', id: `foundation-${i}`, suit, cards: []
    })),
    tableau,
    dragging:    null,
    drawCount,
    moves:       0,
    won:         false
  };

  hideWinScreen();
  render();
}

// === PILE HELPERS ===
function getPileById(id) {
  if (!id) return null;
  if (id === 'stock')  return state.stock;
  if (id === 'waste')  return state.waste;
  if (id.startsWith('foundation-')) return state.foundations[+id.split('-')[1]];
  if (id.startsWith('tableau-'))    return state.tableau[+id.split('-')[1]];
  return null;
}

function getPileFromElement(el) {
  const pileEl = el ? el.closest('[data-pile-id]') : null;
  return pileEl ? getPileById(pileEl.dataset.pileId) : null;
}

// Returns the card at cardId and all cards above it in pile
function getCardsFromCard(pile, cardId) {
  const idx = pile.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  return pile.cards.slice(idx);
}

function topCard(pile) {
  return pile.cards.length > 0 ? pile.cards[pile.cards.length - 1] : null;
}

// === VALIDATION ===
function cardColor(card) {
  return SUIT_COLORS[card.suit];
}

function canPlaceOnFoundation(card, foundation) {
  const top = topCard(foundation);
  if (!top) return card.rank === 1 && card.suit === foundation.suit;
  return card.suit === foundation.suit && card.rank === top.rank + 1;
}

function canPlaceOnTableau(card, pile) {
  const top = topCard(pile);
  if (!top) return card.rank === 13;
  return top.faceUp && cardColor(card) !== cardColor(top) && card.rank === top.rank - 1;
}

function isValidMove(cards, targetPile) {
  if (!cards || cards.length === 0 || !targetPile) return false;
  if (targetPile.type === 'foundation') {
    return cards.length === 1 && canPlaceOnFoundation(cards[0], targetPile);
  }
  if (targetPile.type === 'tableau') {
    return canPlaceOnTableau(cards[0], targetPile);
  }
  return false;
}

// === MOVE EXECUTION ===
function moveCards(cards, sourcePile, targetPile) {
  const startIdx = sourcePile.cards.findIndex(c => c.id === cards[0].id);
  if (startIdx === -1) return;

  sourcePile.cards.splice(startIdx);       // remove card(s) from source
  targetPile.cards.push(...cards);          // add to target

  // Flip new top of source pile if it's face-down
  const newTop = topCard(sourcePile);
  if (newTop && !newTop.faceUp) newTop.faceUp = true;

  state.moves++;
  checkWin();
}

function drawFromStock() {
  if (state.stock.cards.length === 0) {
    // Recycle waste back to stock (reversed, face-down)
    state.stock.cards = [...state.waste.cards].reverse();
    state.stock.cards.forEach(c => { c.faceUp = false; });
    state.waste.cards = [];
    return;
  }
  const count = Math.min(state.drawCount, state.stock.cards.length);
  // Draw from top of stock (end of array)
  const drawn = state.stock.cards.splice(-count);
  drawn.forEach(c => { c.faceUp = true; });
  // Push to waste; last element drawn ends up on top (end of waste array)
  state.waste.cards.push(...drawn);
}

function autoMoveToFoundation(card, sourcePile) {
  for (const f of state.foundations) {
    if (canPlaceOnFoundation(card, f)) {
      moveCards([card], sourcePile, f);
      return true;
    }
  }
  return false;
}

function checkWin() {
  if (state.foundations.every(f => f.cards.length === 13)) {
    state.won = true;
    render();
    setTimeout(showWinScreen, 500);
  }
}

// === RENDER ===
function createCardEl(card) {
  const div = document.createElement('div');
  const color = SUIT_COLORS[card.suit];
  div.className = card.faceUp ? `card face-up ${color}` : 'card face-down';
  div.dataset.cardId = card.id;

  if (!card.faceUp) {
    div.innerHTML = '<div class="card-back-inner"></div>';
    return div;
  }

  div.draggable = true;

  const sym = SUIT_SYMBOLS[card.suit];
  const rl  = rankLabel(card.rank);
  let center = '';

  if (card.rank === 13) {
    // King — POATAN champion card
    const fight = KING_FIGHTS[card.suit];
    center = `<div class="face-card">
      <span class="king-name">POATAN</span>
      <span class="king-fight">${fight}</span>
    </div>`;
  } else if (card.rank === 12) {
    // Queen — finishing move
    const move = QUEEN_MOVES[card.suit];
    center = `<div class="face-card">
      <span class="queen-move">${move}</span>
    </div>`;
  } else if (card.rank === 11) {
    // Jack — opponent
    const name = JACK_NAMES[card.suit];
    center = `<div class="face-card">
      <span class="jack-name">${name}</span>
    </div>`;
  } else if (card.rank === 1) {
    // Ace — Poatan ace
    center = `<div class="ace-center">
      <span class="ace-suit">${sym}</span>
      <span class="ace-label">POATAN</span>
    </div>`;
  } else {
    center = `<div class="pip-center">${sym}</div>`;
  }

  div.innerHTML = `
    <div class="card-corner tl">${rl}<br>${sym}</div>
    ${center}
    <div class="card-corner br">${rl}<br>${sym}</div>
  `;

  return div;
}

function renderStock() {
  const el = document.getElementById('stock');
  el.innerHTML = '';
  if (state.stock.cards.length > 0) {
    const card = document.createElement('div');
    card.className = 'card face-down';
    card.innerHTML = '<div class="card-back-inner"></div>';
    el.appendChild(card);
  } else {
    el.innerHTML = '<div class="pile-hint">↺</div>';
  }
}

function renderWaste() {
  const el = document.getElementById('waste');
  el.innerHTML = '';
  el.style.position = 'relative';

  if (state.waste.cards.length === 0) return;

  const cards = state.waste.cards;
  const showCount = state.drawCount === 3 ? Math.min(3, cards.length) : 1;
  const startIdx = cards.length - showCount;

  for (let i = startIdx; i < cards.length; i++) {
    const cardEl = createCardEl(cards[i]);
    const isTop = (i === cards.length - 1);

    if (!isTop) {
      cardEl.style.position = 'absolute';
      cardEl.style.top = '0';
      cardEl.style.left = `${(i - startIdx) * 18}px`;
      cardEl.draggable = false;
      cardEl.style.pointerEvents = 'none';
      cardEl.classList.remove('face-up');
    }

    el.appendChild(cardEl);
  }
}

function renderFoundations() {
  state.foundations.forEach((f, i) => {
    const el = document.getElementById(`foundation-${i}`);
    el.innerHTML = '';
    const top = topCard(f);
    if (top) {
      el.appendChild(createCardEl(top));
    } else {
      el.innerHTML = `<div class="pile-hint">${SUIT_SYMBOLS[f.suit]}</div>`;
    }
  });
}

function renderTableau() {
  state.tableau.forEach((pile, i) => {
    const el = document.getElementById(`tableau-${i}`);
    el.innerHTML = '';
    el.style.position = 'relative';

    if (pile.cards.length === 0) {
      el.style.height = '104px';
      el.innerHTML = '<div class="pile-hint">K</div>';
      return;
    }

    let offset = 0;
    pile.cards.forEach((card, j) => {
      const cardEl = createCardEl(card);
      cardEl.style.position = 'absolute';
      cardEl.style.top  = `${offset}px`;
      cardEl.style.left = '0';
      cardEl.style.right = '0';
      cardEl.style.zIndex = j;
      el.appendChild(cardEl);

      // Advance offset for the next card (except after the last)
      if (j < pile.cards.length - 1) {
        offset += card.faceUp ? 28 : 18;
      }
    });

    // Container height = offset to last card + full card height
    el.style.height = `${offset + 104}px`;
  });
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  const mc = document.getElementById('move-count');
  if (mc) mc.textContent = state.moves;
}

function showWinScreen() {
  const overlay = document.getElementById('win-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('final-moves').textContent = state.moves;
}

function hideWinScreen() {
  document.getElementById('win-overlay').classList.add('hidden');
}

// === INTERACTION ===
function handleClick(e) {
  if (state.won) return;

  const pileEl = e.target.closest('[data-pile-id]');
  if (!pileEl) return;
  const pile = getPileById(pileEl.dataset.pileId);
  if (!pile) return;

  // Click on stock — draw
  if (pile.type === 'stock') {
    drawFromStock();
    render();
    return;
  }

  // Click on a face-up card — try auto-move to foundation
  const cardEl = e.target.closest('.card[data-card-id]');
  if (!cardEl) return;

  const card = pile.cards.find(c => c.id === cardEl.dataset.cardId);
  if (!card || !card.faceUp) return;

  // Only auto-move the top card
  if (card !== topCard(pile)) return;

  if (autoMoveToFoundation(card, pile)) render();
}

// === DRAG & DROP ===
let dragData = null;

function handleDragStart(e) {
  if (state.won) { e.preventDefault(); return; }

  const cardEl = e.target.closest('.card[data-card-id]');
  if (!cardEl) { e.preventDefault(); return; }

  const pile = getPileFromElement(cardEl);
  if (!pile || pile.type === 'stock' || pile.type === 'foundation') {
    e.preventDefault(); return;
  }

  const cards = getCardsFromCard(pile, cardEl.dataset.cardId);
  if (!cards || cards.some(c => !c.faceUp)) { e.preventDefault(); return; }

  dragData = { cards, sourcePile: pile };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', cardEl.dataset.cardId);

  // Dim the cards being dragged after the ghost image is captured
  setTimeout(() => {
    cards.forEach(c => {
      const el = document.querySelector(`.card[data-card-id="${c.id}"]`);
      if (el) el.classList.add('dragging');
    });
  }, 0);
}

function handleDragOver(e) {
  if (!dragData) return;
  const pileEl = e.target.closest('[data-pile-id]');
  if (!pileEl) return;

  const targetPile = getPileById(pileEl.dataset.pileId);
  if (targetPile && isValidMove(dragData.cards, targetPile)) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    pileEl.classList.add('drop-target');
  }
}

function handleDragLeave(e) {
  const pileEl = e.target.closest('[data-pile-id]');
  if (pileEl && !pileEl.contains(e.relatedTarget)) {
    pileEl.classList.remove('drop-target');
  }
}

function handleDrop(e) {
  e.preventDefault();
  if (!dragData) return;

  const pileEl = e.target.closest('[data-pile-id]');
  if (pileEl) {
    const targetPile = getPileById(pileEl.dataset.pileId);
    if (targetPile && isValidMove(dragData.cards, targetPile)) {
      moveCards(dragData.cards, dragData.sourcePile, targetPile);
    }
  }

  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  dragData = null;
  render();
}

function handleDragEnd() {
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  document.querySelectorAll('.card.dragging').forEach(el => el.classList.remove('dragging'));
  dragData = null;
}

function attachEvents() {
  const game = document.getElementById('game');
  game.addEventListener('click',     handleClick);
  game.addEventListener('dragstart', handleDragStart);
  game.addEventListener('dragover',  handleDragOver);
  game.addEventListener('dragleave', handleDragLeave);
  game.addEventListener('drop',      handleDrop);
  game.addEventListener('dragend',   handleDragEnd);

  document.getElementById('new-game-btn').addEventListener('click',  newGame);
  document.getElementById('play-again-btn').addEventListener('click', newGame);
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  newGame();
  attachEvents();
});
