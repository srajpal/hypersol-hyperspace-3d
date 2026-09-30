import type { MessageBoxSyncOptions } from 'electron';

/**
 * "Leave this page?" (review of 2026-09-30, M4). A page with a
 * beforeunload handler, once the person has clicked or typed in it, asks
 * to be kept when its tab is about to go elsewhere or reload: a webmail
 * draft, a half-filled form. Electron then cancels the navigation unless
 * the app says otherwise, and the app said nothing, so typing an address,
 * Back, and Reload did nothing at all on such a page, and a hostile page
 * could hold a tab for good. Now the person is asked, as in any browser.
 */
export const LEAVE_PAGE: MessageBoxSyncOptions = {
  type: 'question',
  title: 'Leave this page?',
  message: 'Leave this page?',
  detail: 'Changes you made may not be saved.',
  buttons: ['Leave', 'Stay'],
  defaultId: 0,
  // Escape, or closing the box, keeps the page.
  cancelId: 1,
  noLink: true,
};

/**
 * Asks, and answers true to leave.
 * @param show Shows the box on the main window and answers with the
 *   index of the button pressed (dialog.showMessageBoxSync).
 */
export function confirmLeave(show: (options: MessageBoxSyncOptions) => number): boolean {
  return show(LEAVE_PAGE) === 0;
}
