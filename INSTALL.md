# Installing the Star Wars app on a Horizon instance

The bundle is instance-independent — `publicPath: 'auto'`, no hostnames baked
in — and published once, to GitHub Pages, for every instance. Installing it on
a portal is two API calls and no files: **register**, then **deploy** (which is
what verifies it).

## Prerequisites

- Horizon v46+ with SDK support (`NsApi.horizon_extensions` table exists).
- `*.github.io` in `approved_cdn_origins` (`NsApi.horizon_extension_settings`).
  It is what `horizon-sdk-demo` loads through, so on most instances this is
  already true. Failure here is silent in the UI — look for
  `[HorizonAppsLoader]` in the browser console.
- Browsers reaching the portal can reach `raw.githubusercontent.com` (the
  character index) and Fandom's image CDN (the portraits).
- For the **Set as my avatar** button only: the API-write master capability
  enabled for SDK apps, and `avatar` absent from `api_write_deny_resources`.
  Both are platform-global settings; everything else in the app is read-only
  against public data and needs neither.
- A token with write scope. `reseller: *` (platform-global) requires a super
  user; a reseller-scoped token can only create within its own reseller.

## 1. Publish the bundle

Pushing to `main` does this — see the README. Confirm what the platform will
fetch:

```bash
curl -sI https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js \
  | grep -iE 'http/|content-type|access-control-allow-origin'
# -> 200, application/javascript, access-control-allow-origin: *
```

## 2. Register the app

Portal **Platform -> UI SDK Management -> Registered Apps -> Add App** is the
short path — it registers and gives you the **Deploy** button step 3 needs.

The API equivalent (note the `/registry` segment — `POST /ui-extensions` is a
runtime read surface and returns 405):

```bash
curl -X POST "https://<PORTAL_FQDN>/ns-api/v2/ui-extensions/registry" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "name": "Star Wars",
    "description": "Star Wars character browser, with avatar adoption",
    "version": "1.0.0",
    "remote_entry_url": "https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js",
    "webpack_module": "horizonStarwars",
    "enabled": "yes"
  }'
```

Required fields are `name`, `remote_entry_url` and `webpack_module`; everything
else has a default. **Do not send `id`** — the server derives it as the
kebab-case of `webpack_module` (`horizonStarwars` -> `horizon-starwars`).
`webpack_module` is unique platform-wide (409 on a duplicate) and immutable
once registered.

## 3. Deploy the bundle (required — this is what verifies it)

A registered app sits at `verification_status: none`, is filtered out of
`/ui-extensions?purpose=runtime` before the browser sees it, and renders
nowhere. One call fetches, verifies, hashes and promotes:

```bash
curl -X POST "https://<PORTAL_FQDN>/ns-api/v2/ui-extensions/registry/horizon-starwars/deploy?synchronous=yes" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "remote_entry_url": "https://netsapiens.github.io/horizon-starwars-app/remoteEntry.js" }'
```

or press **Deploy** on the app's row in Registered Apps, which does the same
thing and picks the next free version itself.

Reading the response:

- `status` — `approved` and `flagged` both load; only `rejected` blocks.
  A `size-delta` flag on a first submission is expected.
- `promoted: true` is the bit that matters; `synchronous=yes` adds `landed`,
  and `landed: false` means "not observed within the poll budget", not failed.
- `unchanged: true` means the fetched bytes hash to the current pin — a success.
- `429` is the per-extension submission rate limit. Wait a minute.

## 4. Verify in the portal

Hard-refresh: **Star Wars** appears in the **Apps** menu (deep link:
`https://<PORTAL_FQDN>/apps/starwars`).

Then click a character and press **Set as my avatar**. Success says so in the
panel; the top bar shows the new picture on the next page load, because the
host reads the avatar once per load.

## Updating

Bump `version` in `package.json`, push to `main`, wait for the Pages deploy to
finish, then deploy again (step 3). Between the publish and the deploy the
platform still pins the previous hash while the CDN serves new bytes, so keep
the gap short.

## Appendix: if the portrait cannot be read

The avatar button fetches the portrait's bytes so it can crop them to a square.
That read — unlike simply displaying the image — needs the image host to allow
it. Two things can block it, and the panel reports both:

- **The image CDN sends no CORS header** for this origin. The fetch fails with
  a bare `TypeError`, with the real reason only in the console.
- **The portal's Content-Security-Policy** restricts `connect-src` or
  `img-src`.

Either way, putting the images on the portal's own origin removes the question:

```apache
<Location "/swimages/">
    ProxyPass "https://static.wikia.nocookie.net/" timeout=30
    ProxyPassReverse "https://static.wikia.nocookie.net/"
</Location>
```

Then rewrite each record's `image` in `src/api/starwarsApi.ts` to that prefix
as the index is mapped, and rebuild. Needs `proxy_http` and proxy SSL support.
Consider caching: these are somebody else's images and somebody else's
bandwidth.

A portal that cannot allow either is still fine for the rest of the app — the
grid, the search and the detail panel all work, and only the avatar button
fails, with an explanation.
