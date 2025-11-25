
/**
 * Formats a number as an integer with thousand separators (dots).
 * e.g., 1234567 -> "1.234.567", -9876 -> "-9.876"
 */
export const formatNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  const isNegative = num < 0;
  const absInt = Math.round(Math.abs(num));

  const withDots = absInt
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return (isNegative ? '-' : '') + withDots;
};

/**
 * Interprets a (German) formatted number and returns it as integer.
 * e.g. "1.234.567" -> 1234567
 */
export const parseGermanNumber = (value: any): number => {
  // Alles, was null/undefined ist → 0
  if (value === null || value === undefined) {
    return 0;
  }

  // Reine Zahl direkt zurückgeben
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  // Alles andere in String wandeln (z.B. auch 0, Objekte, etc.)
  const str = String(value);

  if (str.trim() === '') {
    return 0;
  }

  // Nur Ziffern behalten (wie bisher)
  const cleanedString = str.replace(/[^0-9]/g, '');
  if (cleanedString === '') {
    return 0;
  }

  const number = parseInt(cleanedString, 10);
  return isNaN(number) ? 0 : number;
};


/**
 * Removes the file extension from a filename.
 */
export const cleanFileName = (name: string): string => name.replace(/\.(xlsx|xls|csv)$/i, '');


/**
 * Formats a large number with an abbreviation (K, M, B).
 * e.g., 1234 -> 1.2K, 1234567 -> 1.2M
 */
export const abbreviateNumber = (num: number): string => {
  if (Math.abs(num) < 1e3) return num.toString();
  if (Math.abs(num) < 1e6) return (num / 1e3).toFixed(1) + 'K';
  if (Math.abs(num) < 1e9) return (num / 1e6).toFixed(1) + 'M';
  return (num / 1e9).toFixed(1) + 'B';
};

/**
 * Finds the index of a column in a header array by searching for keywords.
 * It's case-insensitive and ignores non-alphanumeric characters.
 * @param headers The array of header strings.
 * @param keywords An array of keywords to search for.
 * @returns The index of the found column, or undefined if not found.
 */
export const findColumnIndex = (headers: string[], keywords: string[]): number | undefined => {
  const normalizedKeywords = keywords.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) {
      const normalizedHeader = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeywords.some(kw => normalizedHeader.includes(kw))) {
        return i;
      }
    }
  }
  return undefined;
};