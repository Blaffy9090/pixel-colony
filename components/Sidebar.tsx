import React from 'react';
import { GameState, ResourceType, NPC, Building, StructureType, NPCRole } from '../types';
import { Heart, Pickaxe, MapPin, Zap, User, Home, Trees, Mountain, Archive, Hammer, Shield, Wheat, Search } from 'lucide-react';
import { BUILDING_COSTS } from '../constants';

interface SidebarProps {
  gameState: GameState;
  onAction: (action: string, payload?: any) => void;
  onBuildSelect: (type: StructureType) => void;
  isBuildMode: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ gameState, onAction, onBuildSelect, isBuildMode }) => {
  const selectedEntity = gameState.npcs.find(n => n.id === gameState.selectedEntityId) || 
                         gameState.buildings.find(b => b.id === gameState.selectedEntityId);

  const roles: NPCRole[] = ['WORKER', 'BUILDER', 'FARMER', 'GUARD'];

  return (
    <div className="w-96 flex flex-col gap-4 p-4 bg-slate-800 border-l border-slate-700 h-screen overflow-hidden text-sm shrink-0">
      
      {/* Header Stats */}
      <div className="bg-slate-900 p-4 rounded-lg shadow-inner">
        <h2 className="text-xl font-bold text-amber-500 mb-1 font-mono uppercase truncate">{gameState.colonyName}</h2>
        <div className="text-xs text-slate-500 mb-3 font-mono">
           EPOCH: {gameState.epoch} | TIME: {gameState.tickCount}
        </div>
        <div className="grid grid-cols-2 gap-3 text-slate-300">
          <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
            <Trees size={16} className="text-green-500"/> 
            <span className="font-mono">{gameState.resources[ResourceType.WOOD]}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
            <Mountain size={16} className="text-gray-400"/>
            <span className="font-mono">{gameState.resources[ResourceType.STONE]}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white">F</div>
            <span className="font-mono">{gameState.resources[ResourceType.FOOD]}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded">
            <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white">★</div>
            <span className="font-mono">{gameState.resources[ResourceType.FATE]}</span>
          </div>
        </div>
      </div>

      {/* Selected Entity */}
      <div className="bg-slate-900 p-4 rounded-lg shadow-inner min-h-[160px]">
        {selectedEntity ? (
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                {'role' in selectedEntity ? <User size={20} className="text-blue-400"/> : <Home size={20} className="text-orange-400"/>}
                <span className="text-lg font-bold text-white">{selectedEntity.name}</span>
            </div>
            
            {'role' in selectedEntity ? (
               <div className="space-y-2 text-slate-300">
                  <div className="flex items-center gap-2"><Heart size={14} className="text-red-500"/> <span className="w-12">HP:</span> {(selectedEntity as NPC).health} / {(selectedEntity as NPC).maxHealth}</div>
                  <div className="flex items-center gap-2"><Pickaxe size={14} className="text-yellow-500"/> <span className="w-12">Job:</span> {(selectedEntity as NPC).role}</div>
                  <div className="flex items-center gap-2"><MapPin size={14} className="text-blue-500"/> <span className="w-12">State:</span> {(selectedEntity as NPC).state}</div>
                  
                  <div className="flex gap-2 text-xs mt-1">
                     {(selectedEntity as NPC).equipment.pickaxe && <span className="bg-slate-700 px-1 rounded text-gray-300">⛏ Pickaxe</span>}
                     {(selectedEntity as NPC).equipment.sword && <span className="bg-slate-700 px-1 rounded text-gray-300">⚔ Sword</span>}
                  </div>

                  <div className="bg-slate-800 p-2 rounded italic text-gray-400 text-xs mt-2 border border-slate-700">
                    "{(selectedEntity as NPC).thought}"
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => onAction('BLESS')}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1 px-2 rounded text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                      disabled={gameState.resources[ResourceType.FATE] < 5}
                    >
                      <Zap size={14}/> Bless (5★)
                    </button>
                    <button 
                      onClick={() => onAction('CYCLE_ROLE')}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-1 px-2 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      Cycle Role
                    </button>
                  </div>
               </div>
            ) : (
               <div className="space-y-1 text-slate-300">
                 <div>Type: {(selectedEntity as Building).structureType}</div>
                 {!(selectedEntity as Building).completed ? (
                    <div className="text-yellow-400 text-xs">
                        Under Construction: {(selectedEntity as Building).constructionProgress}%
                    </div>
                 ) : (
                    <div className="text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Operational</div>
                 )}
               </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <Archive size={24} className="opacity-50"/>
            <span className="italic">Select an entity to inspect</span>
          </div>
        )}
      </div>

      {/* Construction Panel */}
      <div className="bg-slate-900 p-2 rounded-lg shadow-inner">
         <div className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider flex items-center gap-2">
           <Hammer size={12}/> Construction
         </div>
         <div className="grid grid-cols-2 gap-2">
             <button 
                onClick={() => onBuildSelect('FARM')}
                disabled={isBuildMode}
                className={`p-2 rounded border border-slate-700 flex flex-col items-center gap-1 ${isBuildMode ? 'opacity-50' : 'hover:bg-slate-800'}`}
             >
                <Wheat size={16} className="text-yellow-500"/>
                <span className="text-xs font-bold text-slate-300">Farm</span>
                <span className="text-[10px] text-slate-500">30W 10S</span>
             </button>
             <button 
                onClick={() => onBuildSelect('HOUSE')}
                disabled={isBuildMode}
                className={`p-2 rounded border border-slate-700 flex flex-col items-center gap-1 ${isBuildMode ? 'opacity-50' : 'hover:bg-slate-800'}`}
             >
                <Home size={16} className="text-blue-400"/>
                <span className="text-xs font-bold text-slate-300">House</span>
                <span className="text-[10px] text-slate-500">40W</span>
             </button>
         </div>
         {isBuildMode && <div className="text-center text-xs text-amber-500 mt-2 animate-pulse">Select location to build... (Right click cancel)</div>}
      </div>

      {/* Event Log */}
      <div className="flex-1 bg-slate-900 p-2 rounded-lg shadow-inner overflow-hidden flex flex-col min-h-0">
         <div className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider flex justify-between items-center px-1">
           <span>Colony Logs</span>
           <span className="text-[10px] bg-slate-800 px-1 rounded">{gameState.logs.length} entries</span>
         </div>
         <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
           {gameState.logs.map((log) => (
             <div key={log.id} className="text-xs border-b border-slate-800 pb-2 last:border-0 hover:bg-slate-800/30 p-1 rounded transition-colors">
               <div className="text-slate-500 font-mono text-[10px] mb-0.5">{log.timestamp}</div>
               <div className={`${log.type === 'DANGER' ? 'text-red-400 font-semibold' : log.type === 'SUCCESS' ? 'text-green-400' : 'text-slate-300'}`}>
                 {log.message}
               </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
};

export default Sidebar;
