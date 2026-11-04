'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowCounterclockwise } from 'react-bootstrap-icons';
import { useTheme } from '@/components/ThemeProvider';
import { PageContainer, PageHeader, SectionTitle } from '@/components/ui/Page';
import { GroupedRow, GroupedSection } from '@/components/ui/GroupedList';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Button, IconButton } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { StatusDot } from '@/components/ui/Status';
import { inputClasses } from '@/components/ui/Field';
import {
  DEFAULT_RADIUS,
  DEFAULT_THEME,
  FONT_WEIGHT_FIELDS,
  MAX_RADIUS,
  SHADOW_OPTIONS,
  THEME_COLOR_FIELDS,
  THEME_DEFAULT_COLORS,
  findContrastIssues,
  normalizeHex,
  themeToCss,
  type FontWeightKey,
  type ThemeColorKey,
  type ThemeMode,
  type ThemeSettings,
} from '@/lib/theme';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

const MODE_LABEL: Record<ThemeMode, string> = { light: 'Hell', dark: 'Dunkel' };

const ratioFormat = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Farbfeld aus Farbwähler und Hex-Eingabe; ungültige Eingaben werden beim Verlassen verworfen.
function ColorInput({
  id,
  label,
  value,
  isDefault,
  onChange,
  onReset,
}: {
  id: string;
  label: string;
  value: string;
  isDefault: boolean;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = normalizeHex(draft) === null;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label}: Farbe auswählen`}
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-11 cursor-pointer rounded-control border border-border bg-surface p-1"
      />
      <input
        id={id}
        type="text"
        inputMode="text"
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        value={draft}
        aria-invalid={invalid}
        onChange={(e) => {
          setDraft(e.target.value);
          // Sechsstellige Werte sofort übernehmen, Kurzformen wie #FFF erst beim Verlassen.
          if (e.target.value.replace('#', '').length === 6) {
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }
        }}
        onBlur={() => {
          const hex = normalizeHex(draft);
          if (hex) onChange(hex);
          setDraft(hex ?? value);
        }}
        className={`h-9 w-[104px] rounded-control border bg-surface px-2.5 font-mono text-[14px] uppercase text-heading
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${invalid ? 'border-danger' : 'border-border'}`}
      />
      <IconButton label={`${label} auf Standard zurücksetzen`} onClick={onReset} disabled={isDefault} className="disabled:invisible">
        <ArrowCounterclockwise size={15} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

// Zeigt Änderungen sofort in der ganzen App; das gespeicherte Design ist solange abgeschaltet.
function useLivePreview(theme: ThemeSettings) {
  useEffect(() => {
    const preview = document.createElement('style');
    preview.id = 'app-theme-preview';
    document.head.appendChild(preview);
    return () => {
      preview.remove();
      // Nach dem Speichern kann das Layout ein neues Element gerendert haben, daher neu suchen.
      const saved = document.getElementById('app-theme') as HTMLStyleElement | null;
      if (saved) saved.disabled = false;
    };
  }, []);

  useEffect(() => {
    const saved = document.getElementById('app-theme') as HTMLStyleElement | null;
    if (saved) saved.disabled = true;
    const preview = document.getElementById('app-theme-preview');
    if (preview) preview.textContent = themeToCss(theme);
  }, [theme]);
}

export default function DesignSettingsClient({ initialTheme }: { initialTheme: ThemeSettings }) {
  const router = useRouter();
  const { theme: mode, setTheme: setMode } = useTheme();
  const [saved, setSaved] = useState(initialTheme);
  const [theme, setTheme] = useState(initialTheme);
  const [isSaving, setIsSaving] = useState(false);

  useLivePreview(theme);

  const isDirty = JSON.stringify(theme) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(theme) === JSON.stringify(DEFAULT_THEME);
  const contrastIssues = useMemo(() => findContrastIssues(theme), [theme]);

  const setColor = (key: ThemeColorKey, hex: string | null) => {
    setTheme((prev) => {
      const colors = { ...prev[mode] };
      // Ein Wert gleich dem Standard ist keine Änderung.
      if (hex === null || hex === THEME_DEFAULT_COLORS[mode][key]) delete colors[key];
      else colors[key] = hex;
      return { ...prev, [mode]: colors };
    });
  };

  const setWeight = (key: FontWeightKey, value: string) => {
    setTheme((prev) => {
      const weights = { ...prev.weights };
      if (value === '') delete weights[key];
      else weights[key] = Number(value);
      return { ...prev, weights };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Design konnte nicht gespeichert werden');
      setSaved(data.theme);
      setTheme(data.theme);
      toast.success('Design gespeichert, gilt ab sofort für alle Nutzer');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Design konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Design"
        subtitle={isDirty ? 'Ungespeicherte Änderungen, die Vorschau zeigt sie bereits' : 'Farben, Rahmen und Schatten für alle Nutzer'}
      >
        <Button variant="plain" onClick={() => setTheme(saved)} disabled={!isDirty || isSaving}>
          Verwerfen
        </Button>
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? 'Speichert …' : 'Speichern'}
        </Button>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section>
            <SectionTitle
              title="Farben"
              help={`Werte für den Modus „${MODE_LABEL[mode]}“. Leere Werte nutzen den Standard.`}
              actions={<SegmentedControl label="Modus" options={MODE_OPTIONS} value={mode} onChange={setMode} />}
            />
            <GroupedSection>
              {THEME_COLOR_FIELDS.map(({ key, label, description }) => {
                const override = theme[mode][key];
                const disabled = key === 'border' && !theme.border;
                return (
                  <GroupedRow
                    key={key}
                    label={label}
                    description={disabled ? 'Rahmen sind ausgeschaltet' : description}
                    htmlFor={`color-${key}`}
                  >
                    <fieldset disabled={disabled} className={disabled ? 'opacity-50' : undefined}>
                      <ColorInput
                        id={`color-${key}`}
                        label={label}
                        value={override ?? THEME_DEFAULT_COLORS[mode][key]}
                        isDefault={!override}
                        onChange={(hex) => setColor(key, hex)}
                        onReset={() => setColor(key, null)}
                      />
                    </fieldset>
                  </GroupedRow>
                );
              })}
            </GroupedSection>
          </section>

          <GroupedSection title="Rahmen und Form" help="Gilt für Widgets, Listen und Kacheln in beiden Modi.">
            <GroupedRow label="Rahmen anzeigen" description="Feine Linie um jedes Widget">
              <Toggle
                label="Rahmen anzeigen"
                checked={theme.border}
                onChange={(border) => setTheme((prev) => ({ ...prev, border }))}
              />
            </GroupedRow>
            <GroupedRow label="Schatten" description="Hebt Widgets vom Hintergrund ab">
              <SegmentedControl
                label="Schatten"
                options={SHADOW_OPTIONS}
                value={theme.shadow}
                onChange={(shadow) => setTheme((prev) => ({ ...prev, shadow }))}
              />
            </GroupedRow>
            <GroupedRow label="Eckenradius" description={`Standard: ${DEFAULT_RADIUS} px`} htmlFor="radius">
              <input
                id="radius"
                type="range"
                min={0}
                max={MAX_RADIUS}
                step={1}
                value={theme.radius}
                onChange={(e) => setTheme((prev) => ({ ...prev, radius: Number(e.target.value) }))}
                className="w-40 accent-[var(--dp-accent)]"
              />
              <span className="w-12 text-right tabular-nums text-heading">{theme.radius} px</span>
            </GroupedRow>
          </GroupedSection>

          <GroupedSection title="Schriftstärke" help="Gilt in beiden Modi. 400 ist normal, 700 ist fett.">
            {FONT_WEIGHT_FIELDS.map(({ key, label, description, defaultLabel, options }) => (
              <GroupedRow key={key} label={label} description={description} htmlFor={`weight-${key}`}>
                <span className="w-10 text-right text-[17px] text-heading" style={{ fontWeight: theme.weights[key] ?? `var(--dp-weight-${key})` }} aria-hidden="true">
                  Aa
                </span>
                <select
                  id={`weight-${key}`}
                  value={theme.weights[key] ?? ''}
                  onChange={(e) => setWeight(key, e.target.value)}
                  className={`${inputClasses} w-auto min-w-[200px]`}
                >
                  <option value="">{defaultLabel}</option>
                  {options.map((weight) => (
                    <option key={weight} value={weight}>{weight}</option>
                  ))}
                </select>
              </GroupedRow>
            ))}
          </GroupedSection>

          <div>
            <Button variant="destructive" onClick={() => setTheme(DEFAULT_THEME)} disabled={isDefault || isSaving}>
              Alles auf Standard zurücksetzen
            </Button>
            <p className="mt-1 text-[13px] text-muted">Wirkt erst nach „Speichern“.</p>
          </div>
        </div>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
          <section>
            <SectionTitle title="Vorschau" help="So sieht ein Widget aus." />
            <div className="dashboard-widget-surface p-5">
              <p className="widget-eyebrow font-semibold uppercase tracking-wide text-muted">Traffic</p>
              <p className="mt-1 text-[18px] font-semibold text-heading">Klicks letzte 30 Tage</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums text-heading">12.480</p>
              <p className="mt-2 text-[15px] text-body">Fließtext im Widget, gut lesbar auf dem Hintergrund.</p>
              <p className="mt-1 text-[13px] text-muted">Aktualisiert vor 5 Minuten</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" tabIndex={-1}>Button</Button>
                <span className="text-[14px] font-medium text-accent">Link</span>
              </div>
            </div>
          </section>

          <section aria-live="polite">
            <SectionTitle title="Lesbarkeit" help="Kontrast nach WCAG, mindestens 4,5:1." />
            {contrastIssues.length === 0 ? (
              <StatusDot tone="success">Alle Kontraste reichen in Hell und Dunkel</StatusDot>
            ) : (
              <ul className="space-y-1.5">
                {contrastIssues.map((issue) => (
                  <li key={`${issue.mode}-${issue.label}`}>
                    <StatusDot tone="warning">
                      {MODE_LABEL[issue.mode]}: {issue.label} ({ratioFormat.format(issue.ratio)}:1)
                    </StatusDot>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
