import { BASE_CARDS, cardsForPlayerCount, getCard } from "./cards.ts";
import { BOARD_TILES, ROOM_IDS, ROOM_TILE_INDEX, normalizeTileIndex, roomName, tileDistance } from "./board.ts";
import type {
  CardCategory,
  CharacterId,
  ChatMessage,
  GameEvent,
  GameState,
  Player,
  PlayerColor,
  RoomId,
  RuleSettings,
  Suggestion,
  SuggestionHistoryEntry,
} from "./types.ts";
import { CHARACTERS, DEFAULT_RULES, findCharacterByName, getCharacter } from "./types.ts";

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
  entries: Array<{ id?: string; characterId?: CharacterId; name?: string; color?: PlayerColor }>,
  hostId?: string,
): Player[] {
  const players = entries.map((entry, index) => {
    const character = getCharacter(entry.characterId ?? findCharacterByName(entry.name)?.id, index);
    const roomId = ROOM_IDS[index % ROOM_IDS.length];
    return {
      id: entry.id ?? makeId("player"),
      characterId: character.id,
      name: character.name,
      color: character.color,
      isHost: false,
      isConnected: true,
      ready: false,
      eliminated: false,
      position: { roomId, step: 0, tileIndex: ROOM_TILE_INDEX[roomId], inRoom: true },
      cardCount: 0,
    } satisfies Player;
  });
  const actualHost = hostId ?? players[0]?.id;
  return players.map((player) => ({ ...player, isHost: player.id === actualHost }));
}

export function createGame(
  roomCode: string,
  roomName: string,
  playerEntries: Array<{ id?: string; characterId?: CharacterId; name?: string; color?: PlayerColor }>,
  settings: RuleSettings = DEFAULT_RULES,
): GameState {
  const players = buildPlayers(playerEntries);
  const effectiveSettings = { ...DEFAULT_RULES, ...settings };
  const pool = cardsForPlayerCount(players.length, effectiveSettings.expansionCards);
  const dealt = makeSolutionAndHands(players.map((player) => player.id), pool.cards.map((card) => card.id));
  const deckInfo = {
    handSize: pool.handSize,
    expansionCards: pool.expansionCards.map((card) => card.id),
    activeCards: pool.cards.map((card) => card.id),
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
    suggestionHistory: [],
    lastSuggestionRoomByPlayer: {},
    solution: dealt.solution,
    hands: dealt.hands,
    notes: {},
    events: [event(`${roomName} is ready. The case file is sealed.`, "gold")],
    messages: [],
    settings: effectiveSettings,
    deckInfo,
  };
}

