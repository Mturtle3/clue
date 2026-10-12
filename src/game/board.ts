import type { RoomId } from "./types.ts";

export type RoomMeta = {
  id: RoomId;
  name: string;
  subtitle: string;
  glyph: string;
  tone: string;
};

export type BoardTile = {
  id: number;
  x: number;
  y: number;
  roomId: RoomId;
  isRoom: boolean;
};

export const ROOM_META: Record<RoomId, RoomMeta> = {
  study: { id: "study", name: "Study", subtitle: "quiet papers", glyph: "⌂", tone: "violet" },
  hall: { id: "hall", name: "Hall", subtitle: "long shadows", glyph: "╋", tone: "slate" },
  lounge: { id: "lounge", name: "Lounge", subtitle: "low voices", glyph: "◒", tone: "rose" },
  library: { id: "library", name: "Library", subtitle: "locked spines", glyph: "▤", tone: "sky" },
  billiard: { id: "billiard", name: "Billiard Room", subtitle: "one ball short", glyph: "●", tone: "lime" },
  dining: { id: "dining", name: "Dining Room", subtitle: "place settings", glyph: "⌁", tone: "gold" },
  conservatory: { id: "conservatory", name: "Conservatory", subtitle: "rain on glass", glyph: "❀", tone: "mint" },
  ballroom: { id: "ballroom", name: "Ballroom", subtitle: "echoing music", glyph: "◌", tone: "coral" },
  kitchen: { id: "kitchen", name: "Kitchen", subtitle: "warm range", glyph: "⌁", tone: "coral" },
};

export const ROOM_IDS: RoomId[] = [
  "study",
  "hall",
  "lounge",
  "library",
  "billiard",
  "dining",
  "conservatory",
  "ballroom",
  "kitchen",
];

// A simple loop keeps movement readable: every space is a real tile, and the
// player may choose either direction around the estate after rolling.
const TILE_ROOMS: Array<[number, number, RoomId, boolean]> = [
  [1, 1, "study", true], [2, 1, "study", false], [3, 1, "study", false],
  [4, 1, "hall", false], [5, 1, "hall", true], [6, 1, "hall", false],
  [7, 1, "lounge", false], [8, 1, "lounge", false], [9, 1, "lounge", true],
  [9, 2, "dining", false], [9, 3, "dining", false], [9, 4, "dining", false],
  [9, 5, "dining", true], [9, 6, "kitchen", false], [9, 7, "kitchen", false],
  [9, 8, "kitchen", false], [9, 9, "kitchen", true],
  [8, 9, "ballroom", false], [7, 9, "ballroom", false], [6, 9, "ballroom", false],
  [5, 9, "ballroom", true], [4, 9, "conservatory", false], [3, 9, "conservatory", false],
  [2, 9, "conservatory", false], [1, 9, "conservatory", true], [1, 8, "library", false],
  [1, 7, "library", false], [1, 6, "library", true], [1, 5, "billiard", false],
  [1, 4, "billiard", false], [1, 3, "billiard", true],
];

export const BOARD_TILES: BoardTile[] = TILE_ROOMS.map(([x, y, roomId, isRoom], id) => ({ id, x, y, roomId, isRoom }));
export const ROOM_TILE_INDEX: Record<RoomId, number> = Object.fromEntries(
  BOARD_TILES.filter((tile) => tile.isRoom).map((tile) => [tile.roomId, tile.id]),
) as Record<RoomId, number>;

export const BOARD_GRAPH: Record<number, number[]> = Object.fromEntries(
  BOARD_TILES.map((tile) => [
    tile.id,
    [(tile.id - 1 + BOARD_TILES.length) % BOARD_TILES.length, (tile.id + 1) % BOARD_TILES.length],
  ]),
);

export function roomName(roomId: RoomId): string {
  return ROOM_META[roomId].name;
}

export function roomGlyph(roomId: RoomId): string {
  return ROOM_META[roomId].glyph;
}

export function normalizeTileIndex(tileIndex: unknown, roomId: RoomId, fallbackIndex = 0): number {
  if (Number.isInteger(tileIndex) && Number(tileIndex) >= 0 && Number(tileIndex) < BOARD_TILES.length) return Number(tileIndex);
  return ROOM_TILE_INDEX[roomId] ?? (fallbackIndex % BOARD_TILES.length);
}

export function tileDistance(from: number, to: number): number {
  if (from === to) return 0;
  const forward = (to - from + BOARD_TILES.length) % BOARD_TILES.length;
  const backward = (from - to + BOARD_TILES.length) % BOARD_TILES.length;
  return Math.min(forward, backward);
}
