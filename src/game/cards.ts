import type { Card, CardCategory } from "./types.ts";

export const BASE_CARDS: Card[] = [
  { id: "suspect-scarlet", name: "Miss Scarlet", category: "suspect", glyph: "✦", tone: "coral", clue: "The red glove was left by the east stair." },
  { id: "suspect-mustard", name: "Colonel Mustard", category: "suspect", glyph: "♟", tone: "gold", clue: "A boot print crosses the conservatory tiles." },
  { id: "suspect-white", name: "Mrs. White", category: "suspect", glyph: "❖", tone: "slate", clue: "A silver thread caught on the pantry latch." },
  { id: "suspect-green", name: "Mr. Green", category: "suspect", glyph: "♣", tone: "mint", clue: "The greenhouse ledger has a missing page." },
  { id: "suspect-peacock", name: "Mrs. Peacock", category: "suspect", glyph: "◈", tone: "sky", clue: "A blue feather rests under the library desk." },
  { id: "suspect-plum", name: "Professor Plum", category: "suspect", glyph: "✧", tone: "violet", clue: "Ink stains trail toward the west wing." },
  { id: "room-kitchen", name: "Kitchen", category: "room", glyph: "⌁", tone: "coral", clue: "The range is still warm despite the cold night." },
  { id: "room-ballroom", name: "Ballroom", category: "room", glyph: "◌", tone: "gold", clue: "The chandelier chain sways by itself." },
  { id: "room-conservatory", name: "Conservatory", category: "room", glyph: "❀", tone: "mint", clue: "Rainwater marks the marble path." },
  { id: "room-billiard", name: "Billiard Room", category: "room", glyph: "●", tone: "lime", clue: "One ivory ball is missing from the rack." },
  { id: "room-library", name: "Library", category: "room", glyph: "▤", tone: "sky", clue: "A book on poisons lies open on the lectern." },
  { id: "room-study", name: "Study", category: "room", glyph: "⌂", tone: "violet", clue: "The desk drawer was forced open." },
  { id: "room-hall", name: "Hall", category: "room", glyph: "╋", tone: "slate", clue: "The grandfather clock stopped at midnight." },
  { id: "room-lounge", name: "Lounge", category: "room", glyph: "◒", tone: "rose", clue: "A teacup still has a lipstick mark." },
  { id: "room-dining", name: "Dining Room", category: "room", glyph: "⌁", tone: "gold", clue: "A chair is pulled away from the table." },
  { id: "weapon-candlestick", name: "Candlestick", category: "weapon", glyph: "♜", tone: "gold", clue: "Wax flecks shimmer on the carpet." },
  { id: "weapon-dagger", name: "Dagger", category: "weapon", glyph: "⌁", tone: "slate", clue: "A narrow scratch marks the desk edge." },
  { id: "weapon-pipe", name: "Lead Pipe", category: "weapon", glyph: "◓", tone: "mint", clue: "Metal dust is caught in the rug." },
  { id: "weapon-revolver", name: "Revolver", category: "weapon", glyph: "◉", tone: "violet", clue: "The empty case is warm to the touch." },
  { id: "weapon-rope", name: "Rope", category: "weapon", glyph: "∞", tone: "coral", clue: "A frayed knot hangs from the balcony." },
  { id: "weapon-wrench", name: "Wrench", category: "weapon", glyph: "⚒", tone: "sky", clue: "Grease stains mark the service door." },
];

export const EXPANSION_CARDS: Card[] = [
  { id: "suspect-orchid", name: "Dr. Orchid", category: "suspect", glyph: "✤", tone: "rose", expansion: true, clue: "A pressed orchid is tucked inside a medical journal." },
  { id: "suspect-brunette", name: "Monsieur Brunette", category: "suspect", glyph: "✥", tone: "gold", expansion: true, clue: "A brass cufflink glints under the drawing-room sofa." },
  { id: "suspect-peach", name: "Miss Peach", category: "suspect", glyph: "✹", tone: "coral", expansion: true, clue: "A peach-colored ribbon is tied around a key." },
  { id: "suspect-gray", name: "Sergeant Gray", category: "suspect", glyph: "✣", tone: "slate", expansion: true, clue: "A service whistle echoes from the servants' stair." },
  { id: "room-observatory", name: "Observatory", category: "room", glyph: "◒", tone: "violet", expansion: true, clue: "The telescope points toward the empty moor." },
  { id: "room-courtyard", name: "Courtyard", category: "room", glyph: "✽", tone: "mint", expansion: true, clue: "Fresh gravel crunches under an unseen step." },
  { id: "room-wine-cellar", name: "Wine Cellar", category: "room", glyph: "◍", tone: "rose", expansion: true, clue: "A cork has been pulled from the oldest bottle." },
  { id: "weapon-lantern", name: "Lantern", category: "weapon", glyph: "☼", tone: "gold", expansion: true, clue: "The wick was trimmed moments ago." },
  { id: "weapon-poison", name: "Poison Vial", category: "weapon", glyph: "♙", tone: "lime", expansion: true, clue: "A green drop shines on a white handkerchief." },
  { id: "weapon-trophy", name: "Silver Trophy", category: "weapon", glyph: "♕", tone: "sky", expansion: true, clue: "The display case has a clean empty outline." },
];

export const ALL_CARDS = [...BASE_CARDS, ...EXPANSION_CARDS];

const expansionPlan: Record<number, CardCategory[]> = {
  2: [],
  3: [],
  4: ["suspect", "weapon"],
  5: ["suspect", "room"],
  6: [],
  7: ["suspect", "room", "weapon"],
};

export function getCard(id: string): Card | undefined {
  return ALL_CARDS.find((card) => card.id === id);
}

export function getCardsByCategory(category: CardCategory, cards: Card[] = ALL_CARDS): Card[] {
  return cards.filter((card) => card.category === category);
}

export function cardsForPlayerCount(playerCount: number, includeExpansions = true): {
  cards: Card[];
  handSize: number;
  expansionCards: Card[];
} {
  const safePlayerCount = Math.min(7, Math.max(2, playerCount));
  const baseNonSolutionCards = BASE_CARDS.length - 3;
  const handSize = Math.max(3, Math.ceil(baseNonSolutionCards / safePlayerCount));
  const extraNeeded = Math.max(0, handSize * safePlayerCount - baseNonSolutionCards);
  const plan = includeExpansions ? expansionPlan[safePlayerCount] ?? [] : [];
  const chosenExpansion: Card[] = [];

  for (const category of plan.slice(0, extraNeeded)) {
    const candidate = EXPANSION_CARDS.find(
      (card) => card.category === category && !chosenExpansion.some((chosen) => chosen.id === card.id),
    );
    if (candidate) chosenExpansion.push(candidate);
  }

  if (chosenExpansion.length < extraNeeded && includeExpansions) {
    for (const candidate of EXPANSION_CARDS) {
      if (chosenExpansion.length >= extraNeeded) break;
      if (!chosenExpansion.some((chosen) => chosen.id === candidate.id)) chosenExpansion.push(candidate);
    }
  }

  return {
    cards: [...BASE_CARDS, ...chosenExpansion],
    handSize,
    expansionCards: chosenExpansion,
  };
}

export function cardLabel(id: string): string {
  return getCard(id)?.name ?? "Unknown card";
}
