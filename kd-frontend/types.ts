// types.ts - Full type definitions

export type TableData = any[][];
export type TableHeaders = string[];

export type UploadedFile = {
  id: string;
  name: string;
  headers: TableHeaders;
  data: TableData;
  uploadDate?: string; // Important for chronological ordering
};

export type PlayerInfo = {
    id: string;
    name: string;
    power: number;
    alliance?: string;
    t1Kills: number;
    t2Kills: number;
    t3Kills: number;
    t4Kills: number;
    t5Kills: number;
    totalKillPoints: number;
    deadTroops: number;
    cityHall: number;
    troopsPower: number;
    techPower: number;
    buildingPower: number;
    commanderPower: number;
};

export type PlayerStatChange = {
    id: string;
    name: string;
    alliance?: string;

    oldPower: number;
    newPower: number;
    diffPower: number;

    oldKillPoints: number;
    newKillPoints: number;
    diffKillPoints: number;

    oldDeadTroops: number;
    newDeadTroops: number;
    diffDeadTroops: number;

    oldTroopsPower: number;
    newTroopsPower: number;
    diffTroopsPower: number;
    
    // Optional for detailed analysis
    t4KillsDiff?: number;
    t5KillsDiff?: number;
};


export type ComparisonStats = {
    totalPowerFile1: number;
    totalPowerFile2: number;
    powerDifference: number;

    totalTroopsPowerFile1: number;
    totalTroopsPowerFile2: number;
    troopsPowerDifference: number;

    totalKillPointsFile1: number;
    totalKillPointsFile2: number;
    killPointsDifference: number;
    
    totalDeadTroopsFile1: number;
    totalDeadTroopsFile2: number;
    deadTroopsDifference: number;

    newPlayers: PlayerInfo[];
    disappearedPlayers: PlayerInfo[];
    playerStatChanges: PlayerStatChange[];
};

export type HonorPlayerInfo = {
  governorId: string;
  name: string;
  honorPoint: number;
};

export type PlayerHonorChange = {
  governorId: string;
  name: string;
  oldHonor: number;
  newHonor: number;
  diffHonor: number;
};

export type HonorComparisonStats = {
  playerHonorChanges: PlayerHonorChange[];
};

export type PlayerHonorHistory = {
  id: string;
  name: string;
  history: {
    fileName: string;
    fileId: string;
    date?: string;
    honorPoint: number;
  }[];
};

export interface PlayerAnalyticsHistory {
  id: string;
  name: string;
  alliance: string;
  history: PlayerAnalyticsRecord[];
}

export interface PlayerAnalyticsRecord {
  fileName: string;
  power: number;
  troopsPower: number;
  totalKillPoints: number;
  deadTroops: number;
  t1Kills: number;
  t2Kills: number;
  t3Kills: number;
  t4Kills: number;
  t5Kills: number;
  totalKills: number;
}

export interface Kingdom {
  id: string;
  displayName: string;
  slug: string;
  rokIdentifier: string | null;
  status: 'active' | 'inactive' | string;
  plan: string;
  createdAt?: string;
  updatedAt?: string;
  ownerUserId?: string | null;
  ownerUsername?: string | null;
  ownerEmail?: string | null;
}

// Activity types
export type ActivityPlayerInfo = {
    id: string;
    name: string;
    alliance: string;
    power: number;
    killPoints: number;
    helpTimes: number;
    rssTrading: number;
    buildingScore: number;
    techDonation: number;
};

// --- MODULAR KVK SYSTEM (UPDATED) ---

// Definition of a single fight
export interface KvkFight {
  id: string;
  name: string;
  startFileId: string; // ID from the overview pool
  endFileId: string;   // ID from the overview pool
}

export interface DkpFormulaEntry {
  enabled: boolean;
  points: number;
}

export interface DkpFormula {
  t1: DkpFormulaEntry;
  t2: DkpFormulaEntry;
  t3: DkpFormulaEntry;
  t4: DkpFormulaEntry;
  t5: DkpFormulaEntry;
  deadTroops: DkpFormulaEntry;
}

export interface GoalsPowerBracket {
  minPower: number;
  maxPower: number | null;
  dkpPercent: number;
  deadPercent: number;
}

export interface GoalsFormula {
  basePowerToDkpPercent: number;
  basePowerToDeadTroopsPercent: number;
  powerBrackets?: GoalsPowerBracket[];
}

// Primary event object
export interface KvkEvent {
  id: string;
  name: string;
  kingdomId: string;
  fights: KvkFight[];
  dkpFormula?: DkpFormula | null;
  goalsFormula?: GoalsFormula | null;
  eventStartFileId?: string; // ID from the overview pool for base power

  // Honor tracking definition (range instead of list)
  honorStartFileId?: string; // ID from the honor pool
  honorEndFileId?: string;   // ID from the honor pool
  
  isPublic: boolean;
  createdAt: string;
}

// Payload for create/update
export interface CreateKvkEventPayload {
  name: string;
  kingdomId?: string;
  fights: KvkFight[];
  dkpFormula?: DkpFormula | null;
  goalsFormula?: GoalsFormula | null;
  eventStartFileId?: string;
  honorStartFileId?: string;
  honorEndFileId?: string;
  isPublic: boolean;
}