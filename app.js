const root = document.getElementById("root");
const CONFIG = window.CLUE_CONFIG || { supabaseUrl: "", supabaseAnonKey: "" };
const LIVE_CONFIGURED = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const LIVE_ROOM_STORAGE_KEY = "clue-nexus-live-room";

const app = {
  screen: "home",
  state: null,
  viewerId: "",
  live: false,
  supabase: null,
  channel: null,
  tab: "case",
  modal: null,
  loading: false,
  error: "",
  notice: "",
  liveRoomCode: "",
  pollTimer: null,
  liveRefreshInFlight: false,
};

const DEFAULT_RULES = {
  balancedDeck: true,
  expansionCards: true,
  finalAccusationAnytime: false,
  allowChat: true,
  noRepeatRoomSuggestions: true,
  moveSuggestedCharacter: true,
  turnTimer: 0,
};

const BASE_CARDS = [
  ["suspect-scarlet", "Miss Scarlet", "suspect", "✦", "coral", "The red glove was left by the east stair."],
  ["suspect-mustard", "Colonel Mustard", "suspect", "♟", "gold", "A boot print crosses the conservatory tiles."],
  ["suspect-white", "Mrs. White", "suspect", "❖", "slate", "A silver thread caught on the pantry latch."],
  ["suspect-green", "Mr. Green", "suspect", "♣", "mint", "The greenhouse ledger has a missing page."],
  ["suspect-peacock", "Mrs. Peacock", "suspect", "◈", "sky", "A blue feather rests under the library desk."],
  ["suspect-plum", "Professor Plum", "suspect", "✧", "violet", "Ink stains trail toward the west wing."],
  ["room-kitchen", "Kitchen", "room", "⌁", "coral", "The range is still warm despite the cold night."],
  ["room-ballroom", "Ballroom", "room", "◌", "gold", "The chandelier chain sways by itself."],
  ["room-conservatory", "Conservatory", "room", "❀", "mint", "Rainwater marks the marble path."],
  ["room-billiard", "Billiard Room", "room", "●", "lime", "One ivory ball is missing from the rack."],
  ["room-library", "Library", "room", "▤", "sky", "A book on poisons lies open on the lectern."],
  ["room-study", "Study", "room", "⌂", "violet", "The desk drawer was forced open."],
  ["room-hall", "Hall", "room", "╋", "slate", "The grandfather clock stopped at midnight."],
  ["room-lounge", "Lounge", "room", "◒", "rose", "A teacup still has a lipstick mark."],
  ["room-dining", "Dining Room", "room", "⌁", "gold", "A chair is pulled away from the table."],
  ["weapon-candlestick", "Candlestick", "weapon", "♜", "gold", "Wax flecks shimmer on the carpet."],
  ["weapon-dagger", "Dagger", "weapon", "⌁", "slate", "A narrow scratch marks the desk edge."],
  ["weapon-pipe", "Lead Pipe", "weapon", "◓", "mint", "Metal dust is caught in the rug."],
  ["weapon-revolver", "Revolver", "weapon", "◉", "violet", "The empty case is warm to the touch."],
  ["weapon-rope", "Rope", "weapon", "∞", "coral", "A frayed knot hangs from the balcony."],
  ["weapon-wrench", "Wrench", "weapon", "⚒", "sky", "Grease stains mark the service door."],
].map(toCard);

const EXPANSION_CARDS = [
  ["suspect-orchid", "Dr. Orchid", "suspect", "✤", "rose", "A pressed orchid is tucked inside a medical journal."],
  ["suspect-brunette", "Monsieur Brunette", "suspect", "✥", "gold", "A brass cufflink glints under the drawing-room sofa."],
  ["suspect-peach", "Miss Peach", "suspect", "✹", "coral", "A peach-colored ribbon is tied around a key."],
  ["suspect-gray", "Sergeant Gray", "suspect", "✣", "slate", "A service whistle echoes from the servants' stair."],
  ["room-observatory", "Observatory", "room", "◒", "violet", "The telescope points toward the empty moor."],
  ["room-courtyard", "Courtyard", "room", "✽", "mint", "Fresh gravel crunches under an unseen step."],
  ["room-wine-cellar", "Wine Cellar", "room", "◍", "rose", "A cork has been pulled from the oldest bottle."],
  ["weapon-lantern", "Lantern", "weapon", "☼", "gold", "The wick was trimmed moments ago."],
  ["weapon-poison", "Poison Vial", "weapon", "♙", "lime", "A green drop shines on a white handkerchief."],
  ["weapon-trophy", "Silver Trophy", "weapon", "♕", "sky", "The display case has a clean empty outline."],
].map((item) => ({ ...toCard(item), expansion: true }));
const ALL_CARDS = [...BASE_CARDS, ...EXPANSION_CARDS];
const CARDS_BY_ID = Object.fromEntries(ALL_CARDS.map((card) => [card.id, card]));
const CHARACTER_OPTIONS = [
  { id: "suspect-scarlet", name: "Miss Scarlet", color: "coral", glyph: "✦" },
  { id: "suspect-mustard", name: "Colonel Mustard", color: "gold", glyph: "♟" },
  { id: "suspect-white", name: "Mrs. White", color: "sky", glyph: "❖" },
  { id: "suspect-green", name: "Mr. Green", color: "mint", glyph: "♣" },
  { id: "suspect-peacock", name: "Mrs. Peacock", color: "violet", glyph: "◈" },
  { id: "suspect-plum", name: "Professor Plum", color: "rose", glyph: "✧" },
  { id: "suspect-orchid", name: "Dr. Orchid", color: "lime", glyph: "✤" },
];
const characterFor = (characterId, fallbackIndex = 0, legacyName = "") => CHARACTER_OPTIONS.find((character) => character.id === characterId) || CHARACTER_OPTIONS.find((character) => character.name.toLowerCase() === String(legacyName).trim().toLowerCase()) || CHARACTER_OPTIONS[fallbackIndex % CHARACTER_OPTIONS.length];

