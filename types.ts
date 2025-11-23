export enum TileType {
  GRASS = 0,
  FOREST = 1,
  MOUNTAIN = 2,
  WATER = 3,
  SAND = 4,
  FLOOR = 5,
  WALL = 6,
}

export enum EntityType {
  NPC = 'NPC',
  MONSTER = 'MONSTER',
  BUILDING = 'BUILDING',
}

export enum ResourceType {
  WOOD = 'WOOD',
  STONE = 'STONE',
  FOOD = 'FOOD',
  FATE = 'FATE',
}

export enum NPCState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  GATHERING = 'GATHERING',
  BUILDING = 'BUILDING',
  SLEEPING = 'SLEEPING',
  FIGHTING = 'FIGHTING',
  CRAFTING = 'CRAFTING',
  FARMING = 'FARMING',
}

export type NPCRole = 'WORKER' | 'GUARD' | 'EXPLORER' | 'BUILDER' | 'FARMER';

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Position;
  name: string;
  color: string;
  spriteIndex?: number; // For future usage
}

export interface NPC extends Entity {
  state: NPCState;
  targetPos: Position | null;
  health: number;
  maxHealth: number;
  role: NPCRole;
  inventory: Partial<Record<ResourceType, number>>;
  equipment: {
    pickaxe: boolean;
    sword: boolean;
  };
  traits: string[];
  actionTimer: number; // ticks until current action is done
  thought: string; // Current thought bubble
}

export type StructureType = 'BASE' | 'WAREHOUSE' | 'TOWER' | 'FARM' | 'HOUSE';

export interface Building extends Entity {
  structureType: StructureType;
  completed: boolean;
  constructionProgress: number;
  maxConstructionProgress: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'DANGER' | 'SUCCESS' | 'FUNNY';
}

export interface GameState {
  colonyName: string;
  seed: number;
  map: TileType[][];
  width: number;
  height: number;
  npcs: NPC[];
  buildings: Building[];
  resources: Record<ResourceType, number>;
  logs: LogEntry[];
  tickCount: number;
  weather: 'SUNNY' | 'RAIN' | 'NIGHT';
  epoch: number;
  selectedEntityId: string | null;
}

export interface SaveMeta {
  id: string;
  name: string;
  lastPlayed: number;
  epoch: number;
}