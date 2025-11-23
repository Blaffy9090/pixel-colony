import { GameState, TileType, NPC, NPCState, ResourceType, Building, EntityType, LogEntry, Position, StructureType, Entity } from '../types';
import { MAP_WIDTH, MAP_HEIGHT, NAMES_PREFIX, NAMES_SUFFIX, FUNNY_MESSAGES, BUILDING_COSTS, TOOL_COSTS, BUILDING_COLORS } from '../constants';

// --- RNG & Helper Functions ---

// Simple Linear Congruential Generator for seeded random
class PseudoRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns number between 0 and 1
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const generateName = (): string => {
  const pre = NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)];
  const suf = NAMES_SUFFIX[Math.floor(Math.random() * NAMES_SUFFIX.length)];
  return pre + suf;
};

const distance = (p1: Position, p2: Position) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);

// --- Map Generation ---

export const generateMap = (w: number, h: number, seed: number): TileType[][] => {
  const rng = new PseudoRandom(seed);
  const map: TileType[][] = Array(h).fill(null).map(() => Array(w).fill(TileType.GRASS));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rand = rng.next();
      if (rand < 0.05) map[y][x] = TileType.MOUNTAIN;
      else if (rand < 0.20) map[y][x] = TileType.FOREST;
      else if (rand < 0.25) map[y][x] = TileType.WATER;
      else if (rand < 0.27) map[y][x] = TileType.SAND;
    }
  }

  // Ensure center is clear for base
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for(let y=cy-3; y<=cy+3; y++) {
    for(let x=cx-3; x<=cx+3; x++) {
      map[y][x] = TileType.GRASS;
    }
  }

  return map;
};

export const createInitialState = (name: string, seedInput?: number): GameState => {
  // If no seed provided, generate a random integer
  const seed = seedInput !== undefined ? seedInput : Math.floor(Math.random() * 1000000);
  
  const map = generateMap(MAP_WIDTH, MAP_HEIGHT, seed);
  const npcs: NPC[] = [];
  
  // Spawn 5 Dwarves
  for (let i = 0; i < 5; i++) {
    npcs.push({
      id: `npc_${Date.now()}_${i}`,
      type: EntityType.NPC,
      name: generateName(),
      pos: { x: Math.floor(MAP_WIDTH / 2) + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3), y: Math.floor(MAP_HEIGHT / 2) + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3) },
      color: '#ef4444', // Red shirt
      state: NPCState.IDLE,
      targetPos: null,
      health: 100,
      maxHealth: 100,
      role: i === 0 ? 'GUARD' : 'WORKER',
      inventory: {},
      equipment: { pickaxe: false, sword: false },
      traits: ['Hardy'],
      actionTimer: 0,
      thought: 'New world!',
    });
  }

  // Initial Base Building
  const base: Building = {
    id: 'base_01',
    type: EntityType.BUILDING,
    name: 'Town Hall',
    pos: { x: Math.floor(MAP_WIDTH / 2), y: Math.floor(MAP_HEIGHT / 2) },
    color: BUILDING_COLORS.BASE,
    structureType: 'BASE',
    completed: true,
    constructionProgress: 100,
    maxConstructionProgress: 100,
  };

  return {
    colonyName: name,
    seed: seed,
    map,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    npcs,
    buildings: [base],
    resources: {
      [ResourceType.WOOD]: 0,
      [ResourceType.STONE]: 0,
      [ResourceType.FOOD]: 20, // Start with a bit more food
      [ResourceType.FATE]: 0,
    },
    logs: [{ id: 'init', timestamp: new Date().toLocaleTimeString(), message: 'The expedition has arrived.', type: 'INFO' }],
    tickCount: 0,
    weather: 'SUNNY',
    epoch: 1,
    selectedEntityId: null,
  };
};