const ROOM_META = {
  study: ["Study", "quiet papers", "⌂", 80, 80, "violet"],
  hall: ["Hall", "long shadows", "╋", 48, 80, "slate"],
  lounge: ["Lounge", "low voices", "◒", 16, 80, "rose"],
  library: ["Library", "locked spines", "▤", 80, 68, "sky"],
  billiard: ["Billiard Room", "one ball short", "●", 80, 48, "lime"],
  dining: ["Dining Room", "place settings", "⌁", 16, 48, "gold"],
  conservatory: ["Conservatory", "rain on glass", "❀", 80, 16, "mint"],
  ballroom: ["Ballroom", "echoing music", "◌", 48, 16, "coral"],
  kitchen: ["Kitchen", "warm range", "⌁", 16, 16, "coral"],
};
const ROOM_IDS = Object.keys(ROOM_META);
const CORRIDOR_LINKS = [
  ["kitchen", "ballroom"], ["ballroom", "conservatory"], ["kitchen", "dining"], ["dining", "lounge"],
  ["ballroom", "hall"], ["hall", "lounge"], ["hall", "study"], ["conservatory", "billiard"],
  ["billiard", "library"], ["library", "study"], ["dining", "billiard"],
];
const SECRET_PASSAGES = [["kitchen", "study"], ["lounge", "conservatory"]];
const ROOM_POINTS = {
  kitchen: [4, 4], ballroom: [12, 4], conservatory: [20, 4], dining: [4, 12], billiard: [20, 12],
  library: [20, 17], lounge: [4, 20], hall: [12, 20], study: [20, 20],
};
const toBoardPercent = (value) => 4 + (value - 1) * 4;
const boardKey = (x, y) => `${x}:${y}`;
const boardPoints = new Map();
ROOM_IDS.forEach((roomId) => { const [x, y] = ROOM_POINTS[roomId]; boardPoints.set(boardKey(x, y), { x: toBoardPercent(x), y: toBoardPercent(y), roomId, isRoom: true }); });
function addBoardSegment(fromRoom, toRoom) {
  const [fromX, fromY] = ROOM_POINTS[fromRoom]; const [toX, toY] = ROOM_POINTS[toRoom];
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)); const stepX = Math.sign(toX - fromX); const stepY = Math.sign(toY - fromY);
  for (let step = 0; step <= steps; step += 1) { const x = fromX + stepX * step; const y = fromY + stepY * step; const key = boardKey(x, y); if (!boardPoints.has(key)) boardPoints.set(key, { x: toBoardPercent(x), y: toBoardPercent(y), roomId: null, isRoom: false }); }
}
CORRIDOR_LINKS.forEach(([from, to]) => addBoardSegment(from, to));
const BOARD_TILES = Array.from(boardPoints.values()).map((point, id) => ({ ...point, id }));
const tileAtPoint = new Map(BOARD_TILES.map((tile) => [boardKey(tile.x, tile.y), tile.id]));
const ROOM_TILE_INDEX = Object.fromEntries(ROOM_IDS.map((roomId) => { const [x, y] = ROOM_POINTS[roomId]; return [roomId, tileAtPoint.get(boardKey(toBoardPercent(x), toBoardPercent(y)))]; }));
const boardGraphSets = new Map(BOARD_TILES.map((tile) => [tile.id, new Set()]));
const connectBoardTiles = (from, to) => { boardGraphSets.get(from)?.add(to); boardGraphSets.get(to)?.add(from); };
function boardSegmentIds(fromRoom, toRoom) {
  const [fromX, fromY] = ROOM_POINTS[fromRoom]; const [toX, toY] = ROOM_POINTS[toRoom]; const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)); const stepX = Math.sign(toX - fromX); const stepY = Math.sign(toY - fromY);
  return Array.from({ length: steps + 1 }, (_, step) => tileAtPoint.get(boardKey(toBoardPercent(fromX + stepX * step), toBoardPercent(fromY + stepY * step))));
}
CORRIDOR_LINKS.forEach(([from, to]) => { const ids = boardSegmentIds(from, to); for (let index = 1; index < ids.length; index += 1) connectBoardTiles(ids[index - 1], ids[index]); });
SECRET_PASSAGES.forEach(([from, to]) => connectBoardTiles(ROOM_TILE_INDEX[from], ROOM_TILE_INDEX[to]));
const BOARD_GRAPH = Object.fromEntries(Array.from(boardGraphSets.entries()).map(([id, neighbors]) => [id, Array.from(neighbors)]));
const BOARD_CONNECTIONS = [...CORRIDOR_LINKS.map(([from, to]) => ({ from: ROOM_TILE_INDEX[from], to: ROOM_TILE_INDEX[to] })), ...SECRET_PASSAGES.map(([from, to]) => ({ from: ROOM_TILE_INDEX[from], to: ROOM_TILE_INDEX[to], secret: true }))];
const ROOM_GRAPH = Object.fromEntries(ROOM_IDS.map((roomId) => [roomId,
  CORRIDOR_LINKS.filter(([from]) => from === roomId).map(([, to]) => to)
    .concat(CORRIDOR_LINKS.filter(([, to]) => to === roomId).map(([from]) => from))
    .concat(SECRET_PASSAGES.filter(([from]) => from === roomId).map(([, to]) => to))
    .concat(SECRET_PASSAGES.filter(([, to]) => to === roomId).map(([from]) => from)),
]));

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const uid = (prefix = "id") => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`;
const card = (id) => CARDS_BY_ID[id];
const cardName = (id) => card(id)?.name || "Unknown card";
const roomName = (id) => ROOM_META[id]?.[0] || "Unknown room";
const clone = (value) => JSON.parse(JSON.stringify(value));
const eventLog = (text, tone = "slate") => ({ id: uid("event"), text, tone, timestamp: Date.now() });
function toCard(item) { return { id: item[0], name: item[1], category: item[2], glyph: item[3], tone: item[4], clue: item[5] }; }
function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
function pick(items) { return items[Math.floor(Math.random() * items.length)]; }

function cardsForPlayers(count, includeExpansion = true) {
  const safeCount = Math.min(7, Math.max(2, count));
  const handSize = Math.max(3, Math.ceil(18 / safeCount));
  const extraNeeded = Math.max(0, handSize * safeCount - 18);
  const plan = { 2: [], 3: [], 4: ["suspect", "weapon"], 5: ["suspect", "room"], 6: [], 7: ["suspect", "room", "weapon"] }[safeCount] || [];
  const expansions = [];
  plan.slice(0, extraNeeded).forEach((category) => {
    const candidate = EXPANSION_CARDS.find((item) => item.category === category && !expansions.includes(item));
    if (candidate) expansions.push(candidate);
  });
  if (includeExpansion) EXPANSION_CARDS.forEach((candidate) => { if (expansions.length < extraNeeded && !expansions.includes(candidate)) expansions.push(candidate); });
  return { cards: [...BASE_CARDS, ...(includeExpansion ? expansions : [])], handSize, expansionCards: expansions };
}

function makePlayers(entries, hostId) {
  const actualHost = hostId || entries[0]?.id;
  return entries.map((entry, index) => {
    const character = characterFor(entry.characterId, index, entry.name);
    const roomId = ROOM_IDS[index % ROOM_IDS.length];
    return {
      id: entry.id || uid("player"),
      characterId: character.id,
      name: character.name,
      color: character.color,
      isHost: (entry.id || actualHost) === actualHost,
      isConnected: true,
      ready: false,
      eliminated: false,
      position: { roomId, step: 0, tileIndex: ROOM_TILE_INDEX[roomId], inRoom: true },
      cardCount: 0,
    };
  });
}

function deal(players, cards) {
  const solution = [pick(cards.filter((item) => item.category === "suspect")), pick(cards.filter((item) => item.category === "room")), pick(cards.filter((item) => item.category === "weapon"))].map((item) => item.id);
  const hands = Object.fromEntries(players.map((player) => [player.id, []]));
  shuffle(cards.filter((item) => !solution.includes(item.id))).forEach((id, index) => hands[players[index % players.length].id].push(id.id || id));
  return { solution, hands };
}

function createGame(roomCode, roomNameValue, entries, settings = DEFAULT_RULES) {
  const players = makePlayers(entries);
  const pool = cardsForPlayers(players.length, settings.expansionCards);
  const dealt = deal(players, pool.cards);
  return {
    roomCode,
    roomName: roomNameValue || "The Unnamed Estate",
    phase: "lobby",
    hostId: players[0]?.id || "",
    players,
    currentPlayerIndex: 0,
    movesLeft: 0,
    lastRoll: null,
    suggestion: null,
    suggestionHistory: [],
    lastSuggestionRoomByPlayer: {},
    solution: dealt.solution,
    hands: dealt.hands,
    notes: {},
    events: [eventLog(`${roomNameValue || "The Unnamed Estate"} is ready. The case file is sealed.`, "gold")],
    messages: [],
    settings: { ...DEFAULT_RULES, ...settings },
    winnerId: undefined,
    deckInfo: { handSize: pool.handSize, expansionCards: pool.expansionCards.map((item) => item.id), totalCards: pool.cards.length },
  };
}

function activePlayers(state) { return state.players.filter((player) => !player.eliminated); }
function currentPlayer(state) { return state.players[state.currentPlayerIndex]; }
function nextActiveIndex(state, fromIndex) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (fromIndex + offset) % state.players.length; if (!state.players[index].eliminated) return index; } return fromIndex; }
function refreshHands(state) { const pool = cardsForPlayers(state.players.length, state.settings.expansionCards); const dealt = deal(state.players, pool.cards); state.solution = dealt.solution; state.hands = dealt.hands; state.deckInfo = { handSize: pool.handSize, expansionCards: pool.expansionCards.map((item) => item.id), totalCards: pool.cards.length }; state.players.forEach((player) => { player.cardCount = state.hands[player.id]?.length || 0; }); return state; }
function startGame(state) {
  refreshHands(state);
  state.phase = "playing";
  state.players.forEach((player, index) => {
    const character = characterFor(player.characterId, index, player.name);
    player.characterId = character.id;
    player.name = character.name;
    player.color = character.color;
    player.ready = true;
    const tileIndex = Number.isInteger(player.position?.tileIndex) && BOARD_TILES[player.position.tileIndex]
      ? player.position.tileIndex
      : ROOM_TILE_INDEX[player.position?.roomId] ?? ROOM_TILE_INDEX[ROOM_IDS[index % ROOM_IDS.length]];
    const tile = BOARD_TILES[tileIndex] || BOARD_TILES[0];
    player.position = { ...player.position, tileIndex: tile.id, roomId: tile.roomId || player.position?.roomId || ROOM_IDS[index % ROOM_IDS.length], step: 0, inRoom: tile.isRoom };
  });
  state.currentPlayerIndex = 0;
  state.movesLeft = 0;
  state.lastRoll = null;
  state.suggestion = null;
  state.suggestionHistory = state.suggestionHistory || [];
  state.lastSuggestionRoomByPlayer = state.lastSuggestionRoomByPlayer || {};
  state.events.unshift(eventLog("The doors are locked. The investigation begins.", "gold"));
  return state;
}
function addPlayer(state, entry) {
  if (state.phase !== "lobby" || state.players.length >= 7) return state;
  const usedCharacters = new Set(state.players.map((player, index) => characterFor(player.characterId, index, player.name).id));
  const requested = characterFor(entry.characterId, state.players.length, entry.name);
  const character = usedCharacters.has(requested.id) ? CHARACTER_OPTIONS.find((candidate) => !usedCharacters.has(candidate.id)) : requested;
  if (!character) return state;
  const player = makePlayers([{ ...entry, characterId: character.id }], state.hostId)[0];
  const roomId = ROOM_IDS[state.players.length % ROOM_IDS.length];
  player.isHost = false;
  player.position = { roomId, step: 0, tileIndex: ROOM_TILE_INDEX[roomId], inRoom: true };
  state.players.push(player);
  state.events.unshift(eventLog(`${player.name} joined the investigation.`, "mint"));
  return state;
}
function toggleReady(state, playerId) { const player = state.players.find((item) => item.id === playerId); if (player) player.ready = !player.ready; return state; }
function updateSettings(state, settings) { if (state.phase === "lobby") state.settings = { ...state.settings, ...settings }; return state; }
function roll(state, playerId) { const player = currentPlayer(state); if (state.phase !== "playing" || player?.id !== playerId || state.movesLeft > 0 || state.lastRoll !== null || state.suggestion?.status === "waiting") return state; state.lastRoll = Math.floor(Math.random() * 6) + 1; state.movesLeft = state.lastRoll; state.events.unshift(eventLog(`${player.name} rolled ${state.lastRoll}.`, "blue")); return state; }
function tileDistance(from, to) {
  if (from === to) return 0;
  const distances = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift();
    const distance = distances.get(current);
    for (const next of BOARD_GRAPH[current] || []) {
      if (distances.has(next)) continue;
      if (next === to) return distance + 1;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return Infinity;
}
function reachableTileDistances(from, maxDistance) { const distances = new Map([[from, 0]]); const queue = [from]; while (queue.length) { const current = queue.shift(); const distance = distances.get(current); if (distance >= maxDistance) continue; (BOARD_GRAPH[current] || []).forEach((next) => { if (!distances.has(next)) { distances.set(next, distance + 1); queue.push(next); } }); } return distances; }
function playerTileIndex(player, fallbackIndex = 0) { const tileIndex = Number.isInteger(player?.position?.tileIndex) ? player.position.tileIndex : ROOM_TILE_INDEX[player?.position?.roomId] ?? fallbackIndex; return BOARD_TILES[tileIndex] ? tileIndex : 0; }
function move(state, playerId, destination) {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || player?.id !== playerId || state.movesLeft <= 0) return state;
  const destinationTile = BOARD_TILES[Number(destination)];
  if (!destinationTile) return state;
  const fromTile = playerTileIndex(player, state.players.indexOf(player));
  const distance = tileDistance(fromTile, destinationTile.id);
  if (distance < 1 || distance > state.movesLeft) return state;
  player.position = {
    roomId: destinationTile.isRoom ? destinationTile.roomId : player.position.roomId,
    step: 0,
    tileIndex: destinationTile.id,
    inRoom: destinationTile.isRoom,
  };
  state.movesLeft -= distance;
  state.events.unshift(eventLog(`${player.name} moved ${distance} space${distance === 1 ? "" : "s"}${destinationTile.isRoom ? ` to the ${roomName(destinationTile.roomId)}` : ""}.`, "mint"));
  return state;
}
function playerInRoom(player) {
  const tile = BOARD_TILES[playerTileIndex(player)];
  return Boolean(tile?.isRoom && tile.roomId && player?.position?.inRoom !== false);
}
function finishMovement(state, playerId) { const player = currentPlayer(state); if (state.phase !== "playing" || player?.id !== playerId || state.movesLeft <= 0 || state.suggestion?.status === "waiting") return state; state.movesLeft = 0; state.events.unshift(eventLog(`${player.name} finished moving.`, "slate")); return state; }
function endTurn(state, playerId) { const player = currentPlayer(state); if (state.phase !== "playing" || player?.id !== playerId || state.movesLeft > 0 || state.suggestion?.status === "waiting") return state; state.currentPlayerIndex = nextActiveIndex(state, state.currentPlayerIndex); state.lastRoll = null; state.movesLeft = 0; state.suggestion = null; state.events.unshift(eventLog(`${currentPlayer(state).name}'s turn.`, "gold")); return state; }
function matchingCards(hand, suggestion) { return (hand || []).filter((id) => [suggestion.suspectId, suggestion.weaponId, suggestion.roomId].includes(id)); }
function addSuggestionHistory(state, suggestion, result, shownCardId) {
  state.suggestionHistory = [...(state.suggestionHistory || []), {
    id: uid("suggestion"),
    byPlayerId: suggestion.byPlayerId,
    suspectId: suggestion.suspectId,
    weaponId: suggestion.weaponId,
    roomId: suggestion.roomId,
    result,
    shownToPlayerId: shownCardId ? suggestion.byPlayerId : undefined,
    shownCardId,
    timestamp: Date.now(),
  }].slice(-50);
}
function makeSuggestion(state, playerId, suspectId, weaponId) {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || player?.id !== playerId || state.suggestion?.status === "waiting" || !playerInRoom(player) || !player.position.roomId) return state;
  const roomId = player.position.roomId;
  if (state.settings.noRepeatRoomSuggestions !== false && state.lastSuggestionRoomByPlayer?.[playerId] === roomId) return state;
  const responderIds = state.players
    .filter((item) => item.id !== playerId && !item.eliminated)
    .sort((a, b) => (state.players.indexOf(a) - state.players.indexOf(player) + state.players.length) % state.players.length - (state.players.indexOf(b) - state.players.indexOf(player) + state.players.length) % state.players.length)
    .map((item) => item.id);
  const suspectPlayer = state.players.find((item, index) => characterFor(item.characterId, index, item.name).id === suspectId && !item.eliminated);
  if (state.settings.moveSuggestedCharacter !== false && suspectPlayer) {
    suspectPlayer.position = { roomId, step: 0, tileIndex: ROOM_TILE_INDEX[roomId], inRoom: true };
  }
  const suggestion = {
    byPlayerId: playerId,
    suspectId,
    weaponId,
    roomId,
    responderIds,
    responderIndex: 0,
    status: responderIds.length ? "waiting" : "no-match",
    movedPlayerId: state.settings.moveSuggestedCharacter !== false ? suspectPlayer?.id : undefined,
  };
  state.suggestion = suggestion;
  state.lastSuggestionRoomByPlayer = { ...(state.lastSuggestionRoomByPlayer || {}), [playerId]: roomId };
  state.events.unshift(eventLog(`${player.name} made a suggestion in the ${roomName(roomId)}.`, "rose"));
  if (!responderIds.length) {
    addSuggestionHistory(state, suggestion, "no-match");
    state.events.unshift(eventLog("No one could disprove the suggestion.", "rose"));
  }
  return state;
}
function respond(state, responderId, cardId) {
  const suggestion = state.suggestion;
  if (!suggestion || suggestion.status !== "waiting" || suggestion.responderIds[suggestion.responderIndex] !== responderId) return state;
  const matches = matchingCards(state.hands[responderId], suggestion);
  if (cardId && !matches.includes(cardId)) return state;
  if (!cardId && matches.length) return state;
  if (cardId) {
    suggestion.status = "resolved";
    suggestion.shownToPlayerId = suggestion.byPlayerId;
    suggestion.shownCardId = cardId;
    addSuggestionHistory(state, suggestion, "shown", cardId);
    state.events.unshift(eventLog("A detective quietly answered the suggestion.", "blue"));
    rememberShownCard(state);
    return state;
  }
  suggestion.responderIndex += 1;
  if (suggestion.responderIndex >= suggestion.responderIds.length) {
    suggestion.status = "no-match";
    addSuggestionHistory(state, suggestion, "no-match");
    state.events.unshift(eventLog("No one could disprove the suggestion.", "rose"));
  }
  return state;
}
function autoResolve(state) { const suggestion = state.suggestion; if (!suggestion || suggestion.status !== "waiting") return state; for (let index = suggestion.responderIndex; index < suggestion.responderIds.length; index += 1) { const id = suggestion.responderIds[index]; const matches = matchingCards(state.hands[id], suggestion); if (matches.length) return respond(state, id, matches[0]); respond(state, id, null); if (state.suggestion.status !== "waiting") break; } return state; }
function accuse(state, playerId, suspectId, weaponId, roomId) { const player = currentPlayer(state); if (state.phase !== "playing" || player?.id !== playerId || (!state.settings.finalAccusationAnytime && (!playerInRoom(player) || player.position.roomId !== roomId))) return state; const correct = [suspectId, weaponId, roomId].every((id) => state.solution.includes(id)); if (correct) { state.phase = "won"; state.winnerId = playerId; state.events.unshift(eventLog(`${player.name} solved the mystery. Case closed.`, "gold")); return state; } player.eliminated = true; state.movesLeft = 0; state.suggestion = null; state.events.unshift(eventLog(`${player.name}'s accusation was incorrect. They can no longer accuse.`, "rose")); if (activePlayers(state).length <= 1) state.phase = "ended"; else state.currentPlayerIndex = nextActiveIndex(state, state.currentPlayerIndex); return state; }
function setNote(state, playerId, cardId, value) { state.notes[playerId] = { ...(state.notes[playerId] || {}) }; if (value === "unknown") delete state.notes[playerId][cardId]; else state.notes[playerId][cardId] = value; return state; }
function addChat(state, playerId, text) { const player = state.players.find((item) => item.id === playerId); const trimmed = text.trim().slice(0, 240); if (!player || !trimmed || !state.settings.allowChat) return state; state.messages.push({ id: uid("message"), playerId, playerName: player.name, text: trimmed, timestamp: Date.now() }); state.messages = state.messages.slice(-60); return state; }

