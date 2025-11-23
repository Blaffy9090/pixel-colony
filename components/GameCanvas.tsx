import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GameState, TileType, EntityType, NPCState, StructureType } from '../types';
import { COLORS, ACTUAL_TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, BUILDING_COLORS } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  onSelect: (id: string | null) => void;
  buildMode: StructureType | null;
  onBuild: (x: number, y: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onSelect, buildMode, onBuild }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // In Canvas Internal Pixels
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false); // For visual cursor update
  const isDraggingRef = useRef(false); // For logic
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Screen coords relative to canvas

  // Handle Zoom via scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    setZoom(prev => {
      const delta = -Math.sign(e.deltaY) * 0.1;
      const newZoom = Math.min(Math.max(prev + delta, 0.5), 3.0);
      return parseFloat(newZoom.toFixed(2));
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left Click: Build or Select
    if (e.button === 0) {
       isDraggingRef.current = true;
       setIsDragging(true);
       hasMovedRef.current = false;
       dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Update raw mouse pos for ghost (screen coords relative to canvas)
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      // Threshold to distinguish click vs drag
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMovedRef.current = true;
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Scale screen movement to canvas internal pixels
      setPan(prev => ({ x: prev.x + dx * scaleX, y: prev.y + dy * scaleY }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If we dragged, don't trigger click logic
    if (hasMovedRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Transform click to World Coords
    // Formula: screen_internal = world * zoom + pan_internal
    // world = (screen_internal - pan_internal) / zoom
    
    const gameX = (clickX - pan.x) / zoom;
    const gameY = (clickY - pan.y) / zoom;

    const tileX = Math.floor(gameX / ACTUAL_TILE_SIZE);
    const tileY = Math.floor(gameY / ACTUAL_TILE_SIZE);

    if (buildMode) {
      onBuild(tileX, tileY);
      return;
    }

    // Check for Entity click
    const clickedNPC = gameState.npcs.find(n => n.pos.x === tileX && n.pos.y === tileY);
    if (clickedNPC) {
      onSelect(clickedNPC.id);
      return;
    }
    
    const clickedBuilding = gameState.buildings.find(b => b.pos.x === tileX && b.pos.y === tileY);
    if (clickedBuilding) {
      onSelect(clickedBuilding.id);
      return;
    }

    onSelect(null);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Screen
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Transformations
    // pan is in internal canvas pixels, so we translate directly
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Map
    for (let y = 0; y < gameState.height; y++) {
      for (let x = 0; x < gameState.width; x++) {
        const tile = gameState.map[y][x];
        const screenX = x * ACTUAL_TILE_SIZE;
        const screenY = y * ACTUAL_TILE_SIZE;

        ctx.fillStyle = COLORS[tile] || '#000';
        ctx.fillRect(screenX, screenY, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);

        // Decor details
        if (tile === TileType.FOREST) {
           ctx.fillStyle = '#1e3a12'; 
           ctx.fillRect(screenX + 8, screenY + 8, 8, 16);
           ctx.fillRect(screenX + 4, screenY + 16, 16, 8);
        } else if (tile === TileType.MOUNTAIN) {
           ctx.fillStyle = '#4a4a4a';
           ctx.beginPath();
           ctx.moveTo(screenX + 16, screenY + 4);
           ctx.lineTo(screenX + 28, screenY + 28);
           ctx.lineTo(screenX + 4, screenY + 28);
           ctx.fill();
        } else if (tile === TileType.WATER) {
           if ((x + y + Math.floor(gameState.tickCount / 10)) % 2 === 0) {
             ctx.fillStyle = '#89cff0';
             ctx.fillRect(screenX + 8, screenY + 8, 8, 4);
           }
        }
      }
    }

    // Draw Buildings
    gameState.buildings.forEach(b => {
      const sx = b.pos.x * ACTUAL_TILE_SIZE;
      const sy = b.pos.y * ACTUAL_TILE_SIZE;
      
      if (!b.completed) {
        // Construction Site Look
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(sx, sy, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);
        ctx.setLineDash([]);
        
        // Progress bar
        ctx.fillStyle = 'black';
        ctx.fillRect(sx + 2, sy + ACTUAL_TILE_SIZE - 6, ACTUAL_TILE_SIZE - 4, 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx + 2, sy + ACTUAL_TILE_SIZE - 6, (ACTUAL_TILE_SIZE - 4) * (b.constructionProgress / b.maxConstructionProgress), 4);
      } else {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sx + 4, sy + 4, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);

        // Building Body
        ctx.fillStyle = b.color;
        ctx.fillRect(sx, sy, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);
        
        // Details based on type
        if (b.structureType === 'FARM') {
           ctx.fillStyle = '#5d4037'; // Dirt patches
           ctx.fillRect(sx + 4, sy + 4, 10, 10);
           ctx.fillRect(sx + 18, sy + 4, 10, 10);
           ctx.fillStyle = '#fde047'; // Wheat
           ctx.fillRect(sx + 6, sy + 6, 6, 6);
        } else {
          // Door
          ctx.fillStyle = '#3e2723';
          ctx.fillRect(sx + 12, sy + 18, 8, 14);
          
          // Roof
          ctx.fillStyle = '#5d4037';
          ctx.beginPath();
          ctx.moveTo(sx - 4, sy);
          ctx.lineTo(sx + 16, sy - 12);
          ctx.lineTo(sx + 36, sy);
          ctx.fill();
        }
      }

      if (b.id === gameState.selectedEntityId) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 2, sy - 2, ACTUAL_TILE_SIZE + 4, ACTUAL_TILE_SIZE + 4);
      }
    });

    // Draw NPCs
    gameState.npcs.forEach(npc => {
      const sx = npc.pos.x * ACTUAL_TILE_SIZE;
      const sy = npc.pos.y * ACTUAL_TILE_SIZE;

      const bounce = npc.state === NPCState.MOVING ? Math.sin(gameState.tickCount * 0.5) * 4 : 0;

      // Body
      ctx.fillStyle = npc.color;
      ctx.fillRect(sx + 8, sy + 8 - bounce, 16, 16);

      // Head
      ctx.fillStyle = '#ffccaa'; 
      ctx.fillRect(sx + 8, sy - bounce, 16, 8);

      // Beard 
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(sx + 8, sy + 6 - bounce, 16, 6);
      
      // Equipment visualization
      if (npc.equipment.pickaxe) {
        ctx.fillStyle = '#94a3b8'; // Iron
        ctx.fillRect(sx + 20, sy + 10 - bounce, 4, 12); // Pickaxe handle/head
      }

      // Action State Icon
      if (npc.state === NPCState.CRAFTING) {
         ctx.fillStyle = '#fbbf24';
         ctx.fillText('⚒', sx + 12, sy - 10 - bounce);
      } else if (npc.state === NPCState.BUILDING) {
         ctx.fillStyle = '#fbbf24';
         ctx.fillText('🏗', sx + 12, sy - 10 - bounce);
      }

      if (npc.id === gameState.selectedEntityId) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 6, sy - 2 - bounce, 20, 28);
      }
    });

    // Draw Ghost Building if in Build Mode
    if (buildMode && canvas) {
       // Convert mousePos (screen) to world coords for ghost
       const rect = canvas.getBoundingClientRect();
       const scaleX = canvas.width / rect.width;
       const scaleY = canvas.height / rect.height;
       
       // Coordinate math: (screen_internal - pan) / zoom
       const mx = (mousePos.x * scaleX - pan.x) / zoom;
       const my = (mousePos.y * scaleY - pan.y) / zoom;
       
       const tx = Math.floor(mx / ACTUAL_TILE_SIZE);
       const ty = Math.floor(my / ACTUAL_TILE_SIZE);

       const sx = tx * ACTUAL_TILE_SIZE;
       const sy = ty * ACTUAL_TILE_SIZE;

       ctx.globalAlpha = 0.5;
       ctx.fillStyle = BUILDING_COLORS[buildMode];
       ctx.fillRect(sx, sy, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);
       
       // Validity Check Color Overlay
       const valid = tx >= 0 && tx < gameState.width && ty >= 0 && ty < gameState.height && 
                     gameState.map[ty][tx] !== TileType.WATER && 
                     gameState.map[ty][tx] !== TileType.MOUNTAIN;

       ctx.fillStyle = valid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.5)';
       ctx.fillRect(sx, sy, ACTUAL_TILE_SIZE, ACTUAL_TILE_SIZE);
       
       ctx.globalAlpha = 1.0;
    }

    // Weather
    if (gameState.weather === 'RAIN') {
      ctx.fillStyle = 'rgba(20, 30, 60, 0.3)';
      ctx.fillRect(-pan.x/zoom, -pan.y/zoom, canvas.width/zoom, canvas.height/zoom); // cover view
      
      ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
      ctx.lineWidth = 1;
      const time = gameState.tickCount;
      for (let i = 0; i < 50; i++) {
         const rx = (i * 123 + time * 5) % (gameState.width * ACTUAL_TILE_SIZE);
         const ry = (i * 76 + time * 15) % (gameState.height * ACTUAL_TILE_SIZE);
         ctx.beginPath();
         ctx.moveTo(rx, ry);
         ctx.lineTo(rx - 5, ry + 10);
         ctx.stroke();
      }
    } else if (gameState.weather === 'NIGHT') {
      ctx.fillStyle = 'rgba(5, 5, 20, 0.6)';
      ctx.fillRect(-pan.x/zoom, -pan.y/zoom, canvas.width/zoom, canvas.height/zoom);
      
      gameState.buildings.forEach(b => {
         const sx = b.pos.x * ACTUAL_TILE_SIZE;
         const sy = b.pos.y * ACTUAL_TILE_SIZE;
         ctx.fillStyle = 'rgba(255, 220, 100, 0.8)';
         ctx.fillRect(sx + 14, sy + 6, 4, 4);
      });
    }

  }, [gameState, zoom, pan, buildMode, mousePos]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  return (
    <div className="relative overflow-hidden rounded-lg border-4 border-slate-700 shadow-2xl bg-black" 
         style={{maxWidth: '100%', maxHeight: '85vh', cursor: buildMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab'}}>
       <canvas
        ref={canvasRef}
        width={MAP_WIDTH * ACTUAL_TILE_SIZE}
        height={MAP_HEIGHT * ACTUAL_TILE_SIZE}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        className="block"
        style={{ width: '100%', height: 'auto' }} 
      />
      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none select-none">
        Zoom: {Math.round(zoom * 100)}% | Drag to Pan
      </div>
    </div>
  );
};

export default GameCanvas;