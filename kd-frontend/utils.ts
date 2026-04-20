// utils.ts
import type { UploadedFile, PlayerInfo } from './types';

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

export const sortUploadedFilesByUploadDateAsc = (
  files: UploadedFile[] = []
): UploadedFile[] => {
  return [...files].sort((a, b) => {
    const dA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
    const dB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;

    if (dA !== dB) return dA - dB;

    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

export const sortUploadedFilesByUploadDateDesc = (
  files: UploadedFile[] = []
): UploadedFile[] => {
  return [...files].sort((a, b) => {
    const dA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
    const dB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;

    if (dA !== dB) return dB - dA;

    return String(b.name || '').localeCompare(String(a.name || ''));
  });
};

export const mergeNewUploadsOnTop = (
  previousFiles: UploadedFile[] = [],
  fetchedFiles: UploadedFile[] = []
): UploadedFile[] => {
  const fetchedById = new Map(fetchedFiles.map((file) => [file.id, file]));
  const previousIds = new Set(previousFiles.map((file) => file.id));

  const newFiles = fetchedFiles.filter((file) => !previousIds.has(file.id));
  const newFilesNewestFirst = sortUploadedFilesByUploadDateDesc(newFiles);

  const existingInPreviousOrder = previousFiles
    .map((file) => fetchedById.get(file.id))
    .filter((file): file is UploadedFile => !!file);

  const usedIds = new Set([
    ...newFilesNewestFirst.map((file) => file.id),
    ...existingInPreviousOrder.map((file) => file.id),
  ]);

  const remainingFiles = fetchedFiles.filter((file) => !usedIds.has(file.id));

  return [...newFilesNewestFirst, ...existingInPreviousOrder, ...remainingFiles];
};

export const hasSameFileOrder = (
  left: UploadedFile[] = [],
  right: UploadedFile[] = []
): boolean => {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]?.id !== right[i]?.id) return false;
  }
  return true;
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

/**
 * Centralized parser for overview scan files.
 * Returns PlayerInfo[] with normalized Governor IDs (trimmed, separators removed, leading zeros stripped).
 * Used by OverviewDashboard, PowerAnalyticsDashboard, and MigrationList.
 */
export const parsePlayersFromFile = (file: UploadedFile): PlayerInfo[] => {
  if (!file || !file.headers || !file.data) return [];
  const headers = file.headers.map(h => String(h));
  const getIdx = (keys: string[]) => findColumnIndex(headers, keys);
  const getStr = (row: any[], idx: number | undefined) =>
    (idx !== undefined && idx >= 0 && idx < row.length && row[idx] != null) ? String(row[idx]).trim() : '';
  const getNum = (row: any[], idx: number | undefined) =>
    (idx !== undefined && idx >= 0 && idx < row.length) ? parseGermanNumber(String(row[idx] ?? '')) : 0;

  const idxId = getIdx(['governorid', 'governor id', 'govid', 'gov id', 'governor_id']);
  const idxName = getIdx(['name', 'playername', 'player name']);
  const idxAlly = getIdx(['alliance', 'allianz', 'tag']);
  const idxPower = getIdx(['power', 'macht']);
  const idxTroops = getIdx(['troopspower', 'troops power']);
  const idxKP = getIdx(['total kill points', 'kill points', 'kp']);
  const idxDead = getIdx(['deadtroops', 'dead troops', 'dead']);
  const idxT1 = getIdx(['t1', 't1 kills']);
  const idxT2 = getIdx(['t2', 't2 kills']);
  const idxT3 = getIdx(['t3', 't3 kills']);
  const idxT4 = getIdx(['t4', 't4 kills', 'tier4']);
  const idxT5 = getIdx(['t5', 't5 kills', 'tier5']);
  const idxCh = getIdx(['cityhall', 'city hall']);
  const idxTech = getIdx(['techpower', 'tech power']);
  const idxBuild = getIdx(['buildingpower', 'building power', 'building']);
  const idxCmd = getIdx(['commanderpower', 'commander power', 'commander']);

  const players: PlayerInfo[] = [];
  file.data.forEach((row: any[]) => {
    const rawId = getStr(row, idxId);
    const id = rawId.replace(/[,.\s]/g, '').replace(/^0+/, '');
    const name = getStr(row, idxName);
    if (!id && !name) return;
    players.push({
      id, name,
      alliance: getStr(row, idxAlly),
      power: getNum(row, idxPower),
      troopsPower: getNum(row, idxTroops),
      totalKillPoints: getNum(row, idxKP),
      deadTroops: getNum(row, idxDead),
      t1Kills: getNum(row, idxT1),
      t2Kills: getNum(row, idxT2),
      t3Kills: getNum(row, idxT3),
      t4Kills: getNum(row, idxT4),
      t5Kills: getNum(row, idxT5),
      cityHall: getNum(row, idxCh),
      techPower: getNum(row, idxTech),
      buildingPower: getNum(row, idxBuild),
      commanderPower: getNum(row, idxCmd),
    });
  });
  return players;
};
