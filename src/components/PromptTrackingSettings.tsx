// src/components/PromptTrackingSettings.tsx
//
// v4: Mit Auto-Detection-Block (Vorschau aus Domain + Page-Title + GSC Top-Klicks)
// + manuelle Pflege.
//
// Erwartete API-Routen:
//   POST /api/users/brand-keywords                  → manuelles Save
//   GET  /api/users/auto-detect-brand-keywords      → Vorschau ohne speichern
//   POST /api/users/auto-detect-brand-keywords      → Detection + Save + Cache-Invalidate
//
// Wenn der eingeloggte User Admin/Superadmin ist, kann er per `targetUserId`
// auch für andere User detecten (Param wird im URL/Body übergeben — siehe API-Route).

'use client';

import React, { useState } from 'react';
import {
  Plus, X, Save, Loader2, AlertCircle, CheckCircle, Info, Zap,
  Globe, FileText,
} from 'lucide-react';

interface DetectionPreview {
  keywords: string[];
  sources: {
    domain: string[];
    pageTitle: string[];
  };
  pageTitle?: string | null;
  pageTitleFetched: boolean;
}

interface PromptTrackingSettingsProps {
  /** Aktuell gespeicherte Brand-Keywords (oder null = Heuristik) */
  initialKeywords?: string[] | null;
  /** API-Endpoint für manuelles Save (default: /api/users/brand-keywords) */
  apiEndpoint?: string;
  /** API-Endpoint für Auto-Detect (default: /api/users/auto-detect-brand-keywords) */
  autoDetectEndpoint?: string;
  /** Optional: für Admins, um für anderen User zu detecten */
  targetUserId?: string;
  /** Domain für Heuristik-Hinweis */
  domain?: string;
}

