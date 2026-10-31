import DOMPurify from 'dompurify';

// Die KI-Analyse liefert HTML, in das auch fremdbestimmte Inhalte (z. B. GSC-Suchbegriffe)
// einfließen. Erlaubt sind nur die Tags und Klassen, die der Prompt vorgibt.
const ALLOWED_TAGS = ['h3', 'h4', 'p', 'ul', 'ol', 'li', 'span', 'div', 'strong', 'em', 'b', 'i', 'br'];
const ALLOWED_ATTR = ['class'];

export function sanitizeAiHtml(html: string): string {
  // Inhalte entstehen erst im Browser per Stream; auf dem Server gibt es nichts zu rendern.
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
