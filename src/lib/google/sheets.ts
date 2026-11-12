import { createAuth } from './client';
import { google } from 'googleapis';
import { requestBudgetOptions } from '../sync/request-budget';

export async function getGoogleSheetData(sheetId: string): Promise<Record<string, string>[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth, ...requestBudgetOptions() });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z2000',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
        const val = row[index] ? row[index].toString().trim() : '';
        if (key) {
          obj[key] = val;
        }
      });
      return obj;
    });

    return data;
  } catch (error: unknown) {
    console.error('[Sheets API] Fehler:', error);
    throw new Error('Konnte Google Sheet nicht lesen.');
  }
}
