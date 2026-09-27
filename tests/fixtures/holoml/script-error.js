// The browser's tests (milestone 17): a script that fails at once.
window.__before = true;
throw new Error('boom from the page script');
