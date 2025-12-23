// utils.ts

// ... (formatNumber, parseGermanNumber, cleanFileName, abbreviateNumber bleiben gleich - hier der Fokus auf findColumnIndex)

export const formatNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  const isNegative = num < 0;
  const absInt = Math.round(Math.abs(num));
  const withDots = absInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${withDots}` : withDots;
};

export const parseGermanNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  // Entferne alles außer Ziffern (auch Punkte und Kommas, da wir von Ganzzahlen ausgehen)
  // Wenn es Kommazahlen wären, müsste man komplexer parsen, aber bei Honor/Kills sind es meist Integer.
  const s = String(value);
  const cleaned = s.replace(/[^0-9]/g, ''); 
  if (!cleaned) return 0;
  
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
};

export const cleanFileName = (filename: string): string => {
  if (!filename) return '';
  return String(filename).replace(/\.(csv|xlsx|xls)$/i, '').replace(/_/g, ' ').trim();
};

export const abbreviateNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs < 1000) return String(num);
  if (abs < 1000000) return sign + (abs / 1000).toFixed(1) + 'K';
  if (abs < 1000000000) return sign + (abs / 1000000).toFixed(1) + 'M';
  return sign + (abs / 1000000000).toFixed(1) + 'B';
};

/**
 * Findet den Index einer Spalte, priorisiert exakte Treffer.
 */
export const findColumnIndex = (
  headers: string[],
  keywords: string[]
): number | undefined => {
  if (!Array.isArray(headers) || headers.length === 0) return undefined;

  const normalizedKeywords = keywords.map((k) =>
    String(k).toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  // 1. Priorität: Exakter Treffer (Normalisiert)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    const normHeader = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (normalizedKeywords.includes(normHeader)) {
        return i;
    }
  }

  // 2. Priorität: Enthält Keyword (aber Vorsicht bei "Name" vs "Governor Name")
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    const normHeader = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const kw of normalizedKeywords) {
        if (normHeader.includes(kw)) {
            return i;
        }
    }
  }

  return undefined;
};