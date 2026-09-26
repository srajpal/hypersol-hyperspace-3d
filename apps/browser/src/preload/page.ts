/**
 * Trusted preload for every web page. The main process puts this in place
 * of any preload a webview asks for (see main/security.ts).
 *
 * It runs the ad blocker's page script (element hiding: it asks the main
 * process which page elements the filter lists hide, and watches the page
 * for new ones; main/privacy/index.ts answers only web pages, and nothing
 * for a paused site), and the layers view with image discovery
 * (preload/layers.ts, milestone 5), and the password manager's page side
 * (preload/passwords.ts, milestone 9). It exposes nothing to pages.
 */
import '@ghostery/adblocker-electron-preload';
import './layers';
import './passwords';
