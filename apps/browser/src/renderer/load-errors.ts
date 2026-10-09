/**
 * Plain-language error cards for pages that fail. Codes are Chromium's
 * net error codes as reported by the webview's did-fail-load event.
 */

export type LoadErrorKind = 'not-found' | 'connection' | 'certificate' | 'crashed' | 'blocked' | 'dns-blocked' | 'https-only' | 'other';

export interface LoadErrorCard {
  kind: LoadErrorKind;
  title: string;
  message: string;
  /** Retry is offered except where retrying cannot help safely. */
  canRetry: boolean;
  /** A way through the card: open a blocked page once, use the network's DNS for now, or continue over plain HTTP. */
  action?: 'open-anyway' | 'use-network-dns' | 'continue-http';
}

const NOT_FOUND = new Set([-105, -137]); // NAME_NOT_RESOLVED, NAME_RESOLUTION_FAILED
/** Chromium's code for a request the browser itself cancelled: here, the privacy shield. */
export const ERR_BLOCKED_BY_CLIENT = -20;

/** True for failures where the name could not be looked up (worth checking whether encrypted DNS is blocked). */
export function isLookupFailure(code: number): boolean {
  return NOT_FOUND.has(code);
}
const CONNECTION = new Set([
  -7, // TIMED_OUT
  -21, // NETWORK_CHANGED
  -100, // CONNECTION_CLOSED
  -101, // CONNECTION_RESET
  -102, // CONNECTION_REFUSED
  -104, // CONNECTION_FAILED
  -106, // INTERNET_DISCONNECTED
  -109, // ADDRESS_UNREACHABLE
  -118, // CONNECTION_TIMED_OUT
  -324, // EMPTY_RESPONSE
]);

/** Chromium reserves -200 to -299 for certificate errors. */
function isCertificateError(code: number): boolean {
  return code <= -200 && code >= -299;
}

export function describeLoadError(code: number, description: string): LoadErrorCard {
  if (NOT_FOUND.has(code)) {
    return {
      kind: 'not-found',
      title: "We couldn't find that site",
      message: 'Check the address for typing mistakes.',
      canRetry: true,
    };
  }
  if (CONNECTION.has(code)) {
    return {
      kind: 'connection',
      title: "Couldn't connect",
      message: 'The site did not answer. Check your connection, or try again in a moment.',
      canRetry: true,
    };
  }
  if (code === ERR_BLOCKED_BY_CLIENT) return BLOCKED_CARD;
  if (isCertificateError(code)) {
    return {
      kind: 'certificate',
      title: "This site's certificate isn't valid",
      message: `Someone could be pretending to be this site, so HyperSpace 3D won't open it. (${description})`,
      canRetry: false,
    };
  }
  return {
    kind: 'other',
    title: "Couldn't load this page",
    message: `${description || 'Unknown error'} (${code})`,
    canRetry: true,
  };
}

export const BLOCKED_CARD: LoadErrorCard = {
  kind: 'blocked',
  title: 'The shield blocked this page',
  message: 'This address is on a list of ad or tracking sites. You can open it anyway, just this once, in this tab.',
  canRetry: false,
  action: 'open-anyway',
};

export const DNS_BLOCKED_CARD: LoadErrorCard = {
  kind: 'dns-blocked',
  title: 'Encrypted DNS is blocked on this network',
  message:
    "This network won't let HyperSpace 3D look up sites privately. You can use this network's own DNS until you close the app; the network can then see which sites you visit.",
  canRetry: true,
  action: 'use-network-dns',
};

/**
 * HTTPS-only (milestone 26, GitHub issue #24): the site could not be
 * reached over HTTPS, or sent the page back to plain HTTP. Nothing goes
 * over HTTP until the person continues; Retry tries HTTPS again.
 */
export const HTTPS_ONLY_CARD: LoadErrorCard = {
  kind: 'https-only',
  title: 'This site does not offer a secure connection',
  message:
    'HyperSpace 3D asked for this page over HTTPS, and the site did not answer that way. If you continue, others on the network can see and change what you send and receive on this site. You can continue for this site until you close the browser.',
  canRetry: true,
  action: 'continue-http',
};

export const CRASHED_CARD: LoadErrorCard = {
  kind: 'crashed',
  title: 'This page went dark',
  message: 'Something went wrong while showing this page.',
  canRetry: true,
};
