/**
 * The ad blocker's page scripts (GitHub issue #133): what the page preload
 * and the main process say to each other. Only the page preload and the main
 * process import this file (the shell's preload must share no module with the
 * page's).
 */

/** Sync: the filter lists' scripts for this page, each to run as it is, before the page's own -> string[] */
export const PAGE_SCRIPTS_CHANNEL = 'hypersol:page-scripts';