export function startGame(state: GameState): GameState {
  if (state.players.length < 2) return state;
  const dealtState = refreshHands({ ...state, phase: "lobby" });
  const refreshed = dealtState.players.map((player, index) => {
    const character = getCharacter(player.characterId, index);
    const tileIndex = normalizeTileIndex(player.position.tileIndex, player.position.roomId, index);
    const tile = BOARD_TILES[tileIndex];
    return {
      ...player,
      characterId: character.id,
      name: character.name,
      color: character.color,
      ready: true,
      cardCount: dealtState.hands[player.id]?.length ?? 0,
      position: { ...player.position, roomId: tile.roomId ?? player.position.roomId, tileIndex, step: 0, inRoom: tile.isRoom },
    };
  });
  return {
    ...dealtState,
    phase: "playing",
    players: refreshed,
    currentPlayerIndex: 0,
    movesLeft: 0,
    lastRoll: null,
    suggestion: null,
    suggestionHistory: dealtState.suggestionHistory ?? [],
    lastSuggestionRoomByPlayer: dealtState.lastSuggestionRoomByPlayer ?? {},
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

export function addPlayer(state: GameState, entry: { id?: string; characterId?: CharacterId; name?: string; color?: PlayerColor }): GameState {
  if (state.phase !== "lobby" || state.players.length >= 7) return state;
  const usedCharacters = new Set(state.players.map((player) => player.characterId));
  const requested = getCharacter(entry.characterId, state.players.length);
  const character = !usedCharacters.has(requested.id)
    ? requested
    : CHARACTERS.find((candidate) => !usedCharacters.has(candidate.id));
  if (!character) return state;
  const newPlayer = buildPlayers([{ ...entry, characterId: character.id }], state.hostId)[0];
  const startingRoom = ROOM_IDS[state.players.length % ROOM_IDS.length];
  return {
    ...state,
    players: [...state.players, { ...newPlayer, isHost: false, position: { roomId: startingRoom, step: 0, tileIndex: ROOM_TILE_INDEX[startingRoom], inRoom: true } }],
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
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft > 0 || state.lastRoll !== null || state.suggestion?.status === "waiting") return state;
  const roll = Math.floor(Math.random() * 6) + 1;
  return {
    ...state,
    lastRoll: roll,
    movesLeft: roll,
    events: [event(`${player.name} rolled ${roll}.`, "blue"), ...state.events].slice(0, 30),
  };
}

export function movePlayer(state: GameState, playerId: string, destination: number): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft <= 0) return state;
  if (!Number.isInteger(destination) || !BOARD_TILES[destination]) return state;
  const fromTile = normalizeTileIndex(player.position.tileIndex, player.position.roomId, state.players.indexOf(player));
  const distance = tileDistance(fromTile, destination);
  if (distance < 1 || distance > state.movesLeft) return state;
  const destinationTile = BOARD_TILES[destination];
  const movedPlayer = {
    ...player,
    position: {
      roomId: destinationTile.isRoom ? destinationTile.roomId : player.position.roomId,
      step: 0,
      tileIndex: destination,
      inRoom: destinationTile.isRoom,
    },
  };
  return {
    ...state,
    movesLeft: state.movesLeft - distance,
    players: state.players.map((candidate) => (candidate.id === playerId ? movedPlayer : candidate)),
    events: [event(`${player.name} moved ${distance} space${distance === 1 ? "" : "s"}${destinationTile.roomId ? ` to the ${roomName(destinationTile.roomId)}` : ""}.`, "mint"), ...state.events].slice(0, 30),
  };
}

function playerIsInRoom(player: Player): boolean {
  const tile = BOARD_TILES[player.position.tileIndex];
  return Boolean(tile?.isRoom && tile.roomId && player.position.inRoom !== false);
}

