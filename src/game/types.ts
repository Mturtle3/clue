export type CardCategory = "suspect" | "room" | "weapon";

export type Card = {
  id: string;
  name: string;
  category: CardCategory;
  glyph: string;
  tone: string;
  expansion?: boolean;
  clue: string;
};

export type RoomId =
  | "study"
  | "hall"
  | "lounge"
  | "library"
  | "billiard"
  | "dining"
  | "conservatory"
  | "ballroom"
  | "kitchen";

export type Position = {
  roomId: RoomId | null;
  step: number;
  tileIndex: number;
  inRoom: boolean;
};

export type PlayerColor = "coral" | "gold" | "mint" | "violet" | "sky" | "rose" | "lime";

export type CharacterId =
  | "suspect-scarlet"
  | "suspect-mustard"
  | "suspect-white"
  | "suspect-green"
  | "suspect-peacock"
  | "suspect-plum"
  | "suspect-orchid";

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  color: PlayerColor;
  glyph: string;
};

export const CHARACTERS: CharacterDefinition[] = [
  { id: "suspect-scarlet", name: "Miss Scarlet", color: "coral", glyph: "✦" },
  { id: "suspect-mustard", name: "Colonel Mustard", color: "gold", glyph: "♟" },
  { id: "suspect-white", name: "Mrs. White", color: "sky", glyph: "❖" },
  { id: "suspect-green", name: "Mr. Green", color: "mint", glyph: "♣" },
  { id: "suspect-peacock", name: "Mrs. Peacock", color: "violet", glyph: "◈" },
  { id: "suspect-plum", name: "Professor Plum", color: "rose", glyph: "✧" },
  { id: "suspect-orchid", name: "Dr. Orchid", color: "lime", glyph: "✤" },
];

export function getCharacter(characterId?: string, fallbackIndex = 0): CharacterDefinition {
  return CHARACTERS.find((character) => character.id === characterId) ?? CHARACTERS[Math.max(0, fallbackIndex) % CHARACTERS.length];
}

export function findCharacterByName(name?: string): CharacterDefinition | undefined {
  const normalized = name?.trim().toLowerCase();
  return CHARACTERS.find((character) => character.name.toLowerCase() === normalized);
}

export type Player = {
  id: string;
  characterId: CharacterId;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  isConnected: boolean;
  ready: boolean;
  eliminated: boolean;
  position: Position;
  cardCount: number;
  hand?: string[];
};

export type RuleSettings = {
  balancedDeck: boolean;
  expansionCards: boolean;
  finalAccusationAnytime: boolean;
  allowChat: boolean;
  noRepeatRoomSuggestions: boolean;
  moveSuggestedCharacter: boolean;
  turnTimer: number;
};

export type Suggestion = {
  byPlayerId: string;
  suspectId: string;
  weaponId: string;
  roomId: RoomId;
  responderIds: string[];
  responderIndex: number;
  status: "waiting" | "resolved" | "no-match";
  movedPlayerId?: string;
  shownToPlayerId?: string;
  shownCardId?: string;
  shownByPlayerId?: string;
};

export type SuggestionHistoryEntry = {
  id: string;
  byPlayerId: string;
  suspectId: string;
  weaponId: string;
  roomId: RoomId;
  result: "shown" | "no-match";
  shownToPlayerId?: string;
  shownCardId?: string;
  shownByPlayerId?: string;
  timestamp: number;
};

export type EventTone = "gold" | "rose" | "mint" | "blue" | "slate";

export type GameEvent = {
  id: string;
  text: string;
  tone: EventTone;
  timestamp: number;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
};

export type GamePhase = "lobby" | "playing" | "won" | "ended";

export type GameState = {
  roomCode: string;
  roomName: string;
  phase: GamePhase;
  hostId: string;
  players: Player[];
  currentPlayerIndex: number;
  movesLeft: number;
  lastRoll: number | null;
  suggestion: Suggestion | null;
  suggestionHistory: SuggestionHistoryEntry[];
  lastSuggestionRoomByPlayer: Record<string, RoomId>;
  solution: string[];
  hands: Record<string, string[]>;
  notes: Record<string, Record<string, "unknown" | "maybe" | "ruled-out" | "found">>;
  events: GameEvent[];
  messages: ChatMessage[];
  settings: RuleSettings;
  winnerId?: string;
  deckInfo: {
    handSize: number;
    expansionCards: string[];
    activeCards: string[];
    totalCards: number;
  };
};

export type PublicGameState = Omit<GameState, "solution" | "hands" | "notes"> & {
  myPlayerId?: string;
  myHand?: string[];
  myNotes?: Record<string, "unknown" | "maybe" | "ruled-out" | "found">;
};

export const PLAYER_COLORS: PlayerColor[] = ["coral", "gold", "mint", "violet", "sky", "rose", "lime"];

export const DEFAULT_RULES: RuleSettings = {
  balancedDeck: true,
  expansionCards: true,
  finalAccusationAnytime: false,
  allowChat: true,
  noRepeatRoomSuggestions: true,
  moveSuggestedCharacter: true,
  turnTimer: 0,
};

export const EMPTY_NOTES: Record<string, "unknown" | "maybe" | "ruled-out" | "found"> = {};
