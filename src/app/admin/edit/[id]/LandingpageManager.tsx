// src/app/admin/edit/[id]/LandingpageManager.tsx
'use client';

import { useState } from 'react';
import * as XLSX from '@e965/xlsx';
import { 
  FileEarmarkSpreadsheet, 
  CloudUpload, 
  Google, 
  FileEarmarkExcel, 
  CheckCircle, 
  ExclamationTriangle,
  ArrowRepeat
} from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';

type Props = { userId: string };

export default function LandingpageManager({ userId }: Props) {
  const [mode, setMode] = useState<'file' | 'sheet'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isUploading, setIsUploading] = useState(false);

  // Service Email aus Environment Variable wäre ideal, hier als Platzhalter/Info
  // Du solltest dies im UI anzeigen, damit der User weiß, wen er einladen muss.
  const serviceEmail = "seo@max-online.at"; // Oder aus Variable laden, falls verfügbar

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage({ text: '', type: '' });
    }
  };

  const handleImport = async () => {
    if (mode === 'file' && !file) {
      setMessage({ text: 'Bitte wählen Sie zuerst eine Datei aus.', type: 'error' });
      return;
    }
    if (mode === 'sheet' && !sheetUrl) {
      setMessage({ text: 'Bitte geben Sie eine Google Sheet URL ein.', type: 'error' });
      return;
    }

    setIsUploading(true);
    setMessage({ text: '', type: '' });

    try {
      let response;

      if (mode === 'file') {
        const formData = new FormData();
        formData.append('file', file!);
        response = await fetch(`/api/users/${userId}/landingpages`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`/api/users/${userId}/landingpages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheetUrl }),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Import fehlgeschlagen');
      }

      setMessage({ text: `✅ ${result.message}`, type: 'success' });
      
      // Reset inputs
      setFile(null);
      setSheetUrl('');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      setMessage({ 
        text: `❌ Fehler: ${(error as Error).message}`, 
        type: 'error' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
        ["Landingpage-URL", "Haupt-Keyword", "Weitere Keywords", "Suchvolumen", "Aktuelle Pos."],
        ["https://beispiel.de/seite-1", "Beispiel Keyword", "Noch ein Keyword", 1000, 15]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Landingpages");
    XLSX.writeFile(wb, "redaktionsplan_vorlage.xlsx");
  };

  return (
    <div className="bg-surface p-8 rounded-lg mt-8 border border-border">
      <div className="flex items-center gap-3 mb-6 border-b pb-4">
        <FileEarmarkSpreadsheet className="text-accent" size={24} />
        <h3 className="text-xl font-bold text-heading">Redaktionsplan Import</h3>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 bg-surface-tertiary p-1 rounded-lg w-fit">
        <button
          onClick={() => { setMode('file'); setMessage({ text: '', type: '' }); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
            mode === 'file'
              ? 'bg-surface text-accent'
              : 'text-muted hover:text-body'
          }`}
        >
          <FileEarmarkExcel size={16} /> Datei (Excel/CSV)
        </button>
        <button
          onClick={() => { setMode('sheet'); setMessage({ text: '', type: '' }); }}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
            mode === 'sheet'
              ? 'bg-surface text-success'
              : 'text-muted hover:text-body'
          }`}
        >
          <Google size={16} /> Google Sheet
        </button>
      </div>

      <div className="space-y-5">
        
        {/* Modus: DATEI */}
        {mode === 'file' && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-200">
            <label className="block text-sm font-medium text-body mb-2">
              Datei auswählen (.xlsx oder .csv)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".xlsx, .csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent-tint file:text-accent hover:file:bg-accent-tint cursor-pointer border border-border rounded-md"
              />
            </div>
            <p className="text-xs text-muted mt-2">
              Format: Landingpage-URL, Haupt-Keyword, Weitere Keywords, Suchvolumen, Aktuelle Pos.
            </p>
          </div>
        )}

        {/* Modus: GOOGLE SHEET */}
        {mode === 'sheet' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-200">
            <label className="block text-sm font-medium text-body mb-2">
              Google Sheet Link
            </label>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="block w-full px-4 py-2 border border-border rounded-md focus:ring-accent focus:border-accent text-sm"
            />
            
            <div className="mt-3 bg-accent-tint border border-border rounded-md p-3">
              <h4 className="text-sm font-semibold text-accent flex items-center gap-1 mb-1">
                <ExclamationTriangle size={14} /> Wichtig: Freigabe erforderlich
              </h4>
              <p className="text-xs text-accent">
                Damit das Dashboard die Daten lesen kann, müssen Sie das Google Sheet für die folgende Service-E-Mail freigeben (Lesezugriff genügt):
              </p>
              <code className="block mt-2 bg-surface px-2 py-1 rounded border border-border text-xs font-mono text-blue-900 break-all select-all">
                {serviceEmail}
              </code>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={handleImport}
            disabled={isUploading || (mode === 'file' ? !file : !sheetUrl)}
            className={`px-6 py-2.5 rounded-md text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'file' 
                ? 'bg-accent-solid hover:opacity-90' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isUploading ? (
              <>
                <Spinner size={16} className="" />
                <span>Verarbeite...</span>
              </>
            ) : (
              <>
                {mode === 'file' ? <CloudUpload size={18}/> : <ArrowRepeat size={18}/>}
                {mode === 'file' ? 'Hochladen & Importieren' : 'Synchronisieren'}
              </>
            )}
          </button>

          {mode === 'file' && (
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 text-sm font-medium text-muted bg-surface-tertiary hover:bg-surface-quaternary rounded-md transition-colors"
            >
              Vorlage herunterladen
            </button>
          )}
        </div>

        {/* Status Messages */}
        {message.text && (
          <div className={`mt-4 p-3 rounded-md flex items-start gap-2 border ${
            message.type === 'error' 
              ? 'bg-danger-bg text-danger border-border' 
              : 'bg-success-bg text-success border-border'
          }`}>
            {message.type === 'success' ? <CheckCircle className="mt-0.5 shrink-0" /> : <ExclamationTriangle className="mt-0.5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