export default function PromptTrackingSettings({
  initialKeywords,
  apiEndpoint = '/api/users/brand-keywords',
  autoDetectEndpoint = '/api/users/auto-detect-brand-keywords',
  targetUserId,
  domain,
}: PromptTrackingSettingsProps) {
  // ─── Manuelle Liste ───────────────────────────────────────────
  const [keywords, setKeywords] = useState<string[]>(initialKeywords || []);
  const [newKeyword, setNewKeyword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── Auto-Detect ─────────────────────────────────────────────
  const [preview, setPreview] = useState<DetectionPreview | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const fallbackBrand = domain
    ? domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0]
    : null;

  // ─── Helpers ──────────────────────────────────────────────────
  const buildUrl = (base: string) =>
    targetUserId ? `${base}?targetUserId=${encodeURIComponent(targetUserId)}` : base;

  // ─── Add / Remove / Save (manuell) ────────────────────────────
  const handleAdd = () => {
    const k = newKeyword.trim().toLowerCase();
    if (!k || k.length < 2) return;
    if (keywords.some((existing) => existing.toLowerCase() === k)) return;
    setKeywords([...keywords, k]);
    setNewKeyword('');
    setSaveStatus('idle');
  };

  const handleRemove = (idx: number) => {
    setKeywords(keywords.filter((_, i) => i !== idx));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMsg(null);
    try {
      const res = await fetch(buildUrl(apiEndpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_keywords: keywords.length > 0 ? keywords : null,
          targetUserId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      console.error('[PromptTrackingSettings] Save error:', e);
      setSaveStatus('error');
      setErrorMsg(e?.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Auto-Detect: Vorschau ────────────────────────────────────
  const handleDetectPreview = async () => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      const res = await fetch(buildUrl(autoDetectEndpoint), { method: 'GET' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPreview(data);
    } catch (e: any) {
      console.error('[PromptTrackingSettings] Detect preview error:', e);
      setDetectError(e?.message || 'Vorschau fehlgeschlagen');
      setPreview(null);
    } finally {
      setIsDetecting(false);
    }
  };

  // ─── Auto-Detect: Übernehmen + Speichern ──────────────────────
  const handleDetectApply = async () => {
    setIsApplying(true);
    setDetectError(null);
    try {
      const res = await fetch(buildUrl(autoDetectEndpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeywords(data.keywords || []);
      setPreview(data);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      console.error('[PromptTrackingSettings] Detect apply error:', e);
      setDetectError(e?.message || 'Übernahme fehlgeschlagen');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="card-glass p-6">
      <div className="mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          Brand-Keywords (Prompt-Tracking)
        </h3>
        <p className="text-muted text-sm mt-1">
          Definiere, welche Begriffe als Brand-Treffer gewertet werden.
          Wenn leer, wird die Domain-Wurzel als Heuristik verwendet
          {fallbackBrand ? ` (aktuell: „${fallbackBrand}")` : ''}.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* AUTO-DETECT BLOCK                                        */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="mb-5 rounded-md border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 p-3">
        <div className="flex items-start gap-2 mb-2">
          <Zap className="w-4 h-4 mt-0.5 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-fuchsia-900 dark:text-fuchsia-200">
              Brand-Keywords automatisch erkennen
            </div>
            <p className="text-xs text-fuchsia-800/80 dark:text-fuchsia-300/80 mt-0.5 leading-relaxed">
              Aus zwei zuverlässigen Quellen: Domain-Tokenisierung und Page-Title der Homepage.
              Generika werden gefiltert. (GSC-Top-Klick-Queries werden bewusst nicht genutzt —
              die sind bei Content-Sites themenbezogen, nicht markenbezogen.)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={handleDetectPreview}
            disabled={isDetecting || isApplying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-fuchsia-300 dark:border-fuchsia-700 bg-surface hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/30 transition disabled:opacity-50"
          >
            {isDetecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Vorschau erkennen
          </button>
          {preview && (
            <button
              onClick={handleDetectApply}
              disabled={isApplying || isDetecting || preview.keywords.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Übernehmen &amp; speichern
            </button>
          )}
        </div>

        {detectError && (
          <div className="mt-2 text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {detectError}
          </div>
        )}

        {preview && (
          <div className="mt-3 space-y-2 border-t border-fuchsia-200 dark:border-fuchsia-800 pt-3">
            {/* Aggregierte Liste */}
            <div>
              <div className="text-[11px] font-medium text-fuchsia-900 dark:text-fuchsia-200 uppercase tracking-wider mb-1">
                Erkannte Keywords ({preview.keywords.length})
              </div>
              {preview.keywords.length === 0 ? (
                <p className="text-xs italic text-muted">
                  Keine eindeutigen Brand-Tokens gefunden — du kannst manuell Keywords ergänzen.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {preview.keywords.map((kw, i) => (
                    <code
                      key={i}
                      className="text-xs px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200"
                    >
                      {kw}
                    </code>
                  ))}
                </div>
              )}
            </div>

            <SourceLine
              icon={<Globe className="w-3.5 h-3.5" />}
              label="Domain"
              tokens={preview.sources.domain}
            />
            <SourceLine
              icon={<FileText className="w-3.5 h-3.5" />}
              label={preview.pageTitleFetched ? 'Page-Title' : 'Page-Title (nicht erreichbar)'}
              tokens={preview.sources.pageTitle}
              meta={preview.pageTitle ? `„${preview.pageTitle}"` : undefined}
            />
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* MANUELLE PFLEGE                                          */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="mb-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-200 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Tipp:</strong> Du kannst die Liste manuell ergänzen — füge alle Schreibvarianten und
          produktnahen Begriffe hinzu (z.B. <code className="px-1 rounded bg-blue-100 dark:bg-blue-900/40">datapeak</code>,
          {' '}<code className="px-1 rounded bg-blue-100 dark:bg-blue-900/40">data peak</code>).
          Klein-/Großschreibung wird ignoriert. Mindestlänge 2 Zeichen.
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Neues Keyword..."
          className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
        />
        <button
          onClick={handleAdd}
          disabled={!newKeyword.trim() || newKeyword.trim().length < 2}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus className="w-4 h-4" />
          Hinzufügen
        </button>
      </div>

      {/* Keywords List */}
      <div className="mb-4 min-h-[60px]">
        {keywords.length === 0 ? (
          <p className="text-sm text-muted italic">
            Keine Keywords gesetzt — Heuristik aktiv
            {fallbackBrand ? ` (Brand-Term: „${fallbackBrand}")` : ''}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                {kw}
                <button
                  onClick={() => handleRemove(idx)}
                  className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded p-0.5 transition"
                  aria-label={`${kw} entfernen`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div className="text-xs">
          {saveStatus === 'success' && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" /> Gespeichert
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </span>
          )}
          {saveStatus === 'idle' && keywords.length > 0 && (
            <span className="text-muted">
              {keywords.length} Keyword{keywords.length !== 1 ? 's' : ''} – nicht vergessen zu speichern
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-50 transition"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </div>

      <p className="text-xs text-muted mt-4">
        Änderungen werden beim nächsten Daten-Refresh wirksam (nach Cache-Invalidierung
        oder Klick auf „Daten aktualisieren").
      </p>
    </div>
  );
}

// ─── Sub: SourceLine ────────────────────────────────────────────
function SourceLine({
  icon, label, tokens, meta,
}: {
  icon: React.ReactNode;
  label: string;
  tokens: string[];
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-fuchsia-800 dark:text-fuchsia-300">
        <span className="opacity-70">{icon}</span>
        <span className="font-medium">{label}</span>
        {tokens.length > 0 && (
          <span className="text-fuchsia-600/70 dark:text-fuchsia-400/70 tabular-nums">· {tokens.length}</span>
        )}
      </div>
      {meta && (
        <div className="text-[11px] text-muted italic ml-5">{meta}</div>
      )}
      {tokens.length > 0 ? (
        <div className="flex flex-wrap gap-1 ml-5">
          {tokens.map((t, i) => (
            <code
              key={i}
              className="text-[11px] px-1 py-0.5 rounded bg-fuchsia-100/70 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
            >
              {t}
            </code>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-muted italic ml-5">— keine Treffer —</div>
      )}
    </div>
  );
}
