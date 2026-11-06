/**
 * One card in the roster grid: portrait, name, species.
 *
 * The portrait is displayed straight from the source CDN — an <img> renders a
 * cross-origin picture with no special handling. Only READING its pixels, as
 * the avatar upload does, needs anything more (see api/avatarApi.ts).
 */
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { toLabel, type Character } from '../api/starwarsApi';

interface CharacterCardProps {
  character: Character;
  selected: boolean;
  onSelect: (id: number) => void;
}

export default function CharacterCard({
  character,
  selected,
  onSelect,
}: CharacterCardProps) {
  const { ui } = useFlowContext();
  const { Card, CardContent, Stack, Typography, Box, Icon } = ui ?? {};

  // Records whose id's portrait failed, not what to show — so a card reused
  // for a different character cannot inherit the previous one's failure.
  const [imageMissing, setImageMissing] = useState<number | null>(null);

  if (!Card || !CardContent || !Stack || !Typography || !Box) {
    return null;
  }

  const broken = imageMissing === character.id;

  return (
    <Card
      onClick={() => onSelect(character.id)}
      sx={{
        height: '100%',
        ...(selected
          ? { borderColor: 'primary.main', borderWidth: 2, borderStyle: 'solid' }
          : null),
      }}
    >
      <CardContent>
        <Stack spacing={1}>
          <Box
            sx={{
              height: 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'background.elevation1',
            }}
          >
            {broken ? (
              Icon ? (
                <Icon
                  icon='mdi:account-question'
                  sx={{ fontSize: 40, color: 'text.disabled' }}
                />
              ) : null
            ) : (
              <Box
                component='img'
                src={character.image}
                alt={character.name}
                loading='lazy'
                onError={() => setImageMissing(character.id)}
                // `cover` on a portrait crops to the card's box the same way
                // the avatar crop will — what you see is close to what you get.
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </Box>
          <Stack spacing={0.25}>
            <Typography variant='subtitle2' noWrap>
              {character.name}
            </Typography>
            <Typography variant='caption' color='text.secondary' noWrap>
              {character.species ? toLabel(character.species) : 'Unknown'}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