function localDemo(characterId, roomNameValue) { const viewerId = uid("you"); let state = createGame("DEMO42", roomNameValue || "The Moonlit Estate", [{ id: viewerId, characterId }, { id: "demo-alex", characterId: "suspect-mustard" }, { id: "demo-morgan", characterId: "suspect-white" }]); startGame(state); addChat(state, "demo-alex", "I saw someone near the library."); addChat(state, "demo-morgan", "That is a very suspicious thing to say."); return { state, viewerId }; }

async function ensureSupabase() {
  if (!LIVE_CONFIGURED) throw new Error("Supabase is not configured. Use room DEMO42 for the local demo.");
  if (!app.supabase) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    app.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }
  const session = await app.supabase.auth.getSession();
  if (!session.data.session) {
    const result = await app.supabase.auth.signInAnonymously();
    if (result.error) throw new Error(`Could not create a guest session: ${result.error.message}`);
  }
}

async function liveCall(action) {
  await ensureSupabase();
  const result = await app.supabase.functions.invoke("game-action", { body: action });
  if (result.error) throw new Error(result.data?.error || result.error.message || "The game server did not respond.");
  if (!result.data?.state) throw new Error(result.data?.error || "The game server returned an invalid response.");
  return result.data;
}

function rememberLiveRoom(roomCode) {
  try { localStorage.setItem(LIVE_ROOM_STORAGE_KEY, JSON.stringify({ roomCode })); } catch { /* Storage can be unavailable in private browsing. */ }
}

function forgetLiveRoom() {
  try { localStorage.removeItem(LIVE_ROOM_STORAGE_KEY); } catch { /* Storage can be unavailable in private browsing. */ }
}

function stopLiveUpdates() {
  if (app.pollTimer) window.clearInterval(app.pollTimer);
  app.pollTimer = null;
  if (app.channel && app.supabase) void app.supabase.removeChannel(app.channel);
  app.channel = null;
  app.liveRoomCode = "";
}

function replaceLiveState(result, roomCode) {
  if (!app.live || app.liveRoomCode !== roomCode) return false;
  const nextState = result.state;
  const changed = JSON.stringify(app.state) !== JSON.stringify(nextState);
  app.state = nextState;
  app.viewerId = nextState.myPlayerId || app.viewerId;
  rememberShownCard(nextState);
  if (changed) render();
  return changed;
}

async function refreshLiveState(roomCode, showError = false) {
  if (!app.live || app.liveRoomCode !== roomCode || app.liveRefreshInFlight) return;
  app.liveRefreshInFlight = true;
  try {
    const result = await liveCall({ type: "get", roomCode });
    replaceLiveState(result, roomCode);
  } catch (error) {
    if (showError && app.live && app.liveRoomCode === roomCode) {
      app.error = error.message;
      render();
    }
  } finally {
    app.liveRefreshInFlight = false;
  }
}

