import type { RoomId } from "./types.ts";

export type RoomMeta = {
  id: RoomId;
  name: string;
  subtitle: string;
  glyph: string;
  x: number;
  y: number;
  tone: string;
};

export const ROOM_META: Record<RoomId, RoomMeta> = {
  study: { id: "study", name: "Study", subtitle: "quiet papers", glyph: "⌂", x: 16, y: 17, tone: "violet" },
  hall: { id: "hall", name: "Hall", subtitle: "long shadows", glyph: "╋", x: 49, y: 17, tone: "slate" },
  lounge: { id: "lounge", name: "Lounge", subtitle: "low voices", glyph: "◒", x: 83, y: 17, tone: "rose" },
  library: { id: "library", name: "Library", subtitle: "locked spines", glyph: "▤", x: 16, y: 50, tone: "sky" },
  billiard: { id: "billiard", name: "Billiard Room", subtitle: "one ball short", glyph: "●", x: 49, y: 50, tone: "lime" },
  dining: { id: "dining", name: "Dining Room", subtitle: "place settings", glyph: "⌁", x: 83, y: 50, tone: "gold" },
  conservatory: { id: "conservatory", name: "Conservatory", subtitle: "rain on glass", glyph: "❀", x: 16, y: 83, tone: "mint" },
  ballroom: { id: "ballroom", name: "Ballroom", subtitle: "echoing music", glyph: "◌", x: 49, y: 83, tone: "coral" },
  kitchen: { id: "kitchen", name: "Kitchen", subtitle: "warm range", glyph: "⌁", x: 83, y: 83, tone: "coral" },
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

export const ROOM_GRAPH: Record<RoomId, RoomId[]> = {
  study: ["hall", "library"],
  hall: ["study", "lounge", "billiard"],
  lounge: ["hall", "dining"],
  library: ["study", "billiard", "conservatory"],
  billiard: ["hall", "library", "dining", "ballroom"],
  dining: ["lounge", "billiard", "kitchen"],
  conservatory: ["library", "ballroom"],
  ballroom: ["billiard", "conservatory", "kitchen"],
  kitchen: ["dining", "ballroom"],
};

export function roomName(roomId: RoomId): string {
  return ROOM_META[roomId].name;
}

export function roomGlyph(roomId: RoomId): string {
  return ROOM_META[roomId].glyph;
}
