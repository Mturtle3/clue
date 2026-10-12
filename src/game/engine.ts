import { BASE_CARDS, cardsForPlayerCount, getCard } from "./cards.ts";
import { ROOM_GRAPH, ROOM_IDS, roomName } from "./board.ts";
import type {
  CardCategory,
  ChatMessage,
  GameEvent,
  GameState,
  Player,
  PlayerColor,
  RoomId,
  RuleSettings,
  Suggestion,
} from "./types.ts";
import { DEFAULT_RULES, PLAYER_COLORS } from "./types.ts";

const now = () => Date.now();

export function makeId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function event(text: string, tone: GameEvent["tone"] = "slate"): GameEvent {
  return { id: makeId("event"), text, tone, timestamp: now() };
}

function activePlayers(state: GameState): Player[] {
  return state.players.filter((player) => !player.eliminated);
}

function currentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}

function findNextActiveIndex(state: GameState, fromIndex: number): number {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    if (!state.players[index].eliminated) return index;
  }
  return fromIndex;
}

function cardIdsForCategory(category: CardCategory, cards: string[]): string[] {
  return cards.filter((id) => getCard(id)?.category === category);
}

function makeSolutionAndHands(playerIds: string[], allCardIds: string[]): { solution: string[]; hands: Record<string, string[]> } {
  const byCategory = (category: CardCategory) => allCardIds.filter((id) => getCard(id)?.category === category);
  const solution = [pick(byCategory("suspect")), pick(byCategory("room")), pick(byCategory("weapon"))];
  const dealt = shuffle(allCardIds.filter((id) => !solution.includes(id)));
  const hands: Record<string, string[]> = Object.fromEntries(playerIds.map((id) => [id, []]));
  dealt.forEach((cardId, index) => {
    hands[playerIds[index % playerIds.length]].push(cardId);
  });
  return { solution, hands };
}

export function buildPlayers(
  entries: Array<{ id?: string; name: string; color?: PlayerColor }>,
  hostId?: string,
): Player[] {
  const players = entries.map((entry, index) => ({
    id: entry.id ?? makeId("player"),
    name: entry.name.trim().slice(0, 22) || `Guest ${index + 1}`,
    color: entry.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length],
    isHost: false,
    isConnected: true,
    ready: false,
    eliminated: false,
    position: { roomId: ROOM_IDS[index % ROOM_IDS.length], step: 0 },
    cardCount: 0,
  } satisfies Player));
  const actualHost = hostId ?? players[0]?.id;
  return players.map((player) => ({ ...player, isHost: player.id === actualHost }));
}

export function createGame(
  roomCode: string,
  roomName: string,
  playerEntries: Array<{ id?: string; name: string; color?: PlayerColor }>,
  settings: RuleSettings = DEFAULT_RULES,
): GameState {
  const players = buildPlayers(playerEntries);
  const pool = cardsForPlayerCount(players.length, settings.expansionCards);
  const dealt = makeSolutionAndHands(players.map((player) => player.id), pool.cards.map((card) => card.id));
  const deckInfo = {
    handSize: pool.handSize,
    expansionCards: pool.expansionCards.map((card) => card.id),
    totalCards: pool.cards.length,
  };
  return {
    roomCode,
    roomName,
    phase: "lobby",
    hostId: players[0]?.id ?? "",
    players,
    currentPlayerIndex: 0,
    movesLeft: 0,
    lastRoll: null,
    suggestion: null,
    solution: dealt.solution,
    hands: dealt.hands,
    notes: {},
    events: [event(`${roomName} is ready. The case file is sealed.`, "gold")],
    messages: [],
    settings,
    deckInfo,
  };
}

export function startGame(state: GameState): GameState {
  if (state.players.length < 2) return state;
  const dealtState = refreshHands({ ...state, phase: "lobby" });
  const refreshed = dealtState.players.map((player) => ({ ...player, ready: true, cardCount: dealtState.hands[player.id]?.length ?? 0 }));
  return {
    ...dealtState,
    phase: "playing",
    players: refreshed,
    currentPlayerIndex: 0,
    movesLeft: 0,
    lastRoll: null,
    suggestion: null,
    events: [event("The doors are locked. The investigation begins.", "gold"), ...state.events].slice(0, 30),
  };
}

export function toggleReady(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, ready: !player.ready } : player)),
  };
}

export function updateSettings(state: GameState, settings: Partial<RuleSettings>): GameState {
  if (state.phase !== "lobby") return state;
  return { ...state, settings: { ...state.settings, ...settings } };
}