async function subscribeLive(roomCode) {
  if (!app.supabase) return;
  if (app.channel) await app.supabase.removeChannel(app.channel);
  if (app.pollTimer) window.clearInterval(app.pollTimer);
  app.liveRoomCode = roomCode;
  app.channel = app.supabase.channel(`clue-room-${roomCode}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "clue_rooms", filter: `code=eq.${roomCode}` }, () => {
    void refreshLiveState(roomCode, true);
  }).subscribe();

  // Realtime is the fast path. The short polling fallback keeps the room live
  // even when a browser, proxy, or Supabase channel misses a change event.
  app.pollTimer = window.setInterval(() => { void refreshLiveState(roomCode); }, 1500);
}

async function enterLive(result) {
  app.state = result.state;
  app.viewerId = result.state.myPlayerId || "";
  app.live = true;
  app.screen = "home";
  app.error = "";
  app.notice = `Room ${result.roomCode} is ready to share.`;
  rememberLiveRoom(result.roomCode);
  render();
  await subscribeLive(result.roomCode);
}

function enterDemo(result, notice) {
  stopLiveUpdates();
  forgetLiveRoom();
  app.state = result.state;
  app.viewerId = result.viewerId;
  app.live = false;
  app.screen = "home";
  app.error = "";
  app.notice = notice;
  render();
}

function leaveRoom() {
  stopLiveUpdates();
  forgetLiveRoom();
  app.state = null;
  app.viewerId = "";
  app.live = false;
  app.tab = "case";
  app.modal = null;
  app.error = "";
  app.notice = "";
  render();
}

async function performLive(action) {
  try {
    const result = await liveCall({ ...action, roomCode: app.state.roomCode });
    const changed = replaceLiveState(result, app.state.roomCode);
    app.error = "";
    if (!changed) render();
  } catch (error) {
    app.error = error.message;
    render();
  }
}
function performLocal(transform, resolve = false) { const next = clone(app.state); app.state = transform(next); if (resolve) app.state = autoResolve(app.state); rememberShownCard(app.state); render(); }
function act(type, payload = {}, localTransform = null, resolve = false) { if (app.live) void performLive({ type, ...payload }); else if (localTransform) performLocal(localTransform, resolve); }

function render() {
  if (!app.state) { root.innerHTML = app.screen === "home" ? homeView() : setupView(app.screen); }
  else if (app.state.phase === "lobby") root.innerHTML = lobbyView(app.state);
  else root.innerHTML = gameView(app.state);
  attachTransient();
}

function attachTransient() {
  // Event delegation is installed once on #root; freshly rendered markup needs no rebinding.
}

function homeView() {
  return `<main class="landing-shell"><div class="ambient-orb orb-one"></div><div class="ambient-orb orb-two"></div><header class="landing-header"><div class="brand-lockup"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><div class="status-pill"><span class="status-dot ${LIVE_CONFIGURED ? "live" : "demo"}"></span>${LIVE_CONFIGURED ? "Live rooms ready" : "Demo mode ready"}</div></header><section class="hero-grid"><div class="hero-copy"><p class="eyebrow">A mystery night, upgraded</p><h1>Every room has<br><span>an alibi.</span></h1><p class="hero-description">A live, house-rule friendly mystery board game for the people who know the classics—and the people who always add one more twist.</p><div class="hero-actions"><button class="button button-primary button-large" data-screen="create"><span>＋</span> Create a room</button><button class="button button-ghost button-large" data-screen="join">Join with a code <span>→</span></button></div><div class="feature-row"><span><b>02–07</b> detectives</span><span><b>0</b> accounts for guests</span><span><b>∞</b> house rules</span></div></div><div class="hero-art"><div class="moon"></div><div class="cloud cloud-a"></div><div class="cloud cloud-b"></div><div class="mansion"><div class="roof roof-back"></div><div class="roof roof-front"></div><div class="mansion-body"><div class="tower tower-left"><div class="window window-tall"></div></div><div class="mansion-center"><div class="attic-window"></div><div class="window-row"><div class="window"></div><div class="window lit"></div><div class="window"></div></div><div class="door"><span>✦</span></div></div><div class="tower tower-right"><div class="window window-tall lit"></div></div></div><div class="mansion-ground"></div></div><div class="art-card card-clue"><span class="card-symbol">♜</span><b>Candlestick</b><small>unconfirmed</small></div><div class="art-card card-room"><span class="card-symbol">▤</span><b>Library</b><small>seen by you</small></div><div class="art-stamp">CASE<br><strong>007</strong></div></div></section><footer class="landing-footer"><span>Built for the table, tuned for the group chat.</span><span class="footer-rule"></span><span>Classic cards + balanced expansions</span></footer></main>`;
}

function setupView(kind) {
  const create = kind === "create";
  return `<main class="setup-shell"><div class="setup-panel"><button class="back-link" data-screen="home">← Back to the foyer</button><div class="setup-heading"><div class="brand-lockup"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><p class="eyebrow">${create ? "Open a new case" : "Step into an open case"}</p><h1>${create ? "Set the table." : "What’s the room code?"}</h1><p>${create ? "Choose a name for the mansion. Your friends will join with a six-character code." : "Enter the code your host shared. No account, email, or password needed."}</p></div><form class="setup-form" id="${create ? "create-form" : "join-form"}><label><span>Your detective name</span><input name="displayName" autofocus placeholder="e.g. Detective Mark" maxlength="22" required></label>${create ? `<label><span>Mansion name <small>optional</small></span><input name="roomName" value="The Moonlit Estate" maxlength="36"></label>` : `<label><span>Room code</span><input class="code-input" name="roomCode" placeholder="A7K2QF" maxlength="6" required></label>`}${app.error ? `<div class="error-banner">${esc(app.error)}</div>` : ""}<button class="button button-primary button-full" type="submit" ${app.loading ? "disabled" : ""}>${app.loading ? "Unlocking the door…" : create ? "Create the room →" : "Enter the room →"}</button></form><div class="setup-note"><span>✦</span>${LIVE_CONFIGURED ? "Live multiplayer is configured." : "You are in demo mode until Supabase is connected."}</div></div><aside class="setup-aside"><div class="aside-quote">“The truth is hidden in plain sight.”</div><div class="aside-moon"></div><div class="aside-lines"><span></span><span></span><span></span></div><div class="aside-detail"><b>02—07</b><span>players per case</span></div></aside></main>`;
}

function lobbyView(state) {
  const me = state.players.find((player) => player.id === app.viewerId);
  const host = state.hostId === app.viewerId;
  const deck = cardsForPlayers(state.players.length, state.settings.expansionCards);
  return `<div class="lobby-page"><div class="lobby-hero"><div><p class="eyebrow">The guest list is forming</p><h1>${esc(state.roomName)}</h1><p class="lobby-subtitle">Share the room code, settle on the house rules, and let the accusations begin.</p></div><div class="room-code-card"><span>ROOM CODE</span><strong>${esc(state.roomCode)}</strong><small>Tap the code in the header to copy it</small></div></div><div class="lobby-grid"><section class="panel players-panel"><div class="panel-heading"><div><span class="section-kicker">01 / THE GUESTS</span><h2>Who’s at the table?</h2></div><span class="count-badge">${state.players.length} / 7</span></div><div class="player-list">${state.players.map((player) => `<div class="lobby-player player-${player.color}"><div class="player-avatar">${esc(player.name.slice(0, 1).toUpperCase())}</div><div class="player-meta"><strong>${esc(player.name)}${player.id === app.viewerId ? " (you)" : ""}</strong><span>${player.isHost ? "Host / case owner" : player.ready ? "Ready to investigate" : "Choosing a seat"}</span></div>${player.isHost ? "<span class=\"host-tag\">HOST</span>" : ""}<span class="ready-light ${player.ready ? "ready" : ""}"></span></div>`).join("")}${state.players.length < 7 ? `<div class="empty-seat"><span>＋</span><div><strong>Invite another detective</strong><small>${app.live ? "Send them the room code" : "Connect Supabase for live friends"}</small></div></div>` : ""}</div><div class="panel-footer player-footer"><span><i class="status-dot ${app.live ? "live" : "demo"}"></i>${app.live ? "Live room" : "Local demo table"}</span><button class="button button-subtle" data-action="leave">Leave room</button></div></section><section class="panel rules-panel"><div class="panel-heading"><div><span class="section-kicker">02 / THE HOUSE RULES</span><h2>Make it yours.</h2></div><span class="wax-seal">✦</span></div><div class="rules-list">${ruleRow("Balanced deck", `${deck.handSize} cards per detective`, state.settings.balancedDeck, !host, "balancedDeck")}${ruleRow("Nexus expansion", `${deck.expansionCards.length} new card${deck.expansionCards.length === 1 ? "" : "s"} at this table`, state.settings.expansionCards, !host, "expansionCards")}${ruleRow("Accuse anytime", "A final accusation is not limited to your room", state.settings.finalAccusationAnytime, !host, "finalAccusationAnytime")}${ruleRow("Room chat", "A shared channel for suspicious observations", state.settings.allowChat, !host, "allowChat")}</div><div class="deck-preview"><span class="deck-preview-icon">▤</span><div><strong>${state.players.length < 2 ? "Waiting for another player" : `${state.players.length} detectives, ${state.players.length * deck.handSize + 3} cards in play`}</strong><small>New cards are added; nobody gets a larger starting hand.</small></div></div></section></div><div class="lobby-bottom-bar"><div class="ready-callout"><span class="ready-ring"></span>${me?.ready ? "You’re ready. Waiting for the host." : host ? "You’re the host. Start when everyone is ready." : "Mark yourself ready when you’re set."}</div><div class="lobby-actions">${!host ? `<button class="button ${me?.ready ? "button-ghost" : "button-primary"}" data-action="ready">${me?.ready ? "Unready" : "I’m ready →"}</button>` : `<button class="button button-primary" ${state.players.length < 2 ? "disabled" : ""} data-action="start">${state.players.length < 2 ? "Waiting for a second player" : "Seal the case →"}</button>`}</div></div>${globalOverlay()}</div>`;
}

function ruleRow(label, detail, enabled, disabled, key) {
  return `<div class="rule-row ${disabled ? "disabled" : ""}"><div><strong>${label}</strong><small>${detail}</small></div><button class="toggle ${enabled ? "on" : ""}" data-action="setting" data-key="${key}" data-value="${enabled ? "false" : "true"}" aria-label="${label}: ${enabled ? "on" : "off"}" ${disabled ? "disabled" : ""}><span></span></button></div>`;
}

function gameView(state) {
  const me = state.players.find((player) => player.id === app.viewerId);
  const active = state.players[state.currentPlayerIndex];
  const isMyTurn = active?.id === app.viewerId && !me?.eliminated;
  const myHand = app.live ? state.myHand || [] : state.hands[app.viewerId] || [];
  const myNotes = app.live ? getLiveNotes(state) : state.notes[app.viewerId] || {};
  const currentRoom = me?.position.roomId || "study";
  const adjacent = ROOM_GRAPH[currentRoom] || [];
  const responderId = state.suggestion?.status === "waiting" ? state.suggestion.responderIds[state.suggestion.responderIndex] : null;
  const responder = state.players.find((player) => player.id === responderId);
  const responseCards = responderId === app.viewerId && state.suggestion ? myHand.filter((id) => [state.suggestion.suspectId, state.suggestion.weaponId, state.suggestion.roomId].includes(id)) : [];
  const allSuspects = ALL_CARDS.filter((item) => item.category === "suspect");
  const allWeapons = ALL_CARDS.filter((item) => item.category === "weapon");
  const allRooms = ROOM_IDS;
  const activeTab = app.tab;
  return `<div class="game-shell"><header class="game-header"><div class="brand-lockup compact"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><div class="header-room"><span>CASE FILE</span><button data-action="copy-room">${esc(state.roomCode)}<small>copy</small></button></div><div class="header-right">${!app.live ? `<label class="demo-switcher"><span>Playing as</span><select data-action="switch-player">${state.players.map((player) => `<option value="${player.id}" ${player.id === app.viewerId ? "selected" : ""}>${esc(player.name)}</option>`).join("")}</select></label>` : ""}<span class="connection-badge"><i class="status-dot ${app.live ? "live" : "demo"}"></i>${app.live ? "LIVE" : "DEMO"}</span><button class="icon-button" data-action="leave" aria-label="Leave room">↗</button></div></header><div class="game-content"><section class="map-column"><div class="game-title-row"><div><p class="eyebrow">The investigation / ${esc(state.roomName)}</p><h1>${state.phase === "won" ? "Case closed." : state.phase === "ended" ? "The trail goes cold." : "Find the missing truth."}</h1></div><span class="turn-counter">${state.phase === "playing" ? `TURN ${state.currentPlayerIndex + 1}` : state.phase.toUpperCase()}</span></div><div class="board-wrap"><div class="board-topline"><span>THE ESTATE FLOORPLAN</span><span><i class="legend-dot current"></i>you <i class="legend-dot other"></i>other detectives</span></div><div class="board-canvas"><div class="board-grid-lines"></div>${boardConnections()}${ROOM_IDS.map((roomId) => roomNode(state, roomId, currentRoom, adjacent, isMyTurn)).join("")}<div class="secret-passage passage-one">secret passage</div><div class="secret-passage passage-two">secret passage</div></div><div class="board-bottomline"><span><b>${roomName(currentRoom)}</b> / your current room</span><span>${isMyTurn && state.movesLeft > 0 ? `${state.movesLeft} move${state.movesLeft === 1 ? "" : "s"} left` : "Use the roll to move room to room"}</span></div></div><div class="turn-strip"><div class="turn-avatar player-${active?.color || "gold"}">${esc(active?.name?.slice(0, 1) || "?")}</div><div><span class="section-kicker">${isMyTurn ? "YOUR TURN" : "CURRENTLY INVESTIGATING"}</span><strong>${esc(active?.name || "Waiting")}<small>${isMyTurn ? state.movesLeft > 0 ? "Choose an adjacent room" : "Roll the die to begin" : "Watch the clues unfold"}</small></strong></div><div class="turn-actions">${isMyTurn && state.movesLeft === 0 ? `<button class="button dice-button" data-action="roll"><span>⚄</span> Roll ${state.lastRoll ? `again · ${state.lastRoll}` : "the die"}</button>` : ""}${isMyTurn && state.movesLeft === 0 && state.lastRoll !== null ? `<button class="button button-ghost" data-action="end-turn">End turn</button>` : ""}${isMyTurn && state.movesLeft > 0 ? `<button class="button button-ghost" data-action="end-turn">Finish movement</button>` : ""}</div></div></section><aside class="side-column"><div class="side-tabs"><button class="${activeTab === "case" ? "active" : ""}" data-tab="case">Case file</button><button class="${activeTab === "notes" ? "active" : ""}" data-tab="notes">Notes</button><button class="${activeTab === "chat" ? "active" : ""}" data-tab="chat">Chat <span>${state.messages.length}</span></button></div>${activeTab === "case" ? caseTab(state, me, myHand, isMyTurn) : activeTab === "notes" ? notesTab(myHand, myNotes) : chatTab(state)}</aside></div><div class="hand-drawer"><div class="hand-heading"><div><span class="section-kicker">YOUR PRIVATE EVIDENCE</span><h2>${esc(me?.name || "Your")}’s hand</h2></div><span>${myHand.length} cards / ${state.deckInfo.handSize} each</span></div><div class="hand-cards">${myHand.length ? myHand.map((id) => handCard(id, myNotes[id])).join("") : `<div class="empty-hand">Your cards will appear here when the case is sealed.</div>`}</div><div class="hand-tip"><span>i</span> Click a card to cycle its notebook mark. Notes are private to you.</div></div>${state.suggestion?.status === "waiting" ? suggestionBar(state, responder, responseCards) : ""}${app.modal === "suggest" ? selectionModal("suggest") : app.modal === "accuse" ? selectionModal("accuse") : ""}${globalOverlay()}</div>`;
}

function getLiveNotes(state) {
  const key = `clue-nexus-notes-${state.roomCode}-${app.viewerId}`;
  try { return JSON.parse(localStorage.getItem(key) || "{}") || state.myNotes || {}; } catch { return state.myNotes || {}; }
}

function boardConnections() {
  return ROOM_IDS.flatMap((from) => (ROOM_GRAPH[from] || []).filter((to) => ROOM_IDS.indexOf(to) > ROOM_IDS.indexOf(from)).map((to) => { const a = ROOM_META[from]; const b = ROOM_META[to]; const dx = b[3] - a[3]; const dy = b[4] - a[4]; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return `<span class="board-connection" style="left:${a[3]}%;top:${a[4]}%;width:${length}%;transform:rotate(${angle}deg)"></span>`; })).join("");
}

function roomNode(state, roomId, currentRoom, adjacent, isMyTurn) {
  const meta = ROOM_META[roomId]; const occupants = state.players.filter((player) => player.position.roomId === roomId); const canMove = isMyTurn && state.movesLeft > 0 && adjacent.includes(roomId);
  return `<button class="room-node room-${meta[5]} ${currentRoom === roomId ? "selected" : ""} ${canMove ? "can-move" : ""}" style="left:${meta[3]}%;top:${meta[4]}%" data-move-room="${roomId}"><span class="room-glyph">${meta[2]}</span><strong>${meta[0]}</strong><small>${meta[1]}</small><span class="occupants">${occupants.map((player) => `<i class="pawn pawn-${player.color} ${player.id === app.viewerId ? "you" : ""}" title="${esc(player.name)}">${esc(player.name.slice(0, 1))}</i>`).join("")}</span></button>`;
}

function caseTab(state, me, myHand, isMyTurn) {
  const suggestion = state.suggestion;
  return `<div class="side-tab-content case-tab"><div class="case-intro"><span class="case-icon">⌁</span><div><strong>Who did it?</strong><p>Three answers are hidden in the envelope. Every move narrows the field.</p></div></div><div class="quick-actions"><button class="action-card" ${!isMyTurn || suggestion?.status === "waiting" ? "disabled" : ""} data-modal="suggest"><span>◌</span><strong>Suggest</strong><small>Test a theory in your room</small></button><button class="action-card danger" ${!isMyTurn || suggestion?.status === "waiting" ? "disabled" : ""} data-modal="accuse"><span>✦</span><strong>Accuse</strong><small>Commit to your final answer</small></button></div>${suggestion ? `<div class="active-suggestion ${suggestion.status}"><span class="section-kicker">LAST SUGGESTION</span><strong>${cardName(suggestion.suspectId)}</strong><span>with the ${cardName(suggestion.weaponId)}</span><span>in the ${roomName(suggestion.roomId)}</span><small>${suggestion.status === "resolved" ? "A card was shown privately." : suggestion.status === "no-match" ? "No one could disprove it." : "Waiting for a response…"}</small></div>` : ""}<div class="case-stats"><div><span>cards held</span><strong>${myHand.length}</strong></div><div><span>your room</span><strong>${roomName(me?.position.roomId || "study")}</strong></div><div><span>detectives</span><strong>${state.players.filter((player) => !player.eliminated).length}</strong></div></div><div class="event-feed"><div class="feed-header"><span class="section-kicker">RECENT EVENTS</span><span>↗</span></div>${state.events.slice(0, 6).map((item) => `<div class="event-row event-${item.tone}"><i></i>${esc(item.text)}</div>`).join("")}</div>${isMyTurn && state.movesLeft === 0 ? `<button class="button button-full button-ghost end-turn-side" data-action="end-turn">End turn</button>` : ""}</div>`;
}

function notesTab(myHand, myNotes) {
  return `<div class="side-tab-content notes-tab"><div class="notes-intro"><span class="notebook-icon">☷</span><div><strong>Private notebook</strong><p>Mark what you know. These notes never leave your browser.</p></div></div>${["suspect", "room", "weapon"].map((category) => `<div class="notes-group"><span class="section-kicker">${category === "suspect" ? "PEOPLE" : category === "room" ? "PLACES" : "OBJECTS"}</span>${ALL_CARDS.filter((item) => item.category === category).map((item) => { const value = myNotes[item.id] || "unknown"; const display = value === "found" ? "●" : value === "maybe" ? "?" : value === "ruled-out" ? "×" : myHand.includes(item.id) ? "in hand" : ""; return `<button class="note-line note-${value}" data-note-card="${item.id}"><span class="mini-card-icon tone-${item.tone}">${item.glyph}</span><span>${item.name}</span><i>${display}</i></button>`; }).join("")}</div>`).join("")}</div>`;
}

function chatTab(state) {
  return `<div class="side-tab-content chat-tab"><div class="chat-intro"><span class="chat-icon">⌁</span><div><strong>Whispers</strong><p>Share observations. Or create reasonable doubt.</p></div></div>${state.settings.allowChat ? `<div class="message-list">${state.messages.length ? state.messages.map((message) => `<div class="message-row"><span class="message-avatar">${esc(message.playerName.slice(0, 1))}</span><div><strong>${esc(message.playerName)}</strong><p>${esc(message.text)}</p></div></div>`).join("") : `<div class="empty-chat">The room is quiet. Suspiciously quiet.</div>`}</div><form class="chat-form" id="chat-form"><input name="text" placeholder="Whisper something…" maxlength="240"><button aria-label="Send message">↑</button></form>` : `<div class="disabled-chat">Room chat is turned off by the host.</div>`}</div>`;
}

function handCard(id, note) { const item = card(id); if (!item) return ""; return `<button class="hand-card tone-${item.tone}" data-note-card="${item.id}"><span class="expansion-ribbon">${item.expansion ? "NEXUS" : "CLASSIC"}</span><span class="hand-card-glyph">${item.glyph}</span><strong>${item.name}</strong><small>${item.category}</small><span class="hand-card-mark">${note === "found" ? "●" : ""}</span></button>`; }

function suggestionBar(state, responder, responseCards) {
  const id = state.suggestion?.responderIds[state.suggestion.responderIndex];
  const responseChoices = responseCards.length
    ? responseCards.map((cardId) => `<button class="button button-primary" data-response="${cardId}">Show ${cardName(cardId)}</button>`).join("")
    : `<button class="button button-ghost" data-response="none">No matching card</button>`;
  return `<div class="suggestion-bar"><span class="suggestion-pulse"></span><div><strong>${id === app.viewerId ? "You must answer this suggestion." : `${esc(responder?.name || "Another detective")} is considering the suggestion.`}</strong><small>${cardName(state.suggestion.suspectId)} · ${roomName(state.suggestion.roomId)} · ${cardName(state.suggestion.weaponId)}</small></div>${id === app.viewerId ? `<div class="response-buttons">${responseChoices}</div>` : ""}</div>`;
}

function selectionModal(kind) {
  const suggest = kind === "suggest";
  const me = app.state.players.find((player) => player.id === app.viewerId);
  const room = me?.position.roomId || "study";
  return `<div class="modal-backdrop" data-action="close-modal"><div class="selection-modal" data-modal-panel><button class="modal-close" data-action="close-modal">×</button><span class="modal-sigil">✦</span><p class="eyebrow">A theory takes shape</p><h2>${suggest ? `Suggest in the ${roomName(room)}` : "Make a final accusation"}</h2><p class="modal-subtitle">${suggest ? "Choose one suspect and one weapon. The room is set by your location." : "One chance. Check your notes before you commit."}</p><label><span>Person</span><select id="modal-suspect">${ALL_CARDS.filter((item) => item.category === "suspect").map((item) => `<option value="${item.id}">${item.name}</option>`).join("")}</select></label>${suggest ? "" : `<label><span>Place</span><select id="modal-room">${ROOM_IDS.map((id) => `<option value="${id}" ${id === room ? "selected" : ""}>${roomName(id)}</option>`).join("")}</select></label>`}<label><span>Object</span><select id="modal-weapon">${ALL_CARDS.filter((item) => item.category === "weapon").map((item) => `<option value="${item.id}">${item.name}</option>`).join("")}</select></label><button class="button button-primary button-full" data-action="confirm-${kind}">${suggest ? "Make suggestion" : "Accuse"} →</button></div></div>`;
}

function globalOverlay() {
  return `${app.error ? `<div class="global-error"><span>!</span>${esc(app.error)}<button data-action="clear-error">×</button></div>` : ""}${app.notice ? `<div class="toast"><span>✦</span>${esc(app.notice)}</div>` : ""}`;
}

function flash(message) {
  app.notice = message;
  render();
  window.setTimeout(() => { if (app.notice === message) { app.notice = ""; render(); } }, 2800);
}

function noteValue(cardId) {
  const state = app.state;
  if (!state) return "unknown";
  const notes = app.live ? getLiveNotes(state) : state.notes[app.viewerId] || {};
  return notes[cardId] || "unknown";
}

function nextNote(cardId) {
  const current = noteValue(cardId);
  const hand = app.live ? stateHand(app.state) : app.state.hands[app.viewerId] || [];
  if (hand.includes(cardId)) return current === "found" ? "unknown" : "found";
  if (current === "unknown") return "maybe";
  if (current === "maybe") return "ruled-out";
  return "unknown";
}

function stateHand(state) { return state && app.live ? state.myHand || [] : state?.hands?.[app.viewerId] || []; }

function changeNote(cardId) {
  const value = nextNote(cardId);
  if (app.live) {
    const key = `clue-nexus-notes-${app.state.roomCode}-${app.viewerId}`;
    const next = { ...getLiveNotes(app.state) };
    if (value === "unknown") delete next[cardId]; else next[cardId] = value;
    localStorage.setItem(key, JSON.stringify(next));
    app.state.myNotes = next;
    render();
  } else {
    performLocal((state) => setNote(state, app.viewerId, cardId, value));
  }
}

root.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const screenButton = target.closest("[data-screen]");
  if (screenButton) {
    app.screen = screenButton.dataset.screen;
    app.error = "";
    render();
    return;
  }

  const tab = target.closest("[data-tab]");
  if (tab) { app.tab = tab.dataset.tab; render(); return; }

  const note = target.closest("[data-note-card]");
  if (note) { changeNote(note.dataset.noteCard); return; }

  const tileButton = target.closest("[data-move-tile]");
  if (tileButton && !tileButton.disabled) {
    act("move", { destination: Number(tileButton.dataset.moveTile) }, (state) => move(state, app.viewerId, Number(tileButton.dataset.moveTile)));
    return;
  }

  const moveButton = target.closest("[data-move-room]");
  if (moveButton && !moveButton.disabled) {
    act("move", { destination: moveButton.dataset.moveRoom }, (state) => move(state, app.viewerId, moveButton.dataset.moveRoom));
    return;
  }

  const response = target.closest("[data-response]");
  if (response) {
    const cardId = response.dataset.response === "none" ? null : response.dataset.response;
    act("respond", { cardId }, (state) => respond(state, app.viewerId, cardId));
    return;
  }

  const modalButton = target.closest("[data-modal]");
  if (modalButton) { app.modal = modalButton.dataset.modal; render(); return; }

  if (target.classList.contains("modal-backdrop") || target.closest(".modal-close")) { app.modal = null; render(); return; }

  const action = target.closest("[data-action]");
  if (!action) return;
  switch (action.dataset.action) {
    case "leave": leaveRoom(); break;
    case "copy-room": navigator.clipboard?.writeText(app.state.roomCode).then(() => flash("Room code copied to your clipboard.")); break;
    case "clear-error": app.error = ""; render(); break;
    case "ready": act("ready", {}, (state) => toggleReady(state, app.viewerId)); break;
    case "start": act("start", {}, (state) => startGame(state)); break;
    case "roll": act("roll", {}, (state) => roll(state, app.viewerId)); break;
    case "finish-movement": act("finish_movement", {}, (state) => finishMovement(state, app.viewerId)); break;
    case "end-turn": act("end_turn", {}, (state) => endTurn(state, app.viewerId)); break;
    case "setting": {
      const key = action.dataset.key;
      const value = action.dataset.value === "true";
      act("settings", { settings: { [key]: value } }, (state) => updateSettings(state, { [key]: value }));
      break;
    }
    case "confirm-suggest": {
      const suspectId = document.getElementById("modal-suspect")?.value;
      const weaponId = document.getElementById("modal-weapon")?.value;
      app.modal = null;
      act("suggest", { suspectId, weaponId }, (state) => makeSuggestion(state, app.viewerId, suspectId, weaponId), true);
      break;
    }
    case "confirm-accuse": {
      const suspectId = document.getElementById("modal-suspect")?.value;
      const weaponId = document.getElementById("modal-weapon")?.value;
      const roomId = document.getElementById("modal-room")?.value;
      app.modal = null;
      act("accuse", { suspectId, weaponId, roomId }, (state) => accuse(state, app.viewerId, suspectId, weaponId, roomId));
      break;
    }
    default: break;
  }
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.action === "switch-player") { app.viewerId = target.value; render(); }
});

