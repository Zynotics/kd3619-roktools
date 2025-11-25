/**
 * Formats a number as an integer with thousand separators (dots).
 * e.g. 1234567  -> "1.234.567"
 *      -9876    -> "-9.876"
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
 * Safely parses a (German) formatted number string to an integer.
 *
 * Examples:
 *   "1.234.567"   -> 1234567
 *   "12,345"      -> 12345
 *   "  9.876  "   -> 9876
 *   undefined     -> 0
 *   null          -> 0
 *   "" / " "      -> 0
 */
export const parseGermanNumber = (value: any): number => {
  // Null / undefined => 0
  if (value === null || value === undefined) {
    return 0;
  }

  // Already a number
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  // Alles andere in String umwandeln (auch z.B. 0, Objekte, etc.)
  const str = String(value);

  if (str.trim() === '') {
    return 0;
  }

  // Nur Ziffern behalten (d.h. Punkte, Kommas, etc. werden entfernt)
  const cleanedString = str.replace(/[^0-9]/g, '');
  if (cleanedString === '') {
    return 0;
  }

  const num = parseInt(cleanedString, 10);
  return isNaN(num) ? 0 : num;
};

/**
 * Cleans file names for display:
 * - removes .csv / .CSV
 * - replaces underscores with spaces
 * - trims surrounding spaces
 */
export const cleanFileName = (filename: string): string => {
  if (!filename) return '';

  return filename
    .replace(/\.csv$/i, '')   // entfernt .csv / .CSV am Ende
    .replace(/_/g, ' ')
    .trim();
};

/**
 * Abbreviates large numbers:
 *   950        -> "950"
 *   12_300     -> "12.3K"
 *   1_200_000  -> "1.2M"
 *   2_500_000_000 -> "2.5B"
 */
export const abbreviateNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs < 1_000) return num.toString();
  if (abs < 1_000_000) return sign + (abs / 1_000).toFixed(1) + 'K';
  if (abs < 1_000_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';

  return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
};

/**
 * Finds the index of a column in the header row by matching one of the given keywords.
 *
 * Matching:
 * - case-insensitive
 * - ignores non-alphanumeric characters on both sides
 *
 * Example:
 *   headers: ["GovernorID", "Total Kill Points"]
 *   keywords: ["killpoints", "kill points"]
 *   => returns index of "Total Kill Points"
 */
export const findColumnIndex = (
  headers: string[],
  keywords: string[]
): number | undefined => {
  // Normalize keywords once
  const normalizedKeywords = keywords.map((k) =>
    k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;

    const normalizedHeader = header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (normalizedKeywords.some((kw) => normalizedHeader.includes(kw))) {
      return i;
    }
  }

  return undefined;
};
