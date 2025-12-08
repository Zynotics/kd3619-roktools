// types.ts

export type TableData = any[][];
export type TableHeaders = string[];

export type UploadedFile = {
  id: string;
  name: string;
  headers: TableHeaders;
  data: TableData;
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
    
    // Für detaillierte Analyse (optional für Total View)
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

// 🆕 NEU: Activity Typen
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

// 🆕 NEU: Modulares KvK System

// Definition eines einzelnen Kampfes innerhalb eines Events
export interface KvkFight {
  id: string;          // Eindeutige ID für den Kampf (z.B. UUID)
  name: string;        // z.B. "Pass 4 Öffnung"
  startFileId: string; // Snapshot VOR dem Kampf
  endFileId: string;   // Snapshot NACH dem Kampf
}

// Das Haupt-Event Objekt
export interface KvkEvent {
  id: string;
  name: string;
  kingdomId: string;
  fights: KvkFight[];     // Array von Kämpfen statt einzelner Start/End Files
  honorFileIds: string[]; // Liste von Honor-Files
  isPublic: boolean;
  createdAt: string;
}

// Payload zum Erstellen/Update
export interface CreateKvkEventPayload {
  name: string;
  kingdomId?: string;
  fights: KvkFight[];
  honorFileIds: string[];
  isPublic: boolean;
}