root.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const data = new FormData(form);
  if (form.id === "chat-form") {
    act("chat", { text: data.get("text") }, (state) => addChat(state, app.viewerId, data.get("text")));
    return;
  }
  app.loading = true; app.error = ""; render();
  try {
    if (form.id === "create-form") {
      const characterId = String(data.get("characterId") || "").trim();
      const roomNameValue = String(data.get("roomName") || "The Moonlit Estate").trim();
      if (LIVE_CONFIGURED) await enterLive(await liveCall({ type: "create", roomName: roomNameValue, characterId }));
      else enterDemo(localDemo(characterId, roomNameValue), "Demo table opened. Connect Supabase for real friends.");
    } else if (form.id === "join-form") {
      const characterId = String(data.get("characterId") || "").trim();
      const roomCode = String(data.get("roomCode") || "").trim().toUpperCase();
      if (LIVE_CONFIGURED) await enterLive(await liveCall({ type: "join", roomCode, characterId }));
      else if (roomCode === "DEMO42") enterDemo(localDemo(characterId, "The Moonlit Estate"), "Demo table entered.");
      else throw new Error("Demo mode only has room DEMO42. Add Supabase keys for live room codes.");
    }
  } catch (error) {
    app.error = error instanceof Error ? error.message : "The room could not be opened.";
  } finally {
    app.loading = false;
    render();
  }
});

