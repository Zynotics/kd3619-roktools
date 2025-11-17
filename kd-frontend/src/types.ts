

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