import { describe, it, expect } from "vitest";
import { parsePersonId, personHref } from "@/lib/person";

describe("personHref / parsePersonId", () => {
  it("construit un lien tmdb avec le nom encodé", () => {
    expect(personHref({ tmdbId: 6384, name: "Keanu Reeves" }, "tmdb"))
      .toBe("/personne/tmdb-6384?name=Keanu%20Reeves");
  });
  it("construit un lien book", () => {
    expect(personHref({ tmdbId: 99, name: "William Gibson" }, "book"))
      .toBe("/personne/book-99?name=William%20Gibson");
  });
  it("décode un id de route valide", () => {
    expect(parsePersonId("tmdb-6384")).toEqual({ source: "tmdb", externalId: 6384 });
    expect(parsePersonId("book-99")).toEqual({ source: "book", externalId: 99 });
  });
  it("renvoie null si l'id est invalide", () => {
    expect(parsePersonId("foo-1")).toBeNull();
    expect(parsePersonId("tmdb-")).toBeNull();
    expect(parsePersonId("tmdb-abc")).toBeNull();
  });
});