// Keep the name field in both live setup flows.
setupView = function (kind) {
  const create = kind === "create";
  return `<main class="setup-shell"><div class="setup-panel"><button class="back-link" data-screen="home">← Back to the foyer</button><div class="setup-heading"><div class="brand-lockup"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><p class="eyebrow">${create ? "Open a new case" : "Step into an open case"}</p><h1>${create ? "Set the table." : "What’s the room code?"}</h1><p>${create ? "Pick your detective name and a mansion for the case." : "Enter the code your host shared."}</p></div><form class="setup-form" id="${create ? "create-form" : "join-form"}"><label><span>Your detective name</span><input name="displayName" autofocus placeholder="e.g. Detective Mark" maxlength="22" required></label>${create ? `<label><span>Mansion name <small>optional</small></span><input name="roomName" value="The Moonlit Estate" maxlength="36"></label>` : `<label><span>Room code</span><input class="code-input" name="roomCode" placeholder="A7K2QF" maxlength="6" required></label>`}${app.error ? `<div class="error-banner">${esc(app.error)}</div>` : ""}<button class="button button-primary button-full" type="submit" ${app.loading ? "disabled" : ""}>${app.loading ? "Opening…" : create ? "Create the room →" : "Join the room →"}</button></form><div class="setup-note"><span>✦</span>${LIVE_CONFIGURED ? "Live multiplayer is ready." : "Demo mode is active until Supabase is connected."}</div></div><aside class="setup-aside"><div class="aside-quote">“The truth is hidden in plain sight.”</div><div class="aside-moon"></div><div class="aside-lines"><span></span><span></span><span></span></div><div class="aside-detail"><b>02—07</b><span>players per case</span></div></aside></main>`;
};

function characterSetupView(kind) {
  const create = kind === "create";
  const characterChoices = CHARACTER_OPTIONS.map((character) => `<option value="${character.id}">${character.glyph} ${character.name} · ${character.color}</option>`).join("");
  return `<main class="setup-shell"><div class="setup-panel"><button class="back-link" data-screen="home">← Back to the foyer</button><div class="setup-heading"><div class="brand-lockup"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><p class="eyebrow">${create ? "Open a new case" : "Step into an open case"}</p><h1>${create ? "Set the table." : "What’s the room code?"}</h1><p>${create ? "Choose your suspect. Your name and color come with the character." : "Enter the code your host shared, then choose the suspect you will play."}</p></div><form class="setup-form" id="${create ? "create-form" : "join-form"}"><label><span>Your suspect</span><select name="characterId" autofocus required>${characterChoices}</select></label>${create ? `<label><span>Mansion name <small>optional</small></span><input name="roomName" value="The Moonlit Estate" maxlength="36"></label>` : `<label><span>Room code</span><input class="code-input" name="roomCode" placeholder="A7K2QF" maxlength="6" required></label>`}${app.error ? `<div class="error-banner">${esc(app.error)}</div>` : ""}<button class="button button-primary button-full" type="submit" ${app.loading ? "disabled" : ""}>${app.loading ? "Opening…" : create ? "Create the room →" : "Join the room →"}</button></form><div class="setup-note"><span>✦</span>${LIVE_CONFIGURED ? "Live multiplayer is ready." : "Demo mode is active until Supabase is connected."}</div></div><aside class="setup-aside"><div class="aside-quote">“The truth is hidden in plain sight.”</div><div class="aside-moon"></div><div class="aside-lines"><span></span><span></span><span></span></div><div class="aside-detail"><b>02—07</b><span>players per case</span></div></aside></main>`;
}
setupView = characterSetupView;

function tileConnectionsMarkup() {
  return BOARD_CONNECTIONS.map((connection) => {
    const from = BOARD_TILES[connection.from];
    const to = BOARD_TILES[connection.to];
    if (!from || !to) return "";
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return `<span class="tile-connection ${connection.secret ? "secret" : ""}" title="${connection.secret ? "Secret passage" : "Corridor"}" style="left:${from.x}%;top:${from.y}%;width:${length}%;transform:rotate(${angle}deg)"></span>`;
  }).join("");
}

function boardTileMarkup(state, tile, reachable, isMyTurn) {
  const occupants = state.players.filter((player) => playerTileIndex(player) === tile.id);
  const distance = reachable.get(tile.id);
  const canMove = isMyTurn && Number.isInteger(distance) && distance > 0 && distance <= state.movesLeft;
  const meta = tile.roomId ? ROOM_META[tile.roomId] : null;
  const label = tile.isRoom && meta ? meta[0] : `Board space ${tile.id + 1}`;
  return `<button class="board-tile ${tile.isRoom ? "room-tile" : "path-tile"} ${meta ? `tile-${meta[5]}` : ""} ${canMove ? "reachable" : ""} ${occupants.some((player) => player.id === app.viewerId) ? "current" : ""}" style="left:${tile.x}%;top:${tile.y}%" data-move-tile="${tile.id}" ${canMove ? "" : "disabled"} aria-label="${esc(label)}${canMove ? `, move ${distance} spaces` : ""}"><span class="tile-mark">${meta ? meta[2] : tile.id + 1}</span>${meta ? `<strong>${esc(meta[0])}</strong>` : ""}<span class="tile-occupants">${occupants.map((player) => `<i class="board-pawn pawn-${player.color} ${player.id === app.viewerId ? "you" : ""}" title="${esc(player.name)}">${esc(player.name.slice(0, 1))}</i>`).join("")}</span></button>`;
}

