import sanitizeHtml from "sanitize-html";

/**
 * Allowlist stricte pour les descriptions d'œuvres (HTML venant de catalogues externes
 * comme Google Books). Seules des balises de mise en forme inoffensives sont conservées ;
 * scripts, styles, iframes, images, attributs d'événements et schémas d'URL dangereux
 * (javascript:) sont retirés. Empêche toute injection XSS au rendu.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "blockquote", "a"],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  // Les balises non autorisées sont retirées, mais leur texte est conservé.
  disallowedTagsMode: "discard",
};

export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
