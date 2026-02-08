// Friendly name generator for quilt generations
// Word pool: cozy, quilter-friendly, playful

const ADJECTIVES = [
  "Cozy", "Sunny", "Autumn", "Spring", "Meadow", "Garden", "Cottage", "Vintage",
  "Velvet", "Honey", "Maple", "Lavender", "Rosy", "Misty", "Golden", "Silver",
  "Willow", "Berry", "Clover", "Daisy", "Buttercup", "Bluebell", "Thistle",
  "Pebble", "Mossy", "Fern", "Coral", "Sunset", "Dawn", "Twilight", "Starry",
  "Rustic", "Country", "Farmhouse", "Patchwork", "Quilted", "Stitched",
  "Woven", "Braided", "Knotted", "Folded", "Gathered", "Ruffled", "Pleated",
  "Snug", "Warm", "Soft", "Gentle", "Sweet", "Lovely", "Cheerful", "Bright",
];

const NOUNS = [
  "Bloom", "Patch", "Stitch", "Thread", "Basket", "Bouquet", "Garden",
  "Meadow", "Cottage", "Hearth", "Nest", "Nook", "Haven", "Retreat",
  "Sunrise", "Sunset", "Rainbow", "Breeze", "Stream", "Petal", "Leaf",
  "Blossom", "Rosebud", "Acorn", "Pinecone", "Feather", "Pebble", "Shell",
  "Quilt", "Blanket", "Throw", "Wrap", "Square", "Diamond", "Star",
  "Heart", "Bow", "Ribbon", "Button", "Bobbin", "Thimble", "Needle",
  "Dream", "Wish", "Song", "Dance", "Story", "Memory", "Treasure",
];

export interface Generation {
  seed: number;
  name: string;
  createdAt: number;
}

const STORAGE_KEY = "quilt.generations";
const MAX_GENERATIONS = 50;

export function generateName(seed: number): string {
  // Use seed to deterministically pick words
  const adjIdx = seed % ADJECTIVES.length;
  const nounIdx = Math.floor(seed / ADJECTIVES.length) % NOUNS.length;
  return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`;
}

export function loadGenerations(): Generation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g): g is Generation =>
        typeof g.seed === "number" &&
        typeof g.name === "string" &&
        typeof g.createdAt === "number"
    );
  } catch {
    return [];
  }
}

export function saveGeneration(seed: number): Generation {
  const generations = loadGenerations();
  
  // Check if this seed already exists
  const existing = generations.find((g) => g.seed === seed);
  if (existing) return existing;
  
  const gen: Generation = {
    seed,
    name: generateName(seed),
    createdAt: Date.now(),
  };
  
  generations.unshift(gen);
  
  // Trim to max
  if (generations.length > MAX_GENERATIONS) {
    generations.length = MAX_GENERATIONS;
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(generations));
  return gen;
}

export function deleteGeneration(seed: number): void {
  const generations = loadGenerations().filter((g) => g.seed !== seed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(generations));
}