export const placeBuilding = (state: GameState, x: number, y: number, type: StructureType): GameState | null => {
  // Check bounds
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return null;
  // Check collision with other buildings
  if (state.buildings.some(b => b.pos.x === x && b.pos.y === y)) return null;
  // Check map terrain (cannot build on water or mountain)
  if (state.map[y][x] === TileType.WATER || state.map[y][x] === TileType.MOUNTAIN) return null;

  // Check Cost
  const cost = BUILDING_COSTS[type];
  const newState = { ...state, resources: { ...state.resources } };
  
  if (cost[ResourceType.WOOD] && state.resources[ResourceType.WOOD] < cost[ResourceType.WOOD]!) return null;
  if (cost[ResourceType.STONE] && state.resources[ResourceType.STONE] < cost[ResourceType.STONE]!) return null;
  if (cost[ResourceType.FOOD] && state.resources[ResourceType.FOOD] < cost[ResourceType.FOOD]!) return null;

  // Deduct resources
  if (cost[ResourceType.WOOD]) newState.resources[ResourceType.WOOD] -= cost[ResourceType.WOOD]!;
  if (cost[ResourceType.STONE]) newState.resources[ResourceType.STONE] -= cost[ResourceType.STONE]!;

  const newBuilding: Building = {
    id: `bld_${Date.now()}`,
    type: EntityType.BUILDING,
    name: type === 'FARM' ? 'Wheat Farm' : 'House',
    pos: { x, y },
    color: BUILDING_COLORS[type],
    structureType: type,
    completed: false,
    constructionProgress: 0,
    maxConstructionProgress: 100,
  };

  newState.buildings = [...newState.buildings, newBuilding];
  newState.logs = [{
    id: `build_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    message: `Construction started: ${type}`,
    type: 'INFO'
  }, ...newState.logs];

  return newState;
};

// --- Game Loop Logic ---

const findNearestTile = (map: TileType[][], start: Position, type: TileType): Position | null => {
  let nearest: Position | null = null;
  let minDst = Infinity;

  // Optimization: Scan outward or just scan all (small map allows scanning all)
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === type) {
        const d = distance(start, { x, y });
        if (d < minDst) {
          minDst = d;
          nearest = { x, y };
        }
      }
    }
  }
  return nearest;
};

const findNearestEntity = (entities: Entity[], start: Position, filter?: (e: Entity) => boolean): Entity | null => {
  let nearest: Entity | null = null;
  let minDst = Infinity;

  for (const e of entities) {
    if (filter && !filter(e)) continue;
    const d = distance(start, e.pos);
    if (d < minDst) {
      minDst = d;
      nearest = e;
    }
  }
  return nearest;
};

const moveTowards = (npc: NPC, target: Position): Position => {
  const dx = target.x - npc.pos.x;
  const dy = target.y - npc.pos.y;
  
  const newPos = { ...npc.pos };
  if (Math.abs(dx) > Math.abs(dy)) {
    newPos.x += Math.sign(dx);
  } else {
    newPos.y += Math.sign(dy);
  }
  return newPos;
};

export const updateGameState = (state: GameState): GameState => {
  const newState = { ...state };
  newState.tickCount++;

  // Update Time/Weather
  if (newState.tickCount % 500 === 0) {
    newState.weather = newState.weather === 'SUNNY' ? 'RAIN' : newState.weather === 'RAIN' ? 'NIGHT' : 'SUNNY';
    newState.logs = [{ 
      id: `weather_${Date.now()}`, 
      timestamp: new Date().toLocaleTimeString(), 
      message: `Weather changed to ${newState.weather}`, 
      type: 'INFO' as const
    }, ...newState.logs].slice(0, 50);
  }

  // Passive Fate Gain
  if (newState.tickCount % 100 === 0) {
    newState.resources[ResourceType.FATE] += 1;
  }

  // Update NPCs
  newState.npcs = newState.npcs.map(npc => {
    const updatedNpc = { ...npc };

    // --- IDLE STATE LOGIC ---
    if (updatedNpc.state === NPCState.IDLE) {
      if (Math.random() < 0.05) {
        updatedNpc.thought = FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
      }

      // --- BUILDER ROLE ---
      if (updatedNpc.role === 'BUILDER') {
        const site = findNearestEntity(newState.buildings, updatedNpc.pos, (e) => !(e as Building).completed);
        if (site) {
          updatedNpc.targetPos = site.pos;
          updatedNpc.state = NPCState.MOVING;
          updatedNpc.thought = "Time to build.";
        } else {
          // Wander if no jobs
          updatedNpc.targetPos = { 
            x: Math.max(0, Math.min(MAP_WIDTH-1, updatedNpc.pos.x + Math.floor(Math.random() * 5) - 2)),
            y: Math.max(0, Math.min(MAP_HEIGHT-1, updatedNpc.pos.y + Math.floor(Math.random() * 5) - 2))
          };
          updatedNpc.state = NPCState.MOVING;
        }
      } 
      // --- FARMER ROLE ---
      else if (updatedNpc.role === 'FARMER') {
        const farm = findNearestEntity(newState.buildings, updatedNpc.pos, (e) => (e as Building).structureType === 'FARM' && (e as Building).completed);
        if (farm) {
          updatedNpc.targetPos = farm.pos;
          updatedNpc.state = NPCState.MOVING;
          updatedNpc.thought = "Tending the crops.";
        } else {
          // Wander
          updatedNpc.targetPos = { 
             x: Math.max(0, Math.min(MAP_WIDTH-1, updatedNpc.pos.x + Math.floor(Math.random() * 5) - 2)),
             y: Math.max(0, Math.min(MAP_HEIGHT-1, updatedNpc.pos.y + Math.floor(Math.random() * 5) - 2))
           };
           updatedNpc.state = NPCState.MOVING;
        }
      }
      // --- WORKER ROLE ---
      else if (updatedNpc.role === 'WORKER') {
        // Resource priority: 
        // 1. If need Pickaxe -> go to Base to craft
        // 2. If has Pickaxe -> Mine Stone or Wood
        // 3. If no Pickaxe -> Chop Wood
        
        let targetType = TileType.FOREST;
        let needsCrafting = false;

        // Decision making
        if (!updatedNpc.equipment.pickaxe) {
          // Needs pickaxe?
          // If we have wood for it, go craft.
          if (newState.resources[ResourceType.WOOD] >= TOOL_COSTS.PICKAXE[ResourceType.WOOD]!) {
             needsCrafting = true;
          } else {
             // Gather wood to get pickaxe
             targetType = TileType.FOREST;
          }
        } else {
           // Has pickaxe, can mine stone or wood
           targetType = Math.random() > 0.5 ? TileType.FOREST : TileType.MOUNTAIN;
        }

        if (needsCrafting) {
           // Go to base
           const base = newState.buildings.find(b => b.structureType === 'BASE');
           if (base) {
             updatedNpc.targetPos = base.pos;
             updatedNpc.state = NPCState.MOVING;
             updatedNpc.thought = "Need a pickaxe...";
           }
        } else {
           const target = findNearestTile(newState.map, updatedNpc.pos, targetType);
           if (target) {
             updatedNpc.targetPos = target;
             updatedNpc.state = NPCState.MOVING;
           } else {
             // Wander
             updatedNpc.targetPos = { 
                x: Math.max(0, Math.min(MAP_WIDTH-1, updatedNpc.pos.x + Math.floor(Math.random() * 5) - 2)),
                y: Math.max(0, Math.min(MAP_HEIGHT-1, updatedNpc.pos.y + Math.floor(Math.random() * 5) - 2))
            };
            updatedNpc.state = NPCState.MOVING;
           }
        }
      } else {
         // Guard or others just wander
         if (Math.random() < 0.2) {
             updatedNpc.targetPos = { 
                x: Math.max(0, Math.min(MAP_WIDTH-1, updatedNpc.pos.x + Math.floor(Math.random() * 5) - 2)),
                y: Math.max(0, Math.min(MAP_HEIGHT-1, updatedNpc.pos.y + Math.floor(Math.random() * 5) - 2))
             };
             updatedNpc.state = NPCState.MOVING;
         }
      }
    } 
    // --- MOVING STATE ---
    else if (updatedNpc.state === NPCState.MOVING) {
      if (updatedNpc.targetPos) {
        if (distance(updatedNpc.pos, updatedNpc.targetPos) <= 1) {
          // Arrived logic
          
          // Check if at Base for Crafting
          const base = newState.buildings.find(b => b.structureType === 'BASE' && b.pos.x === updatedNpc.targetPos?.x && b.pos.y === updatedNpc.targetPos?.y);
          if (base && !updatedNpc.equipment.pickaxe && updatedNpc.role === 'WORKER') {
             if (newState.resources[ResourceType.WOOD] >= TOOL_COSTS.PICKAXE[ResourceType.WOOD]!) {
                updatedNpc.state = NPCState.CRAFTING;
                updatedNpc.actionTimer = 30;
                updatedNpc.thought = "Crafting pickaxe...";
                return updatedNpc;
             }
          }

          // Check if at Construction Site
          const building = newState.buildings.find(b => b.pos.x === updatedNpc.targetPos?.x && b.pos.y === updatedNpc.targetPos?.y);
          if (building && !building.completed && updatedNpc.role === 'BUILDER') {
             updatedNpc.state = NPCState.BUILDING;
             updatedNpc.actionTimer = 10; // Ticks per build increment
             return updatedNpc;
          }

          // Check if at Farm
          if (building && building.structureType === 'FARM' && building.completed && updatedNpc.role === 'FARMER') {
             updatedNpc.state = NPCState.FARMING;
             updatedNpc.actionTimer = 50; 
             return updatedNpc;
          }

          // Check Resource Tile
          const tile = newState.map[updatedNpc.targetPos.y][updatedNpc.targetPos.x];
          if (tile === TileType.FOREST || tile === TileType.MOUNTAIN) {
            updatedNpc.state = NPCState.GATHERING;
            updatedNpc.actionTimer = 20; 
          } else {
            updatedNpc.state = NPCState.IDLE;
            updatedNpc.targetPos = null;
          }
        } else {
          updatedNpc.pos = moveTowards(updatedNpc, updatedNpc.targetPos);
        }
      } else {
        updatedNpc.state = NPCState.IDLE;
      }
    } 
    // --- CRAFTING STATE ---
    else if (updatedNpc.state === NPCState.CRAFTING) {
       updatedNpc.actionTimer--;
       if (updatedNpc.actionTimer <= 0) {
          if (newState.resources[ResourceType.WOOD] >= TOOL_COSTS.PICKAXE[ResourceType.WOOD]!) {
             newState.resources[ResourceType.WOOD] -= TOOL_COSTS.PICKAXE[ResourceType.WOOD]!;
             updatedNpc.equipment.pickaxe = true;
             newState.logs.unshift({ id: `crf_${Date.now()}`, timestamp: new Date().toLocaleTimeString(), message: `${updatedNpc.name} crafted a Pickaxe.`, type: 'SUCCESS'});
          }
          updatedNpc.state = NPCState.IDLE;
       }
    }
    // --- BUILDING STATE ---
    else if (updatedNpc.state === NPCState.BUILDING) {
       updatedNpc.actionTimer--;
       if (updatedNpc.actionTimer <= 0) {
          // Find the building again (reference might change in array map)
          const buildingIndex = newState.buildings.findIndex(b => b.pos.x === updatedNpc.targetPos?.x && b.pos.y === updatedNpc.targetPos?.y);
          if (buildingIndex > -1) {
             const b = { ...newState.buildings[buildingIndex] };
             b.constructionProgress += 10;
             if (b.constructionProgress >= b.maxConstructionProgress) {
                b.completed = true;
                newState.logs.unshift({ id: `bld_fin_${Date.now()}`, timestamp: new Date().toLocaleTimeString(), message: `${b.name} construction complete!`, type: 'SUCCESS'});
             }
             newState.buildings[buildingIndex] = b;
          }
          
          updatedNpc.actionTimer = 10; // Reset for next whack
          // If complete, stop
          if (newState.buildings[buildingIndex]?.completed) {
             updatedNpc.state = NPCState.IDLE;
          }
       }
    }
    // --- FARMING STATE ---
    else if (updatedNpc.state === NPCState.FARMING) {
       updatedNpc.actionTimer--;
       if (updatedNpc.actionTimer <= 0) {
          newState.resources[ResourceType.FOOD] += 5;
          updatedNpc.actionTimer = 100; // Reset
          // Small chance to finish
          if (Math.random() < 0.2) updatedNpc.state = NPCState.IDLE;
       }
    }
    // --- GATHERING STATE ---
    else if (updatedNpc.state === NPCState.GATHERING) {
      updatedNpc.actionTimer--;
      if (updatedNpc.actionTimer <= 0) {
        // Finished Gathering
        if (updatedNpc.targetPos) {
          const tile = newState.map[updatedNpc.targetPos.y][updatedNpc.targetPos.x];
          
          let gathered = '';
          let secondary = '';
          
          if (tile === TileType.FOREST) {
            newState.resources[ResourceType.WOOD] += 5;
            gathered = 'wood';
            
            // Chance to find an apple
            if (Math.random() < 0.25) {
                newState.resources[ResourceType.FOOD] += 3;
                secondary = ' & an apple';
            }

             // Chance to destroy tree
             if (Math.random() > 0.3) newState.map[updatedNpc.targetPos.y][updatedNpc.targetPos.x] = TileType.GRASS;
          
          } else if (tile === TileType.MOUNTAIN) {
             if (updatedNpc.equipment.pickaxe) {
               newState.resources[ResourceType.STONE] += 5;
               gathered = 'stone';
             } else {
               // Tried to mine without pickaxe? Shouldnt happen due to logic, but fail safe
               updatedNpc.thought = "Need a pickaxe!";
               updatedNpc.state = NPCState.IDLE;
               return updatedNpc;
             }
             
             // Mining rarely destroys mountains
             if (Math.random() > 0.8) newState.map[updatedNpc.targetPos.y][updatedNpc.targetPos.x] = TileType.FLOOR; // Turns to floor
          }

          if (Math.random() < 0.1 || secondary) {
             newState.logs.unshift({
                id: `log_${Date.now()}_${updatedNpc.id}`,
                timestamp: new Date().toLocaleTimeString(),
                message: `${updatedNpc.name} gathered ${gathered}${secondary}.`,
                type: 'SUCCESS'
             });
          }
        }
        updatedNpc.state = NPCState.IDLE;
        updatedNpc.targetPos = null;
      }
    }

    return updatedNpc;
  });

  // Random Events (Rare)
  if (Math.random() < 0.005) { // 0.5% chance per tick
    const eventType = Math.random();
    if (eventType < 0.5) {
       newState.logs.unshift({ id: `evt_${Date.now()}`, timestamp: new Date().toLocaleTimeString(), message: "A mysterious bird flew over the colony.", type: 'INFO'});
    } else {
       newState.resources[ResourceType.FOOD] = Math.max(0, newState.resources[ResourceType.FOOD] - 2);
       newState.logs.unshift({ id: `evt_${Date.now()}`, timestamp: new Date().toLocaleTimeString(), message: "Rats ate some food supplies!", type: 'DANGER'});
    }
  }

  return newState;
};