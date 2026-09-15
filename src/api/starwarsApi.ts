/**
 * Star Wars character data — the app's only read.
 *
 * Source is akabab/starwars-api: one static JSON document of ~87 named
 * characters and droids, served from raw.githubusercontent.com, which sends
 * `Access-Control-Allow-Origin: *`. One request holds the whole index, every
 * record is complete, and there is no per-character detail call to make.
 *
 * Why not SWAPI: it carries no images, and this app is about the picture.
 * Why not the Databank API: richer roster, but name/description only, on a
 * free instance that cold-starts.
 *
 * The character images are hotlinked to Fandom's CDN — nobody redistributes
 * Star Wars stills the way the community vendors Pokemon sprites, so there is
 * no equivalent of the PokeAPI sprite repository to pull from. Displaying them
 * in an <img> always works; READING their bytes (which the avatar upload must
 * do) additionally needs that CDN to send CORS headers. See avatarApi.ts.
 */

const INDEX_URL =
  'https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json';

/** A character as the app uses it. Most fields are absent on most records. */
export interface Character {
  id: number;
  name: string;
  image: string;
  wiki?: string;
  gender?: string;
  species?: string;
  homeworld?: string;
  /** Metres. */
  height?: number;
  /** Kilograms. */
  mass?: number;
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  /** Negative is BBY, positive ABY — see `formatYear`. */
  born?: number;
  bornLocation?: string;
  died?: number;
  diedLocation?: string;
  affiliations?: string[];
  formerAffiliations?: string[];
  masters?: string[];
  apprentices?: string[];
  cybernetics?: string;
  /** Droid records carry these instead of a biography. */
  class?: string;
  model?: string;
  manufacturer?: string;
  platingColor?: string;
  sensorColor?: string;
  equipment?: string[];
  /** Everything above, lowercased once, for search. */
  haystack: string;
}

interface RawCharacter extends Omit<Character, 'haystack'> {
  [key: string]: unknown;
}

/** 'mon calamari' -> 'Mon Calamari'; the source stores these lowercased. */
export function toLabel(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * The saga counts years from the Battle of Yavin: negative is Before, positive
 * After. Printing the raw -19 would be meaningless to anyone who has seen the
 * films and wrong to anyone who has not.
 */
export function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BBY` : `${year} ABY`;
}

/** A filename-safe slug, for the uploaded avatar's filename. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'character'
  );
}

function buildHaystack(raw: RawCharacter): string {
  return [
    raw.name,
    raw.species,
    raw.homeworld,
    raw.gender,
    raw.class,
    raw.model,
    raw.manufacturer,
    ...(raw.affiliations ?? []),
    ...(raw.formerAffiliations ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

let indexPromise: Promise<Character[]> | null = null;

/**
 * The whole roster, fetched once per page load and shared by every caller.
 * ~57 KB, effectively static, and the records arrive complete — which is why
 * this app has no second request and no detail-loading state.
 */
export function fetchCharacters(signal?: AbortSignal): Promise<Character[]> {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL, { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `${response.status} ${response.statusText} for the character index`,
          );
        }

        return response.json() as Promise<RawCharacter[]>;
      })
      .then((rows) =>
        rows
          .filter((row) => typeof row?.id === 'number' && Boolean(row.name))
          .map((row) => ({ ...row, haystack: buildHaystack(row) }) as Character)
          .sort((a, b) => a.id - b.id),
      )
      .catch((error: unknown) => {
        // Don't cache a rejection — a retry after a dropped connection should
        // actually retry.
        indexPromise = null;
        throw error;
      });
  }

  return indexPromise;
}
