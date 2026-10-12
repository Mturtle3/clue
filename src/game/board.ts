import type { CharacterId, RoomId } from "./types.ts";

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
  roomId: RoomId | null;
  isRoom: boolean;
};

export type BoardConnection = {
  from: number;
  to: number;
  secret?: boolean;
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

type GridPoint = [number, number];

// The interactive spaces follow a 25 x 25 estate footprint. The same geometry
// is rendered by the browser as room blocks, corridors, and clickable tiles.
const ROOM_POINTS: Record<RoomId, GridPoint> = {
  kitchen: [3, 3],
  ballroom: [12, 3],
  conservatory: [21, 3],
  dining: [3, 10],
  billiard: [21, 10],
  library: [21, 16],
  lounge: [3, 21],
  hall: [12, 21],
  study: [21, 21],
};

const ROOM_BOXES: Record<RoomId, [number, number, number, number]> = {
  kitchen: [1, 5, 1, 5],
  ballroom: [8, 16, 1, 5],
  conservatory: [19, 23, 1, 5],
  dining: [1, 5, 8, 13],
  billiard: [19, 23, 8, 13],
  library: [19, 23, 14, 18],
  lounge: [1, 5, 19, 23],
  hall: [8, 16, 18, 23],
  study: [19, 23, 20, 23],
};

const ROOM_DOORS: Record<RoomId, GridPoint[]> = {
  kitchen: [[6, 3], [3, 6]],
  ballroom: [[7, 3], [17, 3], [12, 6]],
  conservatory: [[18, 3], [21, 6]],
  dining: [[6, 10], [3, 7], [3, 14]],
  billiard: [[18, 10], [21, 7], [21, 13]],
  library: [[18, 16], [21, 13], [21, 19]],
  lounge: [[6, 21], [3, 18]],
  hall: [[7, 21], [17, 21], [12, 17]],
  study: [[18, 21], [21, 19]],
};

const CORRIDOR_LINKS: Array<[RoomId, RoomId]> = [
  ["kitchen", "ballroom"],
  ["ballroom", "conservatory"],
  ["kitchen", "dining"],
  ["dining", "lounge"],
  ["ballroom", "hall"],
  ["hall", "lounge"],
  ["hall", "study"],
  ["conservatory", "billiard"],
  ["billiard", "library"],
  ["library", "study"],
  ["dining", "billiard"],
];

export const SECRET_PASSAGES: Array<[RoomId, RoomId]> = [
  ["kitchen", "study"],
  ["lounge", "conservatory"],
];

const keyFor = (x: number, y: number): string => `${x}:${y}`;
const blocked = new Set<string>();
for (let row = 8; row <= 16; row += 1) for (let column = 8; column <= 16; column += 1) blocked.add(keyFor(column, row));

const toPercent = (value: number): number => 2 + value * 4;

const points = new Map<string, { x: number; y: number; roomId: RoomId | null; isRoom: boolean }>();

for (let row = 0; row < 25; row += 1) {
  for (let column = 0; column < 25; column += 1) {
    if (blocked.has(keyFor(column, row))) continue;
    const insideRoom = ROOM_IDS.some((roomId) => {
      const [minX, maxX, minY, maxY] = ROOM_BOXES[roomId];
      return column >= minX && column <= maxX && row >= minY && row <= maxY;
    });
    if (!insideRoom) points.set(keyFor(column, row), { x: toPercent(column), y: toPercent(row), roomId: null, isRoom: false });
  }
}

for (const roomId of ROOM_IDS) {
  const [x, y] = ROOM_POINTS[roomId];
  points.set(keyFor(x, y), { x: toPercent(x), y: toPercent(y), roomId, isRoom: true });
}

export const BOARD_TILES: BoardTile[] = Array.from(points.values()).map((point, id) => ({ ...point, id }));

const tileAt = new Map<string, number>(Array.from(points.keys()).map((key, index) => [key, index]));
const roomTile = (roomId: RoomId): number => {
  const [x, y] = ROOM_POINTS[roomId];
  return tileAt.get(keyFor(x, y)) ?? -1;
};

export const ROOM_TILE_INDEX: Record<RoomId, number> = Object.fromEntries(
  ROOM_IDS.map((roomId) => [roomId, roomTile(roomId)]),
) as Record<RoomId, number>;

const START_TILE_POINTS: Record<CharacterId, GridPoint> = {
  "suspect-scarlet": [7, 24],
  "suspect-mustard": [0, 11],
  "suspect-white": [7, 0],
  "suspect-green": [24, 11],
  "suspect-peacock": [17, 0],
  "suspect-plum": [17, 24],
  "suspect-orchid": [0, 16],
};

export const START_TILE_INDEX: Record<CharacterId, number> = Object.fromEntries(
  Object.entries(START_TILE_POINTS).map(([characterId, [x, y]]) => [characterId, tileAt.get(keyFor(x, y)) ?? 0]),
) as Record<CharacterId, number>;

const graph = new Map<number, Set<number>>(BOARD_TILES.map((tile) => [tile.id, new Set<number>()]));

function connect(from: number, to: number): void {
  graph.get(from)?.add(to);
  graph.get(to)?.add(from);
}

for (const [key, tileId] of tileAt.entries()) {
  const [x, y] = key.split(":").map(Number);
  [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nextX, nextY]) => {
    const nextId = tileAt.get(keyFor(nextX, nextY));
    if (nextId !== undefined) connect(tileId, nextId);
  });
}

for (const roomId of ROOM_IDS) {
  for (const [x, y] of ROOM_DOORS[roomId]) {
    const doorId = tileAt.get(keyFor(x, y));
    if (doorId !== undefined) connect(ROOM_TILE_INDEX[roomId], doorId);
  }
}

const passageConnections: BoardConnection[] = SECRET_PASSAGES.map(([fromRoom, toRoom]) => {
  const from = ROOM_TILE_INDEX[fromRoom];
  const to = ROOM_TILE_INDEX[toRoom];
  connect(from, to);
  return { from, to, secret: true };
});

export const BOARD_CONNECTIONS: BoardConnection[] = passageConnections;
export const BOARD_GRAPH: Record<number, number[]> = Object.fromEntries(
  Array.from(graph.entries()).map(([id, neighbors]) => [id, Array.from(neighbors)]),
);

export function roomName(roomId: RoomId): string {
  return ROOM_META[roomId].name;
}

export function roomGlyph(roomId: RoomId): string {
  return ROOM_META[roomId].glyph;
}

export function normalizeTileIndex(tileIndex: unknown, roomId: RoomId | null, fallbackIndex = 0): number {
  if (Number.isInteger(tileIndex) && Number(tileIndex) >= 0 && Number(tileIndex) < BOARD_TILES.length) return Number(tileIndex);
  if (roomId) return ROOM_TILE_INDEX[roomId];
  return Math.max(0, fallbackIndex % BOARD_TILES.length);
}

export function tileDistance(from: number, to: number): number {
  if (from === to) return 0;
  const distances = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift() as number;
    const distance = distances.get(current) as number;
    for (const next of BOARD_GRAPH[current] ?? []) {
      if (distances.has(next)) continue;
      if (next === to) return distance + 1;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return Number.POSITIVE_INFINITY;
}