function compactHandCard(id, note) {
  const item = card(id);
  if (!item) return "";
  return `<button class="compact-hand-card tone-${item.tone}" data-note-card="${item.id}" title="Click to mark this card"><span>${item.glyph}</span><strong>${esc(item.name)}</strong><small>${note === "found" ? "in your hand" : item.category}</small></button>`;
}

function cleanPlayerRows(state) {
  return state.players.map((player) => `<div class="clean-player-row player-${player.color}"><span class="clean-player-dot"></span><span class="clean-player-name">${esc(player.name)}${player.id === app.viewerId ? " <em>you</em>" : ""}</span>${player.id === state.players[state.currentPlayerIndex]?.id ? `<span class="clean-turn-label">TURN</span>` : ""}${player.isHost ? `<span class="clean-host-label">HOST</span>` : ""}</div>`).join("");
}

function cleanEventRows(state) {
  return state.events.slice(0, 5).map((item) => `<div class="clean-event-row"><i class="event-${item.tone}"></i><span>${esc(item.text)}</span></div>`).join("");
}

function rememberShownCard(state) {
  const suggestion = state?.suggestion;
  const latestShown = [...(state?.suggestionHistory || [])].reverse().find((entry) => entry.shownToPlayerId === app.viewerId && entry.shownCardId);
  const cardId = suggestion?.shownToPlayerId === app.viewerId ? suggestion.shownCardId : latestShown?.shownCardId;
  if (!state || !cardId) return;
  if (app.live) {
    const key = `clue-nexus-notes-${state.roomCode}-${app.viewerId}`;
    const notes = getLiveNotes(state);
    if (notes[cardId] === "found") return;
    const next = { ...notes, [cardId]: "found" };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Notes still show in this render. */ }
    state.myNotes = next;
  } else {
    state.notes = { ...(state.notes || {}), [app.viewerId]: { ...(state.notes?.[app.viewerId] || {}), [cardId]: "found" } };
  }
}

function cleanSuggestionRows(state) {
  const history = (state.suggestionHistory || []).slice(-6).reverse();
  if (!history.length) return `<div class="clean-empty">Suggestions you make will be recorded here.</div>`;
  return history.map((entry) => {
    const privateCard = entry.shownToPlayerId === app.viewerId && entry.shownCardId;
    const result = entry.result === "no-match" ? "No matching card was shown" : privateCard ? `You were shown: ${cardName(entry.shownCardId)}` : "A card was shown privately";
    return `<div class="clean-history-row"><div><strong>${esc(cardName(entry.suspectId))}</strong><span>with ${esc(cardName(entry.weaponId))} · ${esc(roomName(entry.roomId))}</span></div><small class="${privateCard ? "revealed-card" : ""}">${esc(result)}</small></div>`;
  }).join("");
}

gameView = function (state) {
  const me = state.players.find((player) => player.id === app.viewerId);
  const active = state.players[state.currentPlayerIndex];
  const isMyTurn = active?.id === app.viewerId && !me?.eliminated;
  const myHand = app.live ? state.myHand || [] : state.hands[app.viewerId] || [];
  const myNotes = app.live ? getLiveNotes(state) : state.notes[app.viewerId] || {};
  const currentTile = playerTileIndex(me || {}, state.players.indexOf(me));
  const reachable = isMyTurn && state.movesLeft > 0 ? reachableTileDistances(currentTile, state.movesLeft) : new Map();
  const responderId = state.suggestion?.status === "waiting" ? state.suggestion.responderIds[state.suggestion.responderIndex] : null;
  const responder = state.players.find((player) => player.id === responderId);
  const responseCards = responderId === app.viewerId && state.suggestion ? myHand.filter((id) => [state.suggestion.suspectId, state.suggestion.weaponId, state.suggestion.roomId].includes(id)) : [];
  const canAct = isMyTurn && state.suggestion?.status !== "waiting";
  const canFinish = canAct && state.movesLeft > 0;
  const canEnd = canAct && state.movesLeft === 0 && state.lastRoll !== null;
  const currentRoom = me?.position?.roomId || "study";
  const phaseTitle = state.phase === "won" ? "Case closed." : state.phase === "ended" ? "The trail went cold." : "Find the missing truth.";
  return `<div class="game-shell clean-game"><header class="game-header clean-header"><div class="brand-lockup compact"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><div class="header-room"><span>ROOM</span><button data-action="copy-room">${esc(state.roomCode)}<small>copy</small></button></div><div class="header-right">${!app.live ? `<label class="demo-switcher"><span>Playing as</span><select data-action="switch-player">${state.players.map((player) => `<option value="${player.id}" ${player.id === app.viewerId ? "selected" : ""}>${esc(player.name)}</option>`).join("")}</select></label>` : ""}<span class="connection-badge"><i class="status-dot ${app.live ? "live" : "demo"}"></i>${app.live ? "LIVE" : "DEMO"}</span><button class="icon-button" data-action="leave" aria-label="Leave room">↗</button></div></header><main class="clean-game-layout"><section class="clean-board-column"><div class="clean-title-row"><div><p class="eyebrow">${esc(state.roomName)}</p><h1>${phaseTitle}</h1></div><div class="clean-turn-summary"><span>${active ? `${esc(active.name)}'s turn` : "Waiting"}</span><strong>${isMyTurn ? (state.movesLeft ? `${state.movesLeft} spaces left` : "Roll to move") : state.phase.toUpperCase()}</strong></div></div><div class="tile-board-card"><div class="tile-board-top"><span>THE ESTATE BOARD</span><span>${me ? `${esc(roomName(currentRoom))} · space ${currentTile + 1}` : "Waiting for detectives"}</span></div><div class="tile-board"><div class="tile-board-grid"></div>${tileConnectionsMarkup()}${BOARD_TILES.map((tile) => boardTileMarkup(state, tile, reachable, isMyTurn)).join("")}<div class="board-center-card"><span>CASE BOARD</span><strong>${esc(roomName(currentRoom))}</strong><small>${isMyTurn ? state.movesLeft > 0 ? "Choose a highlighted tile" : "Roll the die to begin" : `Watching ${esc(active?.name || "the table")}`}</small></div></div><div class="tile-board-bottom"><span>Roll first, then choose a highlighted tile.</span><span>${state.lastRoll ? `Last roll: ${state.lastRoll}` : "No roll yet"}</span></div></div><div class="clean-action-bar"><button class="button dice-button clean-action-roll" data-action="roll" ${canAct && state.movesLeft === 0 && state.lastRoll === null ? "" : "disabled"}><span>⚄</span>Roll</button><button class="button button-ghost" data-action="finish-movement" ${canFinish ? "" : "disabled"}>Finish movement</button><button class="button button-ghost" data-action="end-turn" ${canEnd ? "" : "disabled"}>End turn</button><span class="clean-action-divider"></span><button class="button button-ghost" data-modal="suggest" ${canAct ? "" : "disabled"}>Make a guess</button><button class="button button-danger" data-modal="accuse" ${canAct ? "" : "disabled"}>Accuse</button></div>${state.suggestion?.status === "waiting" ? suggestionBar(state, responder, responseCards) : ""}</section><aside class="clean-sidebar"><section class="clean-side-card clean-turn-card"><div class="clean-card-heading"><span class="section-kicker">CURRENT TURN</span><span class="clean-roll-badge">${state.movesLeft ? `${state.movesLeft} left` : state.lastRoll ? `rolled ${state.lastRoll}` : "ready"}</span></div><div class="clean-current-player"><span class="turn-avatar player-${active?.color || "gold"}">${esc(active?.name?.slice(0, 1) || "?")}</span><div><strong>${esc(active?.name || "Waiting")}</strong><small>${isMyTurn ? "This is your turn" : "Watch the board"}</small></div></div></section><section class="clean-side-card"><div class="clean-card-heading"><span class="section-kicker">DETECTIVES</span><span class="clean-count">${state.players.length}/7</span></div><div class="clean-player-list">${cleanPlayerRows(state)}</div></section><section class="clean-side-card clean-hand-panel"><div class="clean-card-heading"><span class="section-kicker">YOUR CARDS</span><span class="clean-count">${myHand.length}</span></div><div class="compact-hand">${myHand.length ? myHand.map((id) => compactHandCard(id, myNotes[id])).join("") : `<span class="clean-empty">Cards arrive when the case starts.</span>`}</div></section><section class="clean-side-card clean-activity"><div class="clean-card-heading"><span class="section-kicker">CASE LOG</span></div><div class="clean-event-list">${cleanEventRows(state)}</div>${state.settings.allowChat ? `<form class="chat-form clean-chat-form" id="chat-form"><input name="text" placeholder="Say something suspicious…" maxlength="240"><button aria-label="Send message">↑</button></form>` : ""}</section></aside></main>${app.modal === "suggest" ? selectionModal("suggest") : app.modal === "accuse" ? selectionModal("accuse") : ""}${globalOverlay()}</div>`;
};