export function addPlayer(state: GameState, entry: { id?: string; name: string; color?: PlayerColor }): GameState {
  if (state.phase !== "lobby" || state.players.length >= 7) return state;
  const newPlayer = buildPlayers([entry], state.hostId)[0];
  return {
    ...state,
    players: [...state.players, { ...newPlayer, isHost: false, position: { roomId: ROOM_IDS[state.players.length % ROOM_IDS.length], step: 0 } }],
    events: [event(`${newPlayer.name} joined the investigation.`, "mint"), ...state.events].slice(0, 30),
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== "lobby" || playerId === state.hostId) return state;
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return state;
  const remaining = state.players.filter((candidate) => candidate.id !== playerId);
  return {
    ...state,
    players: remaining,
    events: [event(`${player.name} left the lobby.`, "rose"), ...state.events].slice(0, 30),
  };
}

export function rollForTurn(state: GameState, playerId: string): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft > 0 || state.suggestion?.status === "waiting") return state;
  const roll = Math.floor(Math.random() * 6) + 1;
  return {
    ...state,
    lastRoll: roll,
    movesLeft: roll,
    events: [event(`${player.name} rolled ${roll}.`, "blue"), ...state.events].slice(0, 30),
  };
}

export function movePlayer(state: GameState, playerId: string, destination: RoomId): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft <= 0) return state;
  if (!ROOM_GRAPH[player.position.roomId].includes(destination)) return state;
  const nextMoves = state.movesLeft - 1;
  const movedPlayer = { ...player, position: { roomId: destination, step: 0 } };
  return {
    ...state,
    movesLeft: nextMoves,
    players: state.players.map((candidate) => (candidate.id === playerId ? movedPlayer : candidate)),
    events: [event(`${player.name} entered the ${roomName(destination)}.`, "mint"), ...state.events].slice(0, 30),
  };
}

export function endTurn(state: GameState, playerId: string): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft > 0 || state.suggestion?.status === "waiting") return state;
  const nextIndex = findNextActiveIndex(state, state.currentPlayerIndex);
  const nextPlayer = state.players[nextIndex];
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    lastRoll: null,
    movesLeft: 0,
    suggestion: null,
    events: [event(`${nextPlayer.name}'s turn.`, "gold"), ...state.events].slice(0, 30),
  };
}

function matchingCards(hand: string[], suggestion: Pick<Suggestion, "suspectId" | "weaponId" | "roomId">): string[] {
  return hand.filter((cardId) => [suggestion.suspectId, suggestion.weaponId, suggestion.roomId].includes(cardId));
}

export function makeSuggestion(
  state: GameState,
  playerId: string,
  suspectId: string,
  weaponId: string,
): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.suggestion?.status === "waiting") return state;
  const roomId = player.position.roomId;
  const responderIds = state.players
    .filter((candidate) => candidate.id !== playerId && !candidate.eliminated)
    .sort((a, b) => ((state.players.indexOf(a) - state.players.indexOf(player)) + state.players.length) % state.players.length - ((state.players.indexOf(b) - state.players.indexOf(player)) + state.players.length) % state.players.length)
    .map((candidate) => candidate.id);
  const suggestion: Suggestion = {
    byPlayerId: playerId,
    suspectId,
    weaponId,
    roomId,
    responderIds,
    responderIndex: 0,
    status: responderIds.length ? "waiting" : "no-match",
  };
  return {
    ...state,
    suggestion,
    events: [event(`${player.name} made a suggestion in the ${roomName(roomId)}.`, "rose"), ...state.events].slice(0, 30),
  };
}

export function submitSuggestionResponse(state: GameState, responderId: string, cardId: string | null): GameState {
  const suggestion = state.suggestion;
  if (!suggestion || suggestion.status !== "waiting" || suggestion.responderIds[suggestion.responderIndex] !== responderId) return state;
  const responder = state.players.find((player) => player.id === responderId);
  const byPlayer = state.players.find((player) => player.id === suggestion.byPlayerId);
  if (!responder || !byPlayer) return state;
  const validCards = matchingCards(state.hands[responderId] ?? [], suggestion);
  if (cardId && !validCards.includes(cardId)) return state;
  if (cardId) {
    return {
      ...state,
      suggestion: { ...suggestion, status: "resolved", shownToPlayerId: suggestion.byPlayerId, shownCardId: cardId },
      events: [event(`${responder.name} quietly answered the suggestion.`, "blue"), ...state.events].slice(0, 30),
    };
  }
  const nextIndex = suggestion.responderIndex + 1;
  if (nextIndex >= suggestion.responderIds.length) {
    return {
      ...state,
      suggestion: { ...suggestion, status: "no-match" },
      events: [event("No one could disprove the suggestion.", "rose"), ...state.events].slice(0, 30),
    };
  }
  return { ...state, suggestion: { ...suggestion, responderIndex: nextIndex } };
}

