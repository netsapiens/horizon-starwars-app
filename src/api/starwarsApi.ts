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
 *
 * ── The shape problem, and why `normalize` exists ──────────────────────────
 *
 * This is hand-maintained community JSON, and the same field is not always the
 * same type. `masters` is an array on 7 records and a bare string on 8 of them
 * ("Leia Organa": "Luke Skywalker"); `apprentices` likewise; `homeworld` is a
 * string except for Greedo, who has two; `cybernetics` is a string except for
 * Darth Maul, who has a list; `born` is a number of years except for Boba
 * Fett, whose is "Shortly after the Battle of Naboo".
 *
 * A TypeScript interface asserts none of that — it is erased at build time, so
 * declaring `masters?: string[]` and casting the parsed JSON to it only moved
 * the lie somewhere the compiler would not check. Selecting Leia then called
 * `.join` on a string and took the whole page down with "value.join is not a
 * function". So every record now goes through `normalize`, which coerces each
 * field to ONE shape: list fields are always arrays (never undefined), text
 * fields are always strings or absent, and the year fields arrive
 * display-ready. After this boundary the UI cannot be surprised.
 */

const INDEX_URL =
  'https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json';

/**
 * A character in the ONE shape the rest of the app may assume.
 *
 * Note that the list fields are not optional: an absent list is an empty
 * array, so a component can call `.length` or `.map` without asking first.
 */
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
  /** Display-ready: '19 BBY', '34 ABY', or the source's own free text. */
  born?: string;
  bornLocation?: string;
  died?: string;
  diedLocation?: string;
  affiliations: string[];
  formerAffiliations: string[];
  masters: string[];
  apprentices: string[];
  equipment: string[];
  cybernetics?: string;
  /** Droid records carry these instead of a biography. */
  class?: string;
  model?: string;
  manufacturer?: string;
  /** Everything above, lowercased once, for search. */
  haystack: string;
}

/** 'mon calamari' -> 'Mon Calamari'; the source stores these lowercased. */
export function toLabel(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

/** Anything -> a list. A bare string is a list of one; absent is empty. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

/** Anything -> one line of text, or absent. A list becomes a sentence. */
function toText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const list = toList(value);

    return list.length ? list.join(', ') : undefined;
  }

  return undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The saga counts years from the Battle of Yavin: negative is Before,
 * positive After. Printing the raw -19 would be meaningless to anyone who has
 * seen the films and wrong to anyone who has not.
 *
 * A non-numeric value is the source telling a story rather than giving a date
 * ("Shortly after the Battle of Naboo") — pass it through as written.
 */
function toYear(value: unknown): string | undefined {
  const year = toNumber(value);

  if (year === undefined) {
    return toText(value);
  }

  return year < 0 ? `${Math.abs(year)} BBY` : `${year} ABY`;
}

function buildHaystack(character: Omit<Character, 'haystack'>): string {
  return [
    character.name,
    character.species,
    character.homeworld,
    character.gender,
    character.class,
    character.model,
    character.manufacturer,
    ...character.affiliations,
    ...character.formerAffiliations,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * One raw record -> one `Character`, or null if it is not usable.
 *
 * Exported for the shape test in `scripts/check-index.mjs`, which runs this
 * over the live document so a change at the source is caught here rather than
 * in somebody's browser.
 */
export function normalize(raw: unknown): Character | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = toNumber(record.id);
  const name = toText(record.name);
  const image = toText(record.image);

  // No id, no name or no picture and there is nothing to show — this app is
  // a wall of portraits.
  if (id === undefined || !name || !image) {
    return null;
  }

  const character: Omit<Character, 'haystack'> = {
    id,
    name,
    image,
    wiki: toText(record.wiki),
    gender: toText(record.gender),
    species: toText(record.species),
    homeworld: toText(record.homeworld),
    height: toNumber(record.height),
    mass: toNumber(record.mass),
    hairColor: toText(record.hairColor),
    eyeColor: toText(record.eyeColor),
    skinColor: toText(record.skinColor),
    born: toYear(record.born),
    bornLocation: toText(record.bornLocation),
    died: toYear(record.died),
    diedLocation: toText(record.diedLocation),
    affiliations: toList(record.affiliations),
    formerAffiliations: toList(record.formerAffiliations),
    masters: toList(record.masters),
    apprentices: toList(record.apprentices),
    equipment: toList(record.equipment),
    cybernetics: toText(record.cybernetics),
    class: toText(record.class),
    model: toText(record.model),
    manufacturer: toText(record.manufacturer),
  };

  return { ...character, haystack: buildHaystack(character) };
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

        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!Array.isArray(payload)) {
          throw new Error('The character index was not a list');
        }

        return payload
          .map(normalize)
          .filter((character): character is Character => character !== null)
          .sort((a, b) => a.id - b.id);
      })
      .catch((error: unknown) => {
        // Don't cache a rejection — a retry after a dropped connection should
        // actually retry.
        indexPromise = null;
        throw error;
      });
  }

  return indexPromise;
}
