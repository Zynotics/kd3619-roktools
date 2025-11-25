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

  return isNegative ? `-${withDots}` : withDots;
};

/**
 * Converts a German formatted number (string or number) to an integer.
 * Handles undefined, null, empty, missing, invalid formats safely.
 *
 * Example:
 *   "1.234.567" -> 1234567
 *   "12,345"    -> 12345
 *   undefined   -> 0
 */
export const parseGermanNumber = (value: any): number => {
  // Null & undefined → safe zero
  if (value === null || value === undefined) {
    return 0;
  }

  // Already a number → return if valid
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  // Convert everything else to string safely
  const str = String(value);

  // Empty or whitespace only
  if (str.trim() === '') {
    return 0;
  }

  // Keep only digits
  const cleanedString = str.replace(/[^0-9]/g, '');
  if (cleanedString === '') {
    return 0;
  }

  const number = parseInt(cleanedString, 10);
  return isNaN(number) ? 0 : number;
};

/**
 * Generate short file names for display.
 * Removes unnecessary prefixes or file extensions.
 */
export const cleanFileName = (filename: string): string => {
  if (!filename) return '';
  return filename
    .replace('.csv', '')
    .replace('.CSV', '')
    .replace(/_/g, ' ')
    .trim();
};

/**
 * Finds the first column index in `headers` whose name contains any keyword in `keywords`.
 * Matching is case-insensitive and ignores non-alphanumeric characters.
 *
 * @param headers Array of CSV header column names
 * @param keywords e.g. ["kills", "killpoints"]
 * @returns index or undefined
 */
export const findColumnIndex = (headers: string[], keywords: string[]): number | undefined => {
  const normalizedKeywords = keywords.map(k =>
    k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

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
