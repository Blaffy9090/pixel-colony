import React, { useEffect, useState, useRef } from 'react';
import { GameState, ResourceType, SaveMeta, StructureType, NPCRole } from './types';
import { TICK_RATE_MS } from './constants';
import { createInitialState, updateGameState, placeBuilding } from './utils/gameLogic';
import GameCanvas from './components/GameCanvas';
import Sidebar from './components/Sidebar';
import { Play, Pause, Save, LogOut, Trash2 } from 'lucide-react';

type ViewState = 'MENU' | 'GAME';
type SpeedMultiplier = 1 | 2 | 4;

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('MENU');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState<SpeedMultiplier>(1);
  const [buildMode, setBuildMode] = useState<StructureType | null>(null);
  
  // Menu State
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [newGameName, setNewGameName] = useState('');
  const [newGameSeed, setNewGameSeed] = useState('');

  const intervalRef = useRef<NodeJS.Timer | null>(null);

  // Load saves list on mount
  useEffect(() => {
    refreshSavesList();
    
    // Prevent context menu globally for right-click cancel
    const handleContextMenu = (e: MouseEvent) => {
       if (buildMode) {
         e.preventDefault();
         setBuildMode(null);
       }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [buildMode]);

  const refreshSavesList = () => {
    const savesIndex = localStorage.getItem('pco_saves_index');
    if (savesIndex) {
      setSaves(JSON.parse(savesIndex));
    }
  };

  const saveCurrentGame = (state: GameState) => {
    const saveId = `save_${state.colonyName.replace(/\s+/g, '_')}_${state.seed}`;
    
    // Update Meta Index
    const newMeta: SaveMeta = {
      id: saveId,
      name: state.colonyName,
      lastPlayed: Date.now(),
      epoch: state.epoch
    };

    const existingSaves = [...saves];
    const index = existingSaves.findIndex(s => s.id === saveId);
    if (index >= 0) {
      existingSaves[index] = newMeta;
    } else {
      existingSaves.push(newMeta);
    }

    localStorage.setItem('pco_saves_index', JSON.stringify(existingSaves));
    localStorage.setItem(`pco_save_${saveId}`, JSON.stringify(state));
    
    setSaves(existingSaves);
  };

  const loadGame = (saveId: string) => {
    const saveData = localStorage.getItem(`pco_save_${saveId}`);
    if (saveData) {
      try {
        const parsedState = JSON.parse(saveData);
        setGameState(parsedState);
        setView('GAME');
        setIsPaused(false);
      } catch (e) {
        alert("Failed to load save file.");
      }
    }
  };

  const deleteSave = (saveId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Delete this save permanently?")) return;

    const newSaves = saves.filter(s => s.id !== saveId);
    localStorage.setItem('pco_saves_index', JSON.stringify(newSaves));
    localStorage.removeItem(`pco_save_${saveId}`);
    setSaves(newSaves);
  };

  const startNewGame = () => {
    if (!newGameName.trim()) {
      alert("Please enter a colony name");
      return;
    }
    const seed = newGameSeed ? parseInt(newGameSeed) : Math.floor(Math.random() * 100000);
    const newState = createInitialState(newGameName, seed);
    setGameState(newState);
    saveCurrentGame(newState); // Initial save
    setView('GAME');
    setIsPaused(false);
  };

  // Auto-save every 10 seconds if in game
  useEffect(() => {
    if (view !== 'GAME' || !gameState) return;
    const saveInterval = setInterval(() => {
      saveCurrentGame(gameState);
    }, 10000);
    return () => clearInterval(saveInterval);
  }, [gameState, view]);

  // Main Game Loop
  useEffect(() => {
    if (view !== 'GAME' || isPaused || !gameState) {
      if (intervalRef.current) clearInterval(intervalRef.current as unknown as number);
      return;
    }

    const currentTickRate = Math.floor(TICK_RATE_MS / gameSpeed);

    intervalRef.current = setInterval(() => {
      setGameState((prev) => prev ? updateGameState(prev) : null);
    }, currentTickRate);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current as unknown as number);
    };
  }, [isPaused, view, gameSpeed, gameState]); // Ensure game updates on speed change

  const handleEntitySelect = (id: string | null) => {
    setGameState(prev => prev ? ({ ...prev, selectedEntityId: id }) : null);
  };

  const handleAction = (action: string) => {
    if (!gameState) return;
    setGameState(prev => {
      if (!prev) return null;
      const newState = { ...prev };
      
      if (action === 'BLESS' && newState.selectedEntityId) {
         if (newState.resources[ResourceType.FATE] >= 5) {
             const npcIndex = newState.npcs.findIndex(n => n.id === newState.selectedEntityId);
             if (npcIndex > -1) {
                newState.resources[ResourceType.FATE] -= 5;
                newState.npcs[npcIndex].health = Math.min(newState.npcs[npcIndex].maxHealth, newState.npcs[npcIndex].health + 50);
                newState.npcs[npcIndex].thought = "I feel divine power!";
                newState.logs.unshift({
                   id: `bless_${Date.now()}`,
                   timestamp: new Date().toLocaleTimeString(),
                   message: `You blessed ${newState.npcs[npcIndex].name}.`,
                   type: 'SUCCESS'
                });
             }
         }
      } else if (action === 'CYCLE_ROLE' && newState.selectedEntityId) {
         const npcIndex = newState.npcs.findIndex(n => n.id === newState.selectedEntityId);
         if (npcIndex > -1) {
            const roles: NPCRole[] = ['WORKER', 'BUILDER', 'FARMER', 'GUARD'];
            const currentRoleIndex = roles.indexOf(newState.npcs[npcIndex].role);
            const nextRole = roles[(currentRoleIndex + 1) % roles.length];
            newState.npcs[npcIndex].role = nextRole;
            // Reset state to avoid getting stuck
            newState.npcs[npcIndex].state = 'IDLE' as any;
            newState.npcs[npcIndex].targetPos = null;
            newState.logs.unshift({
               id: `role_${Date.now()}`,
               timestamp: new Date().toLocaleTimeString(),
               message: `${newState.npcs[npcIndex].name} is now a ${nextRole}.`,
               type: 'INFO'
            });
         }
      }
      return newState;
    });
  };

  const handleBuildSelect = (type: StructureType) => {
    setBuildMode(type);
  };

  const handlePlaceBuilding = (x: number, y: number) => {
    if (!gameState || !buildMode) return;
    const nextState = placeBuilding(gameState, x, y, buildMode);
    if (nextState) {
       setGameState(nextState);
       setBuildMode(null); // Exit build mode after placing
    } else {
       // Failed feedback (optional)
       alert("Cannot build here or insufficient resources.");
    }
  };

  const exitToMenu = () => {
    if (gameState) saveCurrentGame(gameState);
    setView('MENU');
    setGameState(null);
  };

  // --- RENDER MENU ---
  if (view === 'MENU') {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-200 font-sans">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          
          {/* Left: New Game */}
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 shadow-2xl flex flex-col gap-6">
            <div>
              <h1 className="text-4xl font-bold text-amber-500 font-mono mb-2">PIXEL COLONY</h1>
              <p className="text-slate-400">Establish a thriving settlement in a hostile procedural world.</p>
            </div>
            
            <div className="space-y-4 bg-slate-800/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2">START NEW EXPEDITION</h2>
              <div>
                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">Colony Name</label>
                <input 
                  type="text" 
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                  placeholder="e.g. Ironhold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">World Seed (Optional)</label>
                <input 
                  type="number" 
                  value={newGameSeed}
                  onChange={(e) => setNewGameSeed(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                  placeholder="Random"
                />
              </div>
              <button 
                onClick={startNewGame}
                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-3 rounded transition-colors mt-2"
              >
                EMBARK
              </button>
            </div>
          </div>

          {/* Right: Load Game */}
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 shadow-2xl flex flex-col">
            <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-4 mb-4">LOAD COLONY</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[400px]">
              {saves.length === 0 ? (
                <div className="text-slate-600 italic text-center py-10">No saved colonies found.</div>
              ) : (
                saves.sort((a,b) => b.lastPlayed - a.lastPlayed).map(save => (
                  <div 
                    key={save.id} 
                    onClick={() => loadGame(save.id)}
                    className="group bg-slate-800 hover:bg-slate-700 p-4 rounded border border-slate-700 cursor-pointer transition-all flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-lg text-slate-200 group-hover:text-amber-400">{save.name}</div>
                      <div className="text-xs text-slate-500">
                        Last played: {new Date(save.lastPlayed).toLocaleDateString()} | Epoch {save.epoch}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteSave(save.id, e)}
                      className="text-slate-600 hover:text-red-500 p-2"
                      title="Delete Save"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER GAME ---
  if (!gameState) return null;

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      
      {/* Main Viewport */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Top Bar */}
        <div className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={exitToMenu} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-bold">
               <LogOut size={16}/> MENU
             </button>
             <div className="h-6 w-px bg-slate-700"></div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPaused(!isPaused)}
                  className={`p-2 rounded transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-500' : 'hover:bg-slate-700 text-slate-300'}`}
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                </button>
                
                <div className="flex bg-slate-800 rounded p-1">
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setGameSpeed(speed as SpeedMultiplier)}
                      className={`px-3 py-1 text-xs font-bold rounded ${gameSpeed === speed ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <span className="text-xs text-slate-500 mr-2 flex items-center gap-1">
               <Save size={12}/> Auto-saving
             </span>
             <div className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono text-amber-500">
               Day {(gameState.tickCount / 1000).toFixed(1)}
             </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-slate-950 relative">
           <GameCanvas 
              gameState={gameState} 
              onSelect={handleEntitySelect} 
              buildMode={buildMode}
              onBuild={handlePlaceBuilding}
           />
           
           {/* Notification Overlays */}
           {gameState.resources[ResourceType.FOOD] <= 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-6 py-2 rounded-full shadow-lg animate-pulse flex items-center gap-2 z-20">
                 <span>⚠ CRITICAL: STARVATION IMMINENT</span>
              </div>
           )}
           {isPaused && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white px-8 py-4 rounded-xl backdrop-blur-sm border border-white/10 pointer-events-none z-30">
                <div className="text-2xl font-bold tracking-widest text-center">PAUSED</div>
             </div>
           )}
        </div>
      </div>

      {/* Right Sidebar */}
      <Sidebar 
         gameState={gameState} 
         onAction={handleAction} 
         onBuildSelect={handleBuildSelect}
         isBuildMode={!!buildMode}
      />
    </div>
  );
};

export default App;
