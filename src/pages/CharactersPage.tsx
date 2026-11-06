/**
 * Star Wars — the app's single full-page route, mounted at /apps/starwars.
 *
 * Search over the whole roster (one static JSON document, fetched once), a
 * card grid, and a detail panel that opens above it. Every record arrives
 * complete, so selecting a character costs nothing: no second request, and no
 * detail-loading state to get wrong.
 */
import { useEffect, useMemo, useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { fetchCharacters, type Character } from '../api/starwarsApi';
import CharacterCard from '../components/CharacterCard';
import CharacterDetail from '../components/CharacterDetail';

const PAGE_SIZE = 48;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** An aborted fetch is a superseded one, not a failure worth showing. */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function CharactersPage() {
  const { ui } = useFlowContext();
  const { PageTemplate } = ui?.templates ?? {};
  const { Paper, Stack, Typography, Box, SearchField, Button, Alert } = ui ?? {};

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // The roster, once. Aborted on unmount so a route change mid-flight doesn't
  // set state on a gone component.
  useEffect(() => {
    const controller = new AbortController();

    fetchCharacters(controller.signal)
      .then((rows) => {
        setCharacters(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!isAbort(cause)) {
          setError(message(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  // A new search starts at the top of its own result set.
  useEffect(() => setVisible(PAGE_SIZE), [query]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return characters;
    }

    // `haystack` is name, species, homeworld, gender, droid hardware and every
    // affiliation, lowercased once when the index was built — so searching
    // "jedi", "tatooine" or "rodian" works as well as searching a name.
    return characters.filter((character) => character.haystack.includes(needle));
  }, [characters, query]);

  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? null,
    [characters, selectedId],
  );

  // The one sanctioned fallback: the host kit is unavailable, so there is
  // nothing theme-correct to render with.
  if (!PageTemplate || !Paper || !Stack || !Typography || !Box) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Star Wars</h1>
      </div>
    );
  }

  const status = loading
    ? 'Loading the roster...'
    : `${filtered.length} of ${characters.length} characters${
        shown.length < filtered.length ? ` — showing ${shown.length}` : ''
      }`;

  return (
    <PageTemplate
      title='Star Wars'
      subtitle='Search the characters of the saga, and make one your avatar'
      breadcrumbs={[{ label: 'Apps', url: '/apps' }, { label: 'Star Wars' }]}
      // Descriptors, not JSX — the host renders these as themed buttons.
      actions={[
        {
          label: 'Reset',
          icon: 'mdi:refresh',
          variant: 'secondary',
          onClick: () => {
            setQuery('');
            setSelectedId(null);
            setVisible(PAGE_SIZE);
          },
        },
      ]}
    >
      <Stack spacing={3}>
        <Paper>
          <Stack spacing={2}>
            {SearchField ? (
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder='Search by name, species, homeworld or allegiance'
                fullWidth
              />
            ) : null}
            <Typography variant='caption' color='text.secondary'>
              {status}
            </Typography>
          </Stack>
        </Paper>

        {error && Alert ? (
          <Alert severity='error'>
            Could not load the character index: {error}
          </Alert>
        ) : null}

        {selected ? (
          <CharacterDetail
            character={selected}
            onClose={() => setSelectedId(null)}
          />
        ) : null}

        {!loading && filtered.length === 0 ? (
          <Paper>
            <Typography variant='body2' color='text.secondary'>
              No character matches "{query}".
            </Typography>
          </Paper>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(6, 1fr)',
            },
            gap: 2,
          }}
        >
          {shown.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              selected={character.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </Box>

        {shown.length < filtered.length && Button ? (
          <Stack direction='row' justifyContent='center'>
            <Button onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Load more
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </PageTemplate>
  );
}
