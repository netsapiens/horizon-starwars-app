# Kit gaps — `horizonContext.ui`

Components this app reached for and did not find, what it used instead, and
what that cost. Recorded while building, when the reasoning was still live.

**Please share this file** with the Horizon SDK team — it is the input that
decides what gets added to the host UI kit.

## An image

- **Reached for:** `ui.Image` (a themed `<img>` with object-fit, a loading
  state and an `onError` fallback)
- **Used instead:** `<Box component='img' … />` in
  `src/components/CharacterCard.tsx` and `src/components/CharacterDetail.tsx`
- **Cost:** the card owns its own broken-image fallback as component state,
  about 10 lines. No behaviour lost — `Box` is the sanctioned bare primitive
  and an image carries no theme colours — but every app that shows a picture
  rewrites this.
- **Would have been solved by:** `<Image src fallback alt fit='cover' />`.

## A link

- **Reached for:** `ui.Link`, for the Wookieepedia reference on each character
- **Used instead:** a `Button variant='text'` calling
  `window.open(url, '_blank', 'noopener,noreferrer')`
  (`src/components/CharacterDetail.tsx`)
- **Cost:** it is a button pretending to be a link — no href, so no middle
  click, no "open in new tab", no status-bar preview, and a screen reader
  announces the wrong role. The alternative, a hand-rolled `<a>`, would be
  unthemed and is what RULE 1 exists to prevent.
- **Would have been solved by:** `<Link href external>` rendering a real
  anchor in the host's link style.

## A loading placeholder

- **Reached for:** `ui.Skeleton`
- **Used instead:** a `Typography` line ("Loading the roster...") in
  `src/pages/CharactersPage.tsx`
- **Cost:** the grid pops in rather than resolving from a wireframe, so the
  page jumps on first paint.
- **Would have been solved by:** `<Skeleton variant='rect' />`, or exposing the
  wireframe the widget frame already draws.

## Client-side pagination outside a grid

- **Reached for:** the `DatagridTemplate` footer, for a card grid
- **Used instead:** a `Load more` `Button` raising a visible-count state
- **Cost:** small — arguably the better interaction for a card wall. Noted
  because pagination is otherwise only available by adopting the whole grid
  template.
