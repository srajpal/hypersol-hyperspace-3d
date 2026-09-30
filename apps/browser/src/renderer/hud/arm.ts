/**
 * How long a prompt or notice ignores clicks and key presses after it
 * appears, in milliseconds (review of 2026-09-30, R3). A page chooses the
 * moment its permission prompt or its download's notice shows, always at
 * the same place; a page that has the person clicking there just then
 * would get "Allow", or "Open" on a file it just sent. Half a second is
 * too short to notice and long enough for a click already on its way to
 * land on nothing. The element carries `data-armed` once it takes
 * clicks, for the end-to-end checks; nothing changes for screen readers.
 */
export const ARM_MS = 500;
