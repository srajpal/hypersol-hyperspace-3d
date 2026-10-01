/**
 * The app's own requests in the web pages' sessions while they are under
 * way, by address: list updates, the DNS check, and a tab's favicon once
 * the shield has passed it. They come from no tab, as a service worker's
 * requests do, and are the only such requests the shield does not look at.
 */
export class OwnRequests {
  private readonly under = new Map<string, number>();

  has(url: string): boolean {
    return this.under.has(url);
  }

  /** Runs one of the app's own fetches; its address is exempt until the answer's headers arrive or it fails. */
  async run<T>(url: string, fetch: () => Promise<T>): Promise<T> {
    this.under.set(url, (this.under.get(url) ?? 0) + 1);
    try {
      return await fetch();
    } finally {
      const left = (this.under.get(url) ?? 1) - 1;
      if (left > 0) this.under.set(url, left);
      else this.under.delete(url);
    }
  }
}
