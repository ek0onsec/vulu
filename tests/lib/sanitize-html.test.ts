import { describe, it, expect } from "vitest";
import { sanitizeDescription } from "@/lib/sanitize-html";

describe("sanitizeDescription", () => {
  it("garde les balises de mise en forme autorisées", () => {
    expect(sanitizeDescription("<p>Un <i>roman</i> <b>culte</b>.</p>")).toBe("<p>Un <i>roman</i> <b>culte</b>.</p>");
  });
  it("supprime <script> et son contenu", () => {
    expect(sanitizeDescription('<p>Hi</p><script>alert("xss")</script>')).toBe("<p>Hi</p>");
  });
  it("retire les gestionnaires d'événements (onclick…)", () => {
    expect(sanitizeDescription('<p onclick="evil()">x</p>')).toBe("<p>x</p>");
  });
  it("neutralise les href javascript:", () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
  it("garde un href http(s) sûr", () => {
    expect(sanitizeDescription('<a href="https://ex.com">x</a>')).toContain('href="https://ex.com"');
  });
  it("retire les balises inconnues mais garde le texte", () => {
    expect(sanitizeDescription("<div><marquee>texte</marquee></div>")).toBe("texte");
  });
  it("retire img/iframe (pas de vecteur de chargement externe)", () => {
    expect(sanitizeDescription('<img src=x onerror=alert(1)><iframe src="//evil"></iframe>texte')).toBe("texte");
  });
});