export function finishMovement(state: GameState, playerId: string): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.movesLeft <= 0 || state.suggestion?.status === "waiting") return state;
  return {
    ...state,
    movesLeft: 0,
    events: [event(`${player.name} finished moving.`, "slate"), ...state.events].slice(0, 30),
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

function addSuggestionHistory(
  state: GameState,
  suggestion: Suggestion,
  result: SuggestionHistoryEntry["result"],
  shownCardId?: string,
): SuggestionHistoryEntry[] {
  return [
    ...(state.suggestionHistory ?? []),
    {
      id: makeId("suggestion"),
      byPlayerId: suggestion.byPlayerId,
      suspectId: suggestion.suspectId,
      weaponId: suggestion.weaponId,
      roomId: suggestion.roomId,
      result,
      shownToPlayerId: shownCardId ? suggestion.byPlayerId : undefined,
      shownCardId,
      timestamp: now(),
    },
  ].slice(-50);
}

export function makeSuggestion(
  state: GameState,
  playerId: string,
  suspectId: string,
  weaponId: string,
): GameState {
  const player = currentPlayer(state);
  if (state.phase !== "playing" || !player || player.id !== playerId || state.suggestion?.status === "waiting" || !playerIsInRoom(player) || !player.position.roomId) return state;
  const roomId = player.position.roomId;
  const previousRoom = state.lastSuggestionRoomByPlayer?.[playerId];
  if (state.settings.noRepeatRoomSuggestions !== false && previousRoom === roomId) return state;
  const responderIds = state.players
    .filter((candidate) => candidate.id !== playerId && !candidate.eliminated)
    .sort((a, b) => ((state.players.indexOf(a) - state.players.indexOf(player)) + state.players.length) % state.players.length - ((state.players.indexOf(b) - state.players.indexOf(player)) + state.players.length) % state.players.length)
    .map((candidate) => candidate.id);
  const suspectPlayer = state.players.find((candidate) => (candidate.characterId ?? findCharacterByName(candidate.name)?.id) === suspectId && !candidate.eliminated);
  const roomTileIndex = ROOM_TILE_INDEX[roomId];
  const movedPlayers = state.settings.moveSuggestedCharacter !== false && suspectPlayer
    ? state.players.map((candidate) => candidate.id === suspectPlayer.id
      ? { ...candidate, position: { roomId, step: 0, tileIndex: roomTileIndex, inRoom: true } }
      : candidate)
    : state.players;
  const suggestion: Suggestion = {
    byPlayerId: playerId,
    suspectId,
    weaponId,
    roomId,
    responderIds,
    responderIndex: 0,
    status: responderIds.length ? "waiting" : "no-match",
    movedPlayerId: state.settings.moveSuggestedCharacter !== false ? suspectPlayer?.id : undefined,
  };
  const nextState: GameState = {
    ...state,
    players: movedPlayers,
    suggestion,
    lastSuggestionRoomByPlayer: { ...(state.lastSuggestionRoomByPlayer ?? {}), [playerId]: roomId },
    events: [event(`${player.name} made a suggestion in the ${roomName(roomId)}.`, "rose"), ...state.events].slice(0, 30),
  };
  return responderIds.length ? nextState : {
    ...nextState,
    suggestionHistory: addSuggestionHistory(nextState, suggestion, "no-match"),
    events: [event("No one could disprove the suggestion.", "rose"), ...nextState.events].slice(0, 30),
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
  // A detective may only pass when they truly have none of the three cards.
  // This is checked on the server so a modified browser cannot bluff.
  if (!cardId && validCards.length > 0) return state;
  if (cardId) {
    return {
      ...state,
      suggestion: { ...suggestion, status: "resolved", shownToPlayerId: suggestion.byPlayerId, shownCardId: cardId },
      suggestionHistory: addSuggestionHistory(state, suggestion, "shown", cardId),
      events: [event(`${responder.name} quietly answered the suggestion.`, "blue"), ...state.events].slice(0, 30),
    };
  }
  const nextIndex = suggestion.responderIndex + 1;
  if (nextIndex >= suggestion.responderIds.length) {
    return {
      ...state,
      suggestion: { ...suggestion, status: "no-match" },
      suggestionHistory: addSuggestionHistory(state, suggestion, "no-match"),
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
  if (state.phase !== "playing" || !player || player.id !== playerId || (!state.settings.finalAccusationAnytime && (!playerIsInRoom(player) || player.position.roomId !== roomId))) return state;
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
  if (!trimmed || !player || state.settings.allowChat === false) return state;
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
    deckInfo: { handSize: pool.handSize, expansionCards: pool.expansionCards.map((card) => card.id), activeCards: pool.cards.map((card) => card.id), totalCards: pool.cards.length },
    players: state.players.map((player) => ({ ...player, cardCount: dealt.hands[player.id]?.length ?? 0 })),
  };
}

export function toPublicGameState(state: GameState, viewerId?: string): Omit<GameState, "solution" | "hands" | "notes"> & { myHand: string[]; myNotes: Record<string, "unknown" | "maybe" | "ruled-out" | "found"> } {
  const { solution: _solution, hands: _hands, notes, ...publicState } = state;
  const safeSuggestion = state.suggestion
    ? (({ shownCardId: _shownCardId, ...suggestion }) => viewerId && state.suggestion?.shownToPlayerId === viewerId && state.suggestion.shownCardId
      ? { ...suggestion, shownCardId: state.suggestion.shownCardId }
      : suggestion)(state.suggestion)
    : null;
  const safeHistory = (state.suggestionHistory ?? []).map((entry) => {
    const { shownCardId: _shownCardId, ...safeEntry } = entry;
    return viewerId && entry.shownToPlayerId === viewerId && entry.shownCardId
      ? { ...safeEntry, shownCardId: entry.shownCardId }
      : safeEntry;
  });
  return { ...publicState, suggestion: safeSuggestion, suggestionHistory: safeHistory, myPlayerId: viewerId, myHand: viewerId ? state.hands[viewerId] ?? [] : [], myNotes: viewerId ? notes[viewerId] ?? {} : {} };
}

export function categoryForRoom(roomId: RoomId): CardCategory {
  return "room";
}

export function baseCardIds(): string[] {
  return BASE_CARDS.map((card) => card.id);
}
