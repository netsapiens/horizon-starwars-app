# Horizon Star Wars App

A Horizon federated app (Webpack Module Federation remote, built with
[`@netsapiens/flow-sdk`](https://www.npmjs.com/package/@netsapiens/flow-sdk))
that adds a **Star Wars** page to the Horizon portal's **Apps** menu, alongside
**Example CRM** and the [Pokemon app](https://github.com/netsapiens/horizon-pokemon-app).

Same shape as that app — own repo, own `remoteEntry.js`, published to GitHub
Pages by CI — with a different public data source and the same single write:
adopting an image as the signed-in user's avatar.

- Search ~87 characters and droids by name, species, homeworld or allegiance.
  "jedi", "tatooine" and "rodian" all work, because the index is searched
  across every field rather than just the name.
- A responsive card grid. Clicking a card opens a detail panel above it:
  portrait, species and gender, homeworld, born/died in BBY/ABY, height and
  mass, masters and apprentices, affiliations, and a link to Wookieepedia.
  Droids get their hardware — model, manufacturer — where a person gets a
  biography.
- **Set as my avatar** crops the portrait to a square and uploads it as the
  signed-in user's avatar, through the host's audited API proxy.
- Every visible element comes from `flowContext.ui`, so the page re-themes
  live with the portal's dark/light toggle.

## Architecture

```
Browser (https://<portal>/apps/starwars)
  └─ Horizon host loads the remote from the CDN
       https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js
       └─ one fetch of the character index (static JSON, ~57 KB)
            https://raw.githubusercontent.com/akabab/starwars-api/…/all.json
       └─ portraits displayed straight from Fandom's image CDN
       └─ POST …/avatar through flowContext.api   (the only write)
```

The index is one document holding complete records, so there is no
per-character request and no detail-loading state. Reads need nothing from the
platform; the avatar button is the only thing that does.

### Why this data source

[akabab/starwars-api](https://github.com/akabab/starwars-api) is static JSON on
`raw.githubusercontent.com`, which sends `Access-Control-Allow-Origin: *`, and
its records are rich — species, homeworld, affiliations, master/apprentice
lineage, birth and death.

[SWAPI](https://swapi.info/) (and swapi.dev, swapi.tech) carries no images at
all, and this app is about the picture. The [Star Wars Databank
API](https://starwars-databank.vercel.app/) has 964 characters but only
name/description/image, on a free instance that cold-starts.

Note what does NOT exist: a Star Wars equivalent of
[PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokemon sprites are game
assets a community vendored into a repository; Star Wars portraits are
photographic stills owned by Lucasfilm, so every open dataset hotlinks someone
else's CDN. That is the origin of the one caveat below.

## Setting an avatar

**Set as my avatar** uploads to `POST /domains/{domain}/users/{extension}/avatar`
through `flowContext.api`, so the app never sees the user's token and the
call is attributed to it on the Registered Apps page. `src/api/avatarApi.ts`
has the contract. Four things govern whether it works:

- **The image is cropped to a square first.** The endpoint rejects anything
  that is not 1:1 with a 400 rather than letterboxing it, and these portraits
  are tall. The crop is horizontally centred but biased toward the top, because
  a strictly centred square of a tall portrait frames a torso rather than a
  face.
- **The portrait's bytes must be readable cross-origin.** The app fetches the
  image to a Blob and crops from that — a Blob is same-origin, so the canvas is
  never tainted and `toBlob` cannot throw. That leaves one requirement: the
  image CDN must send CORS headers on the fetch. If a portal ever fails here,
  INSTALL.md has the same-origin proxy that removes the question. **Displaying**
  a portrait never needs any of this, so the page works either way.
- **The platform's API-write master capability must be enabled** for SDK apps
  (Platform -> UI SDK Management). With it off, the host's proxy answers 403
  before the request leaves the browser, and the panel says so.
- **The session needs an extension.** `FlowUser.extension` is optional; a
  platform admin who is not a subscriber has no avatar to set, and the button
  is disabled with a note rather than failing at the API.

The upload is `multipart/form-data` with the field named `file`, because the
endpoint reads a PHP file upload. The host's api client passes a `FormData`
body through to `fetch` untouched and sets no `Content-Type`, letting the
browser write the multipart boundary.

The host's top bar reads the avatar once per page load, so a new picture
appears on the next load rather than instantly.

## Hosting

Served from **GitHub Pages**, like `horizon-sdk-demo` and the Pokemon app:

```
https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js
```

Opening that URL in a browser shows a blank page — this is a **headless
remote**. It renders nothing on its own; it only mounts inside the Horizon host.

`.github/workflows/deploy-pages.yml` runs on every push to `main`: `npm ci` ->
version guard -> `npm run typecheck` -> `npm run build` -> `npm run verify` ->
`.nojekyll` -> upload -> `actions/deploy-pages`. The repo needs **Settings ->
Pages -> Source: GitHub Actions**.

The version guard fails the build when `src/`, `webpack.config.js`,
`package.json` or the lockfile changed while `version` did not. The remote
entry URL is stable, so `version` is the only thing that tells the platform to
re-verify: new bytes under an unchanged version leave it enforcing the OLD hash
at the same URL, every host fails its integrity check, and the app silently
stops appearing with no verdict to explain it.

## Registration

| field            | value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| id               | `horizon-starwars` (derived server-side, not sent)                |
| webpack_module   | `horizonStarwars` (must equal the MF name in webpack.config.js)   |
| remote_entry_url | `https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js` |
| reseller         | `*`                                                               |
| enabled          | `yes`                                                             |

Registering is not enough on its own: a newly registered app sits at
verification status `none` and renders nowhere until the bundle is deployed and
verified. INSTALL.md sections 2-3 have both calls.

## Releasing an update

```bash
# 1. change code, and bump `version` in package.json — CI fails without it
# 2. commit and push to main
# 3. gh run watch          # Pages must finish BEFORE the next step
# 4. Registered Apps -> Deploy on the horizon-starwars row
# 5. read the verdict: approved | flagged -> loads; rejected -> fix and repeat
```

## Develop

```bash
npm install
npm run dev        # remoteEntry.js on http://localhost:5009/remoteEntry.js
npm run typecheck
npm run build
npm run verify     # the same bundle checks the platform runs
```

## Route

| field      | value                                          |
| ---------- | ---------------------------------------------- |
| route id   | `starwars-characters`                          |
| parentPath | `/apps` (the Apps menu — Example CRM's menu)   |
| path       | `starwars` -> `/apps/starwars`                 |
| placement  | `{ last: true }`                               |

No `requiredScopes`, matching Example CRM: `/apps` carries no section floor,
the page reads only public data, and its one write acts on the caller's own
avatar. **A page that reads customer data must declare a tier instead.**

## Credits

Character data from [akabab/starwars-api](https://github.com/akabab/starwars-api)
(MIT), sourced from Wookieepedia; portraits are served from Fandom's image CDN
and are not redistributed by this repository. Star Wars and its characters are
trademarks of Lucasfilm Ltd.; this is an unofficial SDK demo, not affiliated
with or endorsed by Lucasfilm or Disney, and the imagery is theirs. Treat it as
a demo of the Horizon SDK rather than something to ship to customers.
