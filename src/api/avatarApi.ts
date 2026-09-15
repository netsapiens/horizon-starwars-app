/**
 * Adopting a character's portrait as the signed-in user's avatar.
 *
 * This is the app's only WRITE against the platform. It goes through
 * `horizonContext.api` — the host-brokered, audited proxy — so the app never
 * sees the user's token and the call is attributed to it on the Registered
 * Apps page. The upload is `multipart/form-data` with the field named `file`,
 * because the avatar endpoint reads a PHP file upload; the host's api client
 * passes a `FormData` body to `fetch` untouched and sets no `Content-Type`,
 * letting the browser write the multipart boundary.
 *
 * The interesting part is getting a square image out of a film still.
 *
 * The endpoint rejects anything that is not 1:1 with a 400 rather than
 * letterboxing it, and these portraits are tall. So the app crops one here,
 * in a canvas, before uploading. Two consequences worth knowing:
 *
 *   - The bytes must be READABLE cross-origin. Painting a remote image into a
 *     canvas taints it and `toBlob` then throws a SecurityError — which is why
 *     this fetches the image to a Blob first: a Blob is same-origin, so the
 *     canvas stays clean and the only requirement is that the image host sends
 *     CORS headers on the fetch. Fandom's CDN normally does; if a portal ever
 *     gets a failure here, INSTALL.md has the same-origin proxy that removes
 *     the question entirely.
 *   - Displaying the image never needs any of this. An <img> renders a
 *     cross-origin picture happily; only reading its pixels is restricted. So
 *     the page works even where the avatar button cannot.
 */
import type { HorizonApiClient, HorizonUser } from '@netsapiens/horizon-sdk';

export interface AvatarTarget {
  domain: string;
  extension: string;
}

/**
 * Faces sit above the middle of a portrait, so a strictly centred crop of a
 * tall still tends to frame a torso. Biasing the window toward the top is the
 * difference between a demo people enjoy and one where everyone is a jacket.
 */
const VERTICAL_BIAS = 0.15;

/** Uploaded as JPEG: these are photographs, and PNG would be ~6x the bytes. */
const MIME = 'image/jpeg';
const QUALITY = 0.92;

/**
 * The avatar path needs a domain AND an extension, and `extension` is optional
 * on `HorizonUser` — a session without one (a platform admin who is not a
 * subscriber) has no avatar to set. Resolving it in one place lets the page
 * disable the control rather than discovering this in a 404.
 */
export function avatarTargetFor(
  user: HorizonUser | undefined,
): AvatarTarget | null {
  if (!user?.domain || !user?.extension) {
    return null;
  }

  return { domain: user.domain, extension: user.extension };
}

/**
 * Fetch an image and return the largest square from it: horizontally centred,
 * vertically biased toward the top.
 */
export async function squareCropOf(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<Blob> {
  // No credentials: this is a public image, and sending any would be both
  // pointless and a bundle-verification finding.
  const response = await fetch(imageUrl, { signal });

  if (!response.ok) {
    throw new Error(
      `Could not download the portrait (${response.status} ${response.statusText})`,
    );
  }

  const source = await response.blob();
  const bitmap = await createImageBitmap(source);

  try {
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) * VERTICAL_BIAS;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('This browser would not provide a 2D canvas context');
    }

    context.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('The cropped image could not be encoded')),
        MIME,
        QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}

/** Crop the image to a square and upload it as this user's avatar. */
export async function setUserAvatar(
  api: HorizonApiClient,
  target: AvatarTarget,
  imageUrl: string,
  filename: string,
  signal?: AbortSignal,
): Promise<void> {
  const square = await squareCropOf(imageUrl, signal);

  const body = new FormData();
  body.append('file', square, filename);

  await api.post(`/domains/${target.domain}/users/${target.extension}/avatar`, body);
}

/**
 * Turn a failure into something a reader can act on.
 *
 * Three actually happen: the image CDN not allowing a cross-origin read (a
 * bare TypeError from fetch, with the reason only in the console), the
 * platform's API-write master capability being off (403 from the proxy before
 * the call leaves the browser), and a rejected image (400).
 */
export function describeAvatarFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'The image host would not allow this page to read the picture, so it could not be cropped. See INSTALL.md — a same-origin proxy on the portal fixes it.';
  }

  if (error instanceof TypeError || /failed to fetch|networkerror/i.test(message)) {
    return `Could not read the portrait from its CDN (${message}). That is usually a missing CORS header on the image host, or the portal's Content-Security-Policy — INSTALL.md has the same-origin proxy that removes both.`;
  }

  if (/\b403\b|forbidden|permission/i.test(message)) {
    return `${message} — API write access may be disabled for SDK apps on this platform (Platform -> UI SDK Management).`;
  }

  return message;
}
