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

// This follows the classic Clue silhouette: rooms sit around a connected
// hallway network instead of being arranged on one artificial outer loop.
const ROOM_POINTS: Record<RoomId, GridPoint> = {
  kitchen: [4, 4],
  ballroom: [12, 4],
  conservatory: [20, 4],
  dining: [4, 12],
  billiard: [20, 12],
  library: [20, 17],
  lounge: [4, 20],
  hall: [12, 20],
  study: [20, 20],
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

const toPercent = (value: number): number => 4 + (value - 1) * 4;
const keyFor = (x: number, y: number): string => `${x}:${y}`;

const points = new Map<string, { x: number; y: number; roomId: RoomId | null; isRoom: boolean }>();

for (const roomId of ROOM_IDS) {
  const [x, y] = ROOM_POINTS[roomId];
  points.set(keyFor(x, y), { x: toPercent(x), y: toPercent(y), roomId, isRoom: true });
}

function addSegment(fromRoom: RoomId, toRoom: RoomId): void {
  const [fromX, fromY] = ROOM_POINTS[fromRoom];
  const [toX, toY] = ROOM_POINTS[toRoom];
  if (fromX !== toX && fromY !== toY) throw new Error(`Board connection must be straight: ${fromRoom} -> ${toRoom}`);
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  for (let step = 0; step <= steps; step += 1) {
    const x = fromX + stepX * step;
    const y = fromY + stepY * step;
    const key = keyFor(x, y);
    if (!points.has(key)) points.set(key, { x: toPercent(x), y: toPercent(y), roomId: null, isRoom: false });
  }
}

for (const [from, to] of CORRIDOR_LINKS) addSegment(from, to);

export const BOARD_TILES: BoardTile[] = Array.from(points.values()).map((point, id) => ({ ...point, id }));

const tileAt = new Map<string, number>(BOARD_TILES.map((tile) => [keyFor(tile.x, tile.y), tile.id]));
const roomTile = (roomId: RoomId): number => {
  const [x, y] = ROOM_POINTS[roomId];
  return tileAt.get(keyFor(toPercent(x), toPercent(y))) ?? -1;
};

export const ROOM_TILE_INDEX: Record<RoomId, number> = Object.fromEntries(
  ROOM_IDS.map((roomId) => [roomId, roomTile(roomId)]),
) as Record<RoomId, number>;

const graph = new Map<number, Set<number>>(BOARD_TILES.map((tile) => [tile.id, new Set<number>()]));

function connect(from: number, to: number): void {
  graph.get(from)?.add(to);
  graph.get(to)?.add(from);
}

function segmentTileIds(fromRoom: RoomId, toRoom: RoomId): number[] {
  const [fromX, fromY] = ROOM_POINTS[fromRoom];
  const [toX, toY] = ROOM_POINTS[toRoom];
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  return Array.from({ length: steps + 1 }, (_, step) => {
    const x = toPercent(fromX + stepX * step);
    const y = toPercent(fromY + stepY * step);
    const id = tileAt.get(keyFor(x, y));
    if (id === undefined) throw new Error(`Missing board tile at ${x},${y}`);
    return id;
  });
}

const corridorConnections: BoardConnection[] = [];
for (const [fromRoom, toRoom] of CORRIDOR_LINKS) {
  const ids = segmentTileIds(fromRoom, toRoom);
  for (let index = 1; index < ids.length; index += 1) connect(ids[index - 1], ids[index]);
  corridorConnections.push({ from: ROOM_TILE_INDEX[fromRoom], to: ROOM_TILE_INDEX[toRoom] });
}

const passageConnections: BoardConnection[] = SECRET_PASSAGES.map(([fromRoom, toRoom]) => {
  const from = ROOM_TILE_INDEX[fromRoom];
  const to = ROOM_TILE_INDEX[toRoom];
  connect(from, to);
  return { from, to, secret: true };
});

export const BOARD_CONNECTIONS: BoardConnection[] = [...corridorConnections, ...passageConnections];
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
