const ADJECTIVES = [
  'Arcade',
  'Neon',
  'Velvet',
  'Cosmic',
  'Midnight',
  'Echo',
  'Pixel',
  'Silver',
  'Studio',
  'Amber',
  'Tape',
  'Lunar',
  'Signal',
  'Static',
  'Prism',
  'Nova',
  'Sonic',
  'Vinyl',
  'Groove',
  'Phantom',
  'Drift',
  'Ember',
  'Glitch',
  'Dusk',
  'Volt',
  'Crest',
  'Haze',
  'Turbo',
  'Indigo',
  'Crystal',
]

const NOUNS = [
  'Fox',
  'Raven',
  'Wizard',
  'Otter',
  'Bard',
  'Knight',
  'Falcon',
  'Comet',
  'Ghost',
  'Dragon',
  'Sparrow',
  'Mage',
  'Wolf',
  'Lynx',
  'Hawk',
  'Sage',
  'Viper',
  'Lark',
  'Crane',
  'Drake',
  'Wren',
  'Tide',
  'Gale',
  'Cove',
  'Vale',
  'Peak',
  'Ridge',
  'Fern',
  'Brook',
  'Mist',
]

// FNV-1a 32-bit hash — fast, deterministic, no dependencies
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

// Returns a stable, anonymous alias for a user within a specific project.
// The alias changes if the user visits a different project (intentional).
export function getReviewerAlias(projectId: string, userId: string): string {
  const adjIdx = fnv1a(`${projectId}:${userId}:adj`) % ADJECTIVES.length
  const nounIdx = fnv1a(`${projectId}:${userId}:noun`) % NOUNS.length
  return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`
}
