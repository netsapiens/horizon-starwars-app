/**
 * Shape test for the live character index.
 *
 * The source is hand-maintained community JSON, so a field's TYPE is not
 * stable: `masters` is an array on some records and a bare string on others,
 * `homeworld` is a string except where it is a list. A TypeScript interface
 * asserts nothing about that at runtime — it is erased — so this runs the real
 * `normalize` over the real document and checks what comes out.
 *
 * It caught nothing when it was written, because it was written after the
 * page had already crashed on `value.join is not a function`. It exists so
 * the next shape change at the source fails a build instead of a browser.
 *
 * Needs the network. Run with: npm run check:index
 */
import { normalize } from '../src/api/starwarsApi.ts';

const INDEX_URL =
  'https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json';

const LIST_FIELDS = [
  'affiliations',
  'formerAffiliations',
  'masters',
  'apprentices',
  'equipment',
];
const TEXT_FIELDS = [
  'name',
  'image',
  'wiki',
  'gender',
  'species',
  'homeworld',
  'born',
  'bornLocation',
  'died',
  'diedLocation',
  'cybernetics',
  'class',
  'model',
  'manufacturer',
  'haystack',
];
const NUMBER_FIELDS = ['id', 'height', 'mass'];

const response = await fetch(INDEX_URL);
if (!response.ok) {
  console.error(`Could not fetch the index: ${response.status}`);
  process.exit(1);
}

const raw = await response.json();
const problems = [];

if (!Array.isArray(raw) || raw.length === 0) {
  console.error('The index is not a non-empty list');
  process.exit(1);
}

const characters = raw.map(normalize).filter(Boolean);

for (const character of characters) {
  const where = `#${character.id} ${character.name}`;

  for (const field of LIST_FIELDS) {
    const value = character[field];
    if (!Array.isArray(value)) {
      problems.push(`${where}: ${field} is ${typeof value}, expected an array`);
    } else if (value.some((entry) => typeof entry !== 'string')) {
      problems.push(`${where}: ${field} holds a non-string entry`);
    }
  }

  for (const field of TEXT_FIELDS) {
    const value = character[field];
    if (value !== undefined && typeof value !== 'string') {
      problems.push(`${where}: ${field} is ${typeof value}, expected a string`);
    }
  }

  for (const field of NUMBER_FIELDS) {
    const value = character[field];
    if (value !== undefined && typeof value !== 'number') {
      problems.push(`${where}: ${field} is ${typeof value}, expected a number`);
    }
  }
}

const dropped = raw.length - characters.length;

if (problems.length) {
  console.error(`FAIL — ${problems.length} shape problem(s):`);
  problems.slice(0, 20).forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

// A source that suddenly drops most of its records still "passes" every type
// check above, so assert the roster is there at all.
if (characters.length < 50) {
  console.error(
    `FAIL — only ${characters.length} usable characters; the source has changed shape.`,
  );
  process.exit(1);
}

console.log(
  `PASS — ${characters.length} characters normalize cleanly` +
    (dropped ? ` (${dropped} raw record(s) dropped as unusable)` : ''),
);
