export interface OpenLibraryConfig { baseUrl: string }
export interface OpenLibraryBook { title: string; authors: string[]; coverUrl: string | null }

interface OlVolume {
  title?: string;
  authors?: { name?: string }[];
  cover?: { large?: string; medium?: string; small?: string };
}

export class OpenLibraryBooks {
  constructor(private cfg: OpenLibraryConfig, private fetchImpl: typeof fetch = fetch) {}

  async lookupIsbn(isbn: string): Promise<OpenLibraryBook | null> {
    try {
      const url = new URL(`${this.cfg.baseUrl}/api/books`);
      url.searchParams.set("bibkeys", `ISBN:${isbn}`);
      url.searchParams.set("format", "json");
      url.searchParams.set("jscmd", "data");
      const res = await this.fetchImpl(url.toString());
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, OlVolume>;
      const v = data[`ISBN:${isbn}`];
      if (!v || !v.title) return null;
      const cover = v.cover ?? {};
      return {
        title: v.title,
        authors: (v.authors ?? []).map((a) => a.name).filter((n): n is string => Boolean(n)),
        coverUrl: cover.large ?? cover.medium ?? cover.small ?? null,
      };
    } catch { return null; }
  }

  async coverByIsbn(isbn: string): Promise<string | null> {
    const book = await this.lookupIsbn(isbn);
    return book?.coverUrl ?? null;
  }
}
