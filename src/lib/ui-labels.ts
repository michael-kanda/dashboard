// Anzeige-Hilfen für den Listenstil: Rollen in normaler Schreibweise, Initialen, Zahlen und Datum (de-AT).

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  BENUTZER: 'Benutzer',
};

export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
}

export function initials(value?: string | null): string {
  const source = (value || '').split('@')[0].trim();
  if (!source) return '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

const percentFormat = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// „+3,0 %“, „−2.051,0 %“, „0 %“ mit echtem Minuszeichen.
export function formatTrendPercent(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0 %';
  const formatted = percentFormat.format(Math.abs(value));
  return `${value > 0 ? '+' : '−'}${formatted} %`;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
