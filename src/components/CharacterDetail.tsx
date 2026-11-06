/**
 * The detail panel above the grid: portrait, biography, affiliations — and the
 * one action this app offers, adopting the portrait as the user's avatar.
 */
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import {
  avatarTargetFor,
  describeAvatarFailure,
  setUserAvatar,
} from '../api/avatarApi';
import { slugify, toLabel, type Character } from '../api/starwarsApi';

interface CharacterDetailProps {
  character: Character;
  onClose: () => void;
}

/**
 * The outcome of an avatar upload, tagged with the character it was for.
 *
 * The tag is the point: this panel stays mounted when the selection changes,
 * so an untagged "now your avatar" would still be sitting there under the next
 * character's name, claiming something that never happened.
 */
interface AvatarResult {
  id: number;
  ok: boolean;
  message: string;
}

export default function CharacterDetail({
  character,
  onClose,
}: CharacterDetailProps) {
  const { api, ui, user } = useFlowContext();
  const { Paper, Stack, Typography, Chip, Box, Button, Divider, Alert } =
    ui ?? {};

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [result, setResult] = useState<AvatarResult | null>(null);

  const target = avatarTargetFor(user);
  const uploading = uploadingId === character.id;
  const shownResult = result?.id === character.id ? result : null;

  const adoptAsAvatar = async () => {
    if (!api || !target) {
      return;
    }

    const id = character.id;

    setUploadingId(id);
    setResult(null);

    try {
      await setUserAvatar(
        api,
        target,
        character.image,
        `${slugify(character.name)}.jpg`,
      );
      setResult({
        id,
        ok: true,
        message: `${character.name} is now your avatar. The top bar picks it up on the next page load.`,
      });
    } catch (error: unknown) {
      setResult({ id, ok: false, message: describeAvatarFailure(error) });
    } finally {
      setUploadingId((current) => (current === id ? null : current));
    }
  };

  if (!Paper || !Stack || !Typography || !Box) {
    return null;
  }

  const facts: { label: string; value: string }[] = [];
  if (character.homeworld) {
    facts.push({ label: 'Homeworld', value: toLabel(character.homeworld) });
  }
  // `born`/`died` arrive display-ready from the API layer — a year turned into
  // BBY/ABY, or the source's own free text where it had no number.
  if (character.born) {
    facts.push({
      label: 'Born',
      value: character.bornLocation
        ? `${character.born}, ${toLabel(character.bornLocation)}`
        : character.born,
    });
  }
  if (character.died) {
    facts.push({
      label: 'Died',
      value: character.diedLocation
        ? `${character.died}, ${toLabel(character.diedLocation)}`
        : character.died,
    });
  }
  if (character.height !== undefined) {
    facts.push({ label: 'Height', value: `${character.height.toFixed(2)} m` });
  }
  if (character.mass !== undefined) {
    facts.push({ label: 'Mass', value: `${character.mass} kg` });
  }
  // Droid records carry hardware where a person carries a biography.
  if (character.model) {
    facts.push({ label: 'Model', value: character.model });
  }
  if (character.manufacturer) {
    facts.push({ label: 'Manufacturer', value: character.manufacturer });
  }
  if (character.cybernetics) {
    facts.push({ label: 'Cybernetics', value: character.cybernetics });
  }

  // Always arrays by the time they reach here — the API layer coerces the
  // source's mixed string/array shapes so this cannot call .join on a string.
  const lineages: { label: string; value: string[] }[] = [];
  if (character.masters.length) {
    lineages.push({ label: 'Masters', value: character.masters });
  }
  if (character.apprentices.length) {
    lineages.push({ label: 'Apprentices', value: character.apprentices });
  }
  if (character.equipment.length) {
    lineages.push({ label: 'Equipment', value: character.equipment });
  }

  return (
    <Paper>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: 220 },
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            component='img'
            src={character.image}
            alt={character.name}
            sx={{
              maxWidth: 220,
              maxHeight: 300,
              objectFit: 'contain',
              borderRadius: 1,
            }}
          />
        </Box>

        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction='row'
            spacing={2}
            alignItems='flex-start'
            justifyContent='space-between'
          >
            <Stack spacing={0.5}>
              <Typography variant='h5'>{character.name}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {[character.species, character.gender, character.class]
                  .filter(Boolean)
                  .map((value) => toLabel(String(value)))
                  .join(' · ') || 'Unknown'}
              </Typography>
            </Stack>

            {Button ? (
              <Stack direction='row' spacing={1} flexShrink={0}>
                <Button
                  onClick={adoptAsAvatar}
                  disabled={uploading || !api || !target}
                >
                  {uploading ? 'Setting...' : 'Set as my avatar'}
                </Button>
                <Button variant='text' onClick={onClose}>
                  Close
                </Button>
              </Stack>
            ) : null}
          </Stack>

          {!target ? (
            <Typography variant='caption' color='text.secondary'>
              Setting an avatar needs a signed-in extension; this session does
              not have one.
            </Typography>
          ) : null}

          {shownResult && Alert ? (
            <Alert severity={shownResult.ok ? 'success' : 'error'}>
              {shownResult.message}
            </Alert>
          ) : null}

          {Divider ? <Divider /> : null}

          <Stack direction='row' spacing={4} flexWrap='wrap' useFlexGap>
            {facts.map((fact) => (
              <Stack key={fact.label} spacing={0.25}>
                <Typography variant='caption' color='text.secondary'>
                  {fact.label}
                </Typography>
                <Typography variant='body2'>{fact.value}</Typography>
              </Stack>
            ))}
          </Stack>

          {lineages.map((lineage) => (
            <Stack key={lineage.label} spacing={0.5}>
              <Typography variant='caption' color='text.secondary'>
                {lineage.label}
              </Typography>
              <Typography variant='body2'>
                {lineage.value.join(', ')}
              </Typography>
            </Stack>
          ))}

          {character.affiliations.length > 0 && Chip ? (
            <Stack spacing={0.5}>
              <Typography variant='caption' color='text.secondary'>
                Affiliations
              </Typography>
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                {character.affiliations.map((affiliation) => (
                  <Chip key={affiliation} label={affiliation} />
                ))}
              </Stack>
            </Stack>
          ) : null}

          {character.formerAffiliations.length > 0 ? (
            <Typography variant='caption' color='text.secondary'>
              Formerly: {character.formerAffiliations.join(', ')}
            </Typography>
          ) : null}

          {character.wiki && Button ? (
            <Stack direction='row'>
              <Button
                variant='text'
                onClick={() =>
                  window.open(character.wiki, '_blank', 'noopener,noreferrer')
                }
              >
                Read more on Wookieepedia
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