export function autoResolveSuggestion(state: GameState): GameState {
  let next = state;
  const suggestion = next.suggestion;
  if (!suggestion || suggestion.status !== "waiting") return next;
  for (let index = suggestion.responderIndex; index < suggestion.responderIds.length; index += 1) {
    const responderId = suggestion.responderIds[index];
    const matches = matchingCards(next.hands[responderId] ?? [], suggestion);
    if (matches.length) return submitSuggestionResponse(next, responderId, matches[0]);
    next = submitSuggestionResponse(next, responderId, null);
    if (next.suggestion?.status !== "waiting") return next;
  }
  return next;
}

export function makeAccusation(state: GameState, playerId: string, suspectId: string, weaponId: string, roomId: RoomId): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || (!state.settings.finalAccusationAnytime && player.position.roomId !== roomId)) return state;
  const correct = [suspectId, weaponId, roomId].every((id) => state.solution.includes(id));
  if (correct) {
    return {
      ...state,
      phase: "won",
      winnerId: playerId,
      events: [event(`${player.name} solved the mystery. Case closed.`, "gold"), ...state.events].slice(0, 30),
    };
  }
  const updatedPlayer = { ...player, eliminated: true };
  const remaining = activePlayers(state).filter((candidate) => candidate.id !== playerId);
  if (remaining.length <= 1) {
    return {
      ...state,
      phase: "ended",
      players: state.players.map((candidate) => (candidate.id === playerId ? updatedPlayer : candidate)),
      events: [event(`${player.name}'s accusation was incorrect. The case is over.`, "rose"), ...state.events].slice(0, 30),
    };
  }
  const nextState: GameState = {
    ...state,
    players: state.players.map((candidate) => (candidate.id === playerId ? updatedPlayer : candidate)),
    movesLeft: 0,
    suggestion: null,
    events: [event(`${player.name}'s accusation was incorrect. They can no longer accuse.`, "rose"), ...state.events].slice(0, 30),
  };
  return endTurn(nextState, playerId);
}

export function setNote(
  state: GameState,
  playerId: string,
  cardId: string,
  value: "unknown" | "maybe" | "ruled-out" | "found",
): GameState {
  const playerNotes = { ...(state.notes[playerId] ?? {}) };
  if (value === "unknown") delete playerNotes[cardId];
  else playerNotes[cardId] = value;
  return { ...state, notes: { ...state.notes, [playerId]: playerNotes } };
}

export function addChatMessage(state: GameState, playerId: string, text: string): GameState {
  const trimmed = text.trim().slice(0, 240);
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!trimmed || !player || !state.settings.allowChat) return state;
  const message: ChatMessage = { id: makeId("message"), playerId, playerName: player.name, text: trimmed, timestamp: now() };
  return { ...state, messages: [...state.messages, message].slice(-60) };
}

export function refreshHands(state: GameState): GameState {
  const playerIds = state.players.map((player) => player.id);
  const pool = cardsForPlayerCount(playerIds.length, state.settings.expansionCards);
  const dealt = makeSolutionAndHands(playerIds, pool.cards.map((card) => card.id));
  return {
    ...state,
    solution: dealt.solution,
    hands: dealt.hands,
    deckInfo: { handSize: pool.handSize, expansionCards: pool.expansionCards.map((card) => card.id), totalCards: pool.cards.length },
    players: state.players.map((player) => ({ ...player, cardCount: dealt.hands[player.id]?.length ?? 0 })),
  };
}

export function toPublicGameState(state: GameState, viewerId?: string): Omit<GameState, "solution" | "hands" | "notes"> & { myHand: string[]; myNotes: Record<string, "unknown" | "maybe" | "ruled-out" | "found"> } {
  const { solution: _solution, hands: _hands, notes, ...publicState } = state;
  return { ...publicState, myPlayerId: viewerId, myHand: viewerId ? state.hands[viewerId] ?? [] : [], myNotes: viewerId ? notes[viewerId] ?? {} : {} };
}

export function categoryForRoom(roomId: RoomId): CardCategory {
  return "room";
}

export function baseCardIds(): string[] {
  return BASE_CARDS.map((card) => card.id);
}
