import { TileType, StructureType, ResourceType } from './types';

export const TILE_SIZE = 16;
export const SCALE = 2; // Visual scale
export const ACTUAL_TILE_SIZE = TILE_SIZE * SCALE;

export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 40;

export const TICK_RATE_MS = 100; // 10 ticks per second

export const COLORS: Record<TileType, string> = {
  [TileType.GRASS]: '#567d46',
  [TileType.FOREST]: '#2e5a1c',
  [TileType.MOUNTAIN]: '#706e6b',
  [TileType.WATER]: '#4fa4b8',
  [TileType.SAND]: '#d4c898',
  [TileType.FLOOR]: '#8f563b',
  [TileType.WALL]: '#523c31',
};

export const BUILDING_COLORS: Record<StructureType, string> = {
  BASE: '#8f563b',
  WAREHOUSE: '#5d4037',
  TOWER: '#4a4a4a',
  FARM: '#eab308', // Yellow/Gold
  HOUSE: '#9ca3af',
};

export const NAMES_PREFIX = ['Bim', 'Bom', 'Dar', 'Kor', 'Zan', 'El', 'Fim', 'Gim', 'Huk', 'Tor'];
export const NAMES_SUFFIX = ['li', 'bo', 'grum', 'rak', 'thos', 'dall', 'rin', 'dun', 'dor', 'min'];

export const FUNNY_MESSAGES = [
  "contemplating the roundness of rocks.",
  "thinking about growing a second beard.",
  "arguing with a squirrel.",
  "trying to invent the sandwich.",
  "forgot where they put the shovel.",
  "singing a song about gold.",
  "worried about the economy.",
  "wondering if clouds taste like wool.",
  "planning a nap.",
];

export const BUILDING_COSTS: Record<StructureType, Partial<Record<ResourceType, number>>> = {
  BASE: {}, // Cannot build
  WAREHOUSE: { [ResourceType.WOOD]: 50 },
  TOWER: { [ResourceType.WOOD]: 20, [ResourceType.STONE]: 50 },
  FARM: { [ResourceType.WOOD]: 30, [ResourceType.STONE]: 10 },
  HOUSE: { [ResourceType.WOOD]: 40 },
};

export const TOOL_COSTS = {
  PICKAXE: { [ResourceType.WOOD]: 10 },
};