function cleanGameView(state) {
  const settings = { ...DEFAULT_RULES, ...(state.settings || {}) };
  const me = state.players.find((player) => player.id === app.viewerId);
  const active = state.players[state.currentPlayerIndex];
  const isMyTurn = active?.id === app.viewerId && !me?.eliminated;
  const myHand = app.live ? state.myHand || [] : state.hands?.[app.viewerId] || [];
  const myNotes = app.live ? getLiveNotes(state) : state.notes?.[app.viewerId] || {};
  const currentTile = playerTileIndex(me || {}, state.players.indexOf(me));
  const currentTileInfo = BOARD_TILES[currentTile];
  const inRoom = Boolean(me && currentTileInfo?.isRoom && me.position?.inRoom !== false);
  const currentRoom = me?.position?.roomId || currentTileInfo?.roomId || "study";
  const reachable = isMyTurn && state.movesLeft > 0 ? reachableTileDistances(currentTile, state.movesLeft) : new Map();
  const responderId = state.suggestion?.status === "waiting" ? state.suggestion.responderIds[state.suggestion.responderIndex] : null;
  const responder = state.players.find((player) => player.id === responderId);
  const responseCards = responderId === app.viewerId && state.suggestion ? myHand.filter((id) => [state.suggestion.suspectId, state.suggestion.weaponId, state.suggestion.roomId].includes(id)) : [];
  const canAct = isMyTurn && state.suggestion?.status !== "waiting";
  const sameRoomBlocked = canAct && settings.noRepeatRoomSuggestions !== false && state.lastSuggestionRoomByPlayer?.[app.viewerId] === currentRoom;
  const canSuggest = canAct && inRoom && !sameRoomBlocked;
  const canAccuse = canAct && (settings.finalAccusationAnytime || inRoom);
  const canFinish = canAct && state.movesLeft > 0;
  const canEnd = canAct && state.movesLeft === 0 && state.lastRoll !== null;
  const phaseTitle = state.phase === "won" ? "Case closed." : state.phase === "ended" ? "The trail went cold." : "Find the missing truth.";
  const locationText = inRoom ? roomName(currentRoom) : "Hallway";
  const actionHint = sameRoomBlocked ? "Enter a different room before making another guess." : !inRoom && isMyTurn ? "Enter a room to make a guess." : "Roll first, then choose a highlighted tile.";
  return `<div class="game-shell clean-game"><header class="game-header clean-header"><div class="brand-lockup compact"><span class="brand-mark">✦</span><span>CLUE <em>NEXUS</em></span></div><div class="header-room"><span>ROOM</span><button data-action="copy-room">${esc(state.roomCode)}<small>copy</small></button></div><div class="header-right">${!app.live ? `<label class="demo-switcher"><span>Playing as</span><select data-action="switch-player">${state.players.map((player) => `<option value="${player.id}" ${player.id === app.viewerId ? "selected" : ""}>${esc(player.name)}</option>`).join("")}</select></label>` : ""}<span class="connection-badge"><i class="status-dot ${app.live ? "live" : "demo"}"></i>${app.live ? "LIVE" : "DEMO"}</span><button class="icon-button" data-action="leave" aria-label="Leave room">↗</button></div></header><main class="clean-game-layout"><section class="clean-board-column"><div class="clean-title-row"><div><p class="eyebrow">${esc(state.roomName)}</p><h1>${phaseTitle}</h1></div><div class="clean-turn-summary"><span>${active ? `${esc(active.name)}'s turn` : "Waiting"}</span><strong>${isMyTurn ? (state.movesLeft ? `${state.movesLeft} spaces left` : "Roll to move") : state.phase.toUpperCase()}</strong></div></div><div class="tile-board-card"><div class="tile-board-top"><span>THE ESTATE BOARD</span><span>${me ? `${esc(locationText)} · space ${currentTile + 1}` : "Waiting for detectives"}</span></div><div class="tile-board"><div class="tile-board-grid"></div>${tileConnectionsMarkup()}${BOARD_TILES.map((tile) => boardTileMarkup(state, tile, reachable, isMyTurn)).join("")}<div class="board-center-card"><span>CASE BOARD</span><strong>${esc(locationText)}</strong><small>${isMyTurn ? state.movesLeft > 0 ? "Choose a highlighted tile" : "Roll the die to begin" : `Watching ${esc(active?.name || "the table")}`}</small></div><div class="secret-board-note">Dashed links are secret passages</div></div><div class="tile-board-bottom"><span>${actionHint}</span><span>${state.lastRoll ? `Last roll: ${state.lastRoll}` : "No roll yet"}</span></div></div><div class="clean-action-bar"><button class="button dice-button clean-action-roll" data-action="roll" ${canAct && state.movesLeft === 0 && state.lastRoll === null ? "" : "disabled"}><span>⚄</span>Roll</button><button class="button button-ghost" data-action="finish-movement" ${canFinish ? "" : "disabled"}>Finish movement</button><button class="button button-ghost" data-action="end-turn" ${canEnd ? "" : "disabled"}>End turn</button><span class="clean-action-divider"></span><button class="button button-ghost" data-modal="suggest" ${canSuggest ? "" : "disabled"}>Make a guess</button><button class="button button-danger" data-modal="accuse" ${canAccuse ? "" : "disabled"}>Accuse</button></div>${state.suggestion?.status === "waiting" ? suggestionBar(state, responder, responseCards) : ""}</section><aside class="clean-sidebar"><section class="clean-side-card clean-turn-card"><div class="clean-card-heading"><span class="section-kicker">CURRENT TURN</span><span class="clean-roll-badge">${state.movesLeft ? `${state.movesLeft} left` : state.lastRoll ? `rolled ${state.lastRoll}` : "ready"}</span></div><div class="clean-current-player"><span class="turn-avatar player-${active?.color || "gold"}">${esc(active?.name?.slice(0, 1) || "?")}</span><div><strong>${esc(active?.name || "Waiting")}</strong><small>${isMyTurn ? "This is your turn" : "Watch the board"}</small></div></div></section><section class="clean-side-card"><div class="clean-card-heading"><span class="section-kicker">DETECTIVES</span><span class="clean-count">${state.players.length}/7</span></div><div class="clean-player-list">${cleanPlayerRows(state)}</div></section><section class="clean-side-card clean-history-card"><div class="clean-card-heading"><span class="section-kicker">SUGGESTION NOTES</span><span class="clean-count">${(state.suggestionHistory || []).length}</span></div><div class="clean-history-list">${cleanSuggestionRows(state)}</div></section><section class="clean-side-card clean-hand-panel"><div class="clean-card-heading"><span class="section-kicker">YOUR CARDS</span><span class="clean-count">${myHand.length}</span></div><div class="compact-hand">${myHand.length ? myHand.map((id) => compactHandCard(id, myNotes[id])).join("") : `<span class="clean-empty">Cards arrive when the case starts.</span>`}</div></section><section class="clean-side-card clean-activity"><div class="clean-card-heading"><span class="section-kicker">CASE LOG</span></div><div class="clean-event-list">${cleanEventRows(state)}</div>${settings.allowChat !== false ? `<form class="chat-form clean-chat-form" id="chat-form"><input name="text" placeholder="Say something suspicious…" maxlength="240"><button aria-label="Send message">↑</button></form>` : ""}</section></aside></main>${app.modal === "suggest" ? selectionModal("suggest") : app.modal === "accuse" ? selectionModal("accuse") : ""}${globalOverlay()}</div>`;
}

gameView = cleanGameView;

lobbyView = function updatedLobbyView(state) {
  const me = state.players.find((player) => player.id === app.viewerId);
  const host = state.hostId === app.viewerId;
  const settings = { ...DEFAULT_RULES, ...(state.settings || {}) };
  const deck = cardsForPlayers(state.players.length, settings.expansionCards);
  return `<div class="lobby-page"><div class="lobby-hero"><div><p class="eyebrow">The guest list is forming</p><h1>${esc(state.roomName)}</h1><p class="lobby-subtitle">Choose a suspect, share the room code, and let the accusations begin.</p></div><div class="room-code-card"><span>ROOM CODE</span><strong>${esc(state.roomCode)}</strong><small>Share this code with the other detectives</small></div></div><div class="lobby-grid"><section class="panel players-panel"><div class="panel-heading"><div><span class="section-kicker">01 / THE GUESTS</span><h2>Choose your suspect.</h2></div><span class="count-badge">${state.players.length} / 7</span></div><div class="player-list">${state.players.map((player, index) => { const character = characterFor(player.characterId, index, player.name); return `<div class="lobby-player player-${character.color}"><div class="player-avatar">${character.glyph}</div><div class="player-meta"><strong>${esc(character.name)}${player.id === app.viewerId ? " (you)" : ""}</strong><span>${player.isHost ? "Host / case owner" : player.ready ? "Ready to investigate" : "Choosing a seat"}</span></div>${player.isHost ? "<span class=\"host-tag\">HOST</span>" : ""}<span class="ready-light ${player.ready ? "ready" : ""}"></span></div>`; }).join("")}${state.players.length < 7 ? `<div class="empty-seat"><span>＋</span><div><strong>Invite another detective</strong><small>${app.live ? "Send them the room code" : "Connect Supabase for live friends"}</small></div></div>` : ""}</div><div class="panel-footer player-footer"><span><i class="status-dot ${app.live ? "live" : "demo"}"></i>${app.live ? "Live room" : "Local demo table"}</span><button class="button button-subtle" data-action="leave">Leave room</button></div></section><section class="panel rules-panel"><div class="panel-heading"><div><span class="section-kicker">02 / THE HOUSE RULES</span><h2>Make it yours.</h2></div><span class="wax-seal">✦</span></div><div class="rules-list">${ruleRow("Balanced deck", `${deck.handSize} cards per detective`, settings.balancedDeck, !host, "balancedDeck")}${ruleRow("Nexus expansion", `${deck.expansionCards.length} new card${deck.expansionCards.length === 1 ? "" : "s"} at this table`, settings.expansionCards, !host, "expansionCards")}${ruleRow("Accuse anytime", "A final accusation is not limited to your room", settings.finalAccusationAnytime, !host, "finalAccusationAnytime")}${ruleRow("No same-room repeats", "Require a different room for each consecutive guess", settings.noRepeatRoomSuggestions, !host, "noRepeatRoomSuggestions")}${ruleRow("Move suggested suspect", "Bring the named suspect into the room after a guess", settings.moveSuggestedCharacter, !host, "moveSuggestedCharacter")}${ruleRow("Room chat", "A shared channel for suspicious observations", settings.allowChat, !host, "allowChat")}</div><div class="deck-preview"><span class="deck-preview-icon">▤</span><div><strong>${state.players.length < 2 ? "Waiting for another player" : `${state.players.length} detectives, ${state.players.length * deck.handSize + 3} cards in play`}</strong><small>Dashed board links are secret passages. The host can change these rules before starting.</small></div></div></section></div><div class="lobby-bottom-bar"><div class="ready-callout"><span class="ready-ring"></span>${me?.ready ? "You’re ready. Waiting for the host." : host ? "You’re the host. Start when everyone is ready." : "Mark yourself ready when you’re set."}</div><div class="lobby-actions">${!host ? `<button class="button ${me?.ready ? "button-ghost" : "button-primary"}" data-action="ready">${me?.ready ? "Unready" : "I’m ready →"}</button>` : `<button class="button button-primary" ${state.players.length < 2 ? "disabled" : ""} data-action="start">${state.players.length < 2 ? "Waiting for a second player" : "Seal the case →"}</button>`}</div></div>${globalOverlay()}</div>`;
};

async function restoreLiveRoom() {
  if (!LIVE_CONFIGURED) return;
  let savedRoom;
  try { savedRoom = JSON.parse(localStorage.getItem(LIVE_ROOM_STORAGE_KEY) || "null"); } catch { savedRoom = null; }
  const roomCode = String(savedRoom?.roomCode || "").trim().toUpperCase();
  if (!roomCode) return;

  app.live = true;
  app.liveRoomCode = roomCode;
  try {
    const result = await liveCall({ type: "get", roomCode });
    app.state = result.state;
    app.viewerId = result.state.myPlayerId || "";
    rememberShownCard(app.state);
    app.screen = "home";
    app.error = "";
    app.notice = `Reconnected to room ${roomCode}.`;
    render();
    await subscribeLive(roomCode);
  } catch {
    stopLiveUpdates();
    forgetLiveRoom();
    app.live = false;
    app.state = null;
    app.viewerId = "";
    app.error = "We could not reconnect to that room. Join again with the room code.";
    app.screen = "join";
    render();
  }
}

render();
void restoreLiveRoom();
