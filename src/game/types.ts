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
  roomId: RoomId;
  step: number;
};

export type PlayerColor = "coral" | "gold" | "mint" | "violet" | "sky" | "rose" | "lime";

export type Player = {
  id: string;
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
  shownToPlayerId?: string;
  shownCardId?: string;
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
  turnTimer: 0,
};

export const EMPTY_NOTES: Record<string, "unknown" | "maybe" | "ruled-out" | "found"> = {};
