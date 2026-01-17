import React, { useEffect, useMemo } from 'react';
import type { Room } from '../engine/types';

interface MapViewProps {
    rooms: Record<string, Room>;
    currentRoomId: string;
    characterPositions: Record<string, string>; // charId -> roomId
    characterNames: Record<string, string>; // charId -> name
    onClose: () => void;
    onMove: (direction: string) => void; // Called when arrow key moves player
}

const ROOM_WIDTH = 120;
const ROOM_HEIGHT = 50;
const SPACING_X = 180;
const SPACING_Y = 100;

export const MapView: React.FC<MapViewProps> = ({ rooms, currentRoomId, characterPositions, characterNames, onClose, onMove }) => {
    const roomList = Object.values(rooms);

    // Handle Escape key to close and arrow keys for movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            // Arrow key movement
            const arrowToDir: Record<string, string> = {
                'ArrowUp': 'north',
                'ArrowDown': 'south',
                'ArrowLeft': 'west',
                'ArrowRight': 'east'
            };

            const dir = arrowToDir[e.key];
            if (dir) {
                e.preventDefault();
                const currentRoom = rooms[currentRoomId];
                if (currentRoom?.exits[dir]) {
                    onMove(dir);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onMove, rooms, currentRoomId]);

    // Calculate room positions with 3D grid support (levels)
    const { positions, floorBounds } = useMemo(() => {
        const pos: Record<string, { x: number; y: number; gridX: number; gridY: number; gridZ: number }> = {};
        const grid: Record<string, string> = {}; // "x,y,z" -> roomId
        const visited = new Set<string>();

        // Direction mapping
        const dirToOffset: Record<string, { dx: number; dy: number; dz: number }> = {
            'north': { dx: 0, dy: -1, dz: 0 },
            'south': { dx: 0, dy: 1, dz: 0 },
            'east': { dx: 1, dy: 0, dz: 0 },
            'west': { dx: -1, dy: 0, dz: 0 },
            'up': { dx: 0, dy: 0, dz: 1 },
            'down': { dx: 0, dy: 0, dz: -1 }
        };

        const oppositeDir: Record<string, string> = {
            'north': 'south', 'south': 'north',
            'east': 'west', 'west': 'east',
            'up': 'down', 'down': 'up'
        };

        const startId = roomList.find(r => r.id === 'foyer')?.id || roomList[0]?.id;
        if (!startId) return { positions: {}, floorBounds: {} };

        // Initial BFS to assign Grid coordinates (gx, gy, gz)
        const queue: { id: string; gx: number; gy: number; gz: number }[] = [
            { id: startId, gx: 0, gy: 0, gz: 0 }
        ];
        visited.add(startId);

        // Temp storage for grid coordinates
        const gridCoords: Record<string, { gx: number; gy: number; gz: number }> = {};
        gridCoords[startId] = { gx: 0, gy: 0, gz: 0 };
        grid[`0,0,0`] = startId;

        while (queue.length > 0) {
            const { id, gx, gy, gz } = queue.shift()!;
            const room = rooms[id];
            if (!room) continue;

            Object.entries(room.exits).forEach(([dir, targetId]) => {
                const offset = dirToOffset[dir.toLowerCase()];
                if (!offset || !rooms[targetId]) return;

                if (visited.has(targetId)) return;

                const targetRoom = rooms[targetId];
                if (!targetRoom) return;

                // Determine projected coordinates first
                let newGx = gx + offset.dx;
                let newGy = gy + offset.dy;
                let newGz = gz + offset.dz;
                let key = `${newGx},${newGy},${newGz}`;

                if (visited.has(targetId)) {
                    // This block is actually unreachable because of the check at the top, 
                    // but if we removed the top check to support validating existing nodes:
                    const existingPos = pos[targetId];
                    if (existingPos && (existingPos.gridX !== newGx || existingPos.gridY !== newGy || existingPos.gridZ !== newGz)) {
                        console.log(`Grid Mismatch: ${targetRoom.name} should be at (${newGx},${newGy},${newGz}) but is at (${existingPos.gridX},${existingPos.gridY},${existingPos.gridZ})`);
                    }
                    return;
                }

                // Check bidirectional exit
                const expectedReturn = oppositeDir[dir.toLowerCase()];
                if (expectedReturn && targetRoom.exits[expectedReturn] !== id) {
                    if (dir === 'up' || dir === 'down') {
                        console.warn(`Grid Error: ${room.name} (${dir}) -> ${targetRoom.name} missing return '${expectedReturn}'`);
                    } else {
                        console.log(`Grid Warning: ${room.name} (${dir}) -> ${targetRoom.name} missing return '${expectedReturn}'`);
                    }
                }
                // Simple collision handling (spiral search if occupied)
                if (grid[key] && grid[key] !== targetId) {
                    let found = false;
                    for (let dist = 1; dist <= 3 && !found; dist++) {
                        // Check neighbor cells on same floor
                        for (const [dx, dy] of [[dist, 0], [-dist, 0], [0, dist], [0, -dist]]) {
                            const altGx = newGx + dx;
                            const altGy = newGy + dy;
                            const altKey = `${altGx},${altGy},${newGz}`;
                            if (!grid[altKey]) {
                                newGx = altGx;
                                newGy = altGy;
                                found = true;
                                break;
                            }
                        }
                    }
                }

                grid[`${newGx},${newGy},${newGz}`] = targetId;
                gridCoords[targetId] = { gx: newGx, gy: newGy, gz: newGz };
                visited.add(targetId);
                queue.push({ id: targetId, gx: newGx, gy: newGy, gz: newGz });
            });
        }

        // Handle disconnected rooms - put them on floor 0 far away?
        let fallbackRow = 5;
        roomList.forEach(room => {
            if (!gridCoords[room.id]) {
                gridCoords[room.id] = { gx: 0, gy: fallbackRow++, gz: 0 };
            }
        });

        // Determine bounds per floor to configure visual layout
        const floors: Record<number, { minX: number; maxX: number; minY: number; maxY: number }> = {};
        Object.values(gridCoords).forEach(({ gx, gy, gz }) => {
            if (!floors[gz]) floors[gz] = { minX: gx, maxX: gx, minY: gy, maxY: gy };
            else {
                floors[gz].minX = Math.min(floors[gz].minX, gx);
                floors[gz].maxX = Math.max(floors[gz].maxX, gx);
                floors[gz].minY = Math.min(floors[gz].minY, gy);
                floors[gz].maxY = Math.max(floors[gz].maxY, gy);
            }
        });

        // Sort floors (e.g., highest Z at top visually? or bottom?) 
        // Typically higher floors are 'up', so smaller Y coordinate. But let's stack them distinctly.
        // Let's enforce a visual gap between floors.
        const sortedLevels = Object.keys(floors).map(Number).sort((a, b) => b - a); // Higher floors first (top of screen)

        let currentVisualY = 0;
        const floorVisualOffsets: Record<number, number> = {};

        const FLOOR_PADDING = 150; // Pixels between floors

        sortedLevels.forEach(z => {
            const bounds = floors[z];
            const floorHeight = (bounds.maxY - bounds.minY + 1) * SPACING_Y;

            floorVisualOffsets[z] = currentVisualY;
            currentVisualY += floorHeight + FLOOR_PADDING;
        });

        // Finalize positions
        const floorBounds: Record<number, { x: number, y: number, w: number, h: number }> = {};

        Object.entries(gridCoords).forEach(([id, { gx, gy, gz }]) => {
            // Relativize Y within the floor
            const bounds = floors[gz];
            const relY = gy - bounds.minY; // 0-based index within floor

            const screenX = gx * SPACING_X; // Allow X to be global or relative? Global works if not too wide.
            // Actually, let's keep X consistent to show alignment (e.g. up/down stairs align vertically if gx is same)

            const screenY = floorVisualOffsets[gz] + (relY * SPACING_Y);

            pos[id] = { x: screenX, y: screenY, gridX: gx, gridY: gy, gridZ: gz };
        });

        // Calculate visual bounds for green boxes
        sortedLevels.forEach(z => {
            const bounds = floors[z];
            const x = bounds.minX * SPACING_X - 50;
            const w = (bounds.maxX - bounds.minX) * SPACING_X + ROOM_WIDTH + 100;

            const y = floorVisualOffsets[z] - 50; // offset start
            const h = ((bounds.maxY - bounds.minY) * SPACING_Y) + ROOM_HEIGHT + 100;

            floorBounds[z] = { x, y, w, h };
        });

        return { positions: pos, floorBounds };
    }, [rooms, roomList]);

    // Calculate viewBox
    const viewBox = useMemo(() => {
        const allPos = Object.values(positions);
        if (allPos.length === 0) return "0 0 800 600";

        const allX = allPos.map(p => p.x);
        const allY = allPos.map(p => p.y);

        // Include floor bounds in viewBox calculation
        const allBounds = Object.values(floorBounds);
        const minX = Math.min(...allX, ...allBounds.map(b => b.x)) - 50;
        const maxX = Math.max(...allX.map(x => x + ROOM_WIDTH), ...allBounds.map(b => b.x + b.w)) + 50;
        const minY = Math.min(...allY, ...allBounds.map(b => b.y)) - 50;
        const maxY = Math.max(...allY.map(y => y + ROOM_HEIGHT), ...allBounds.map(b => b.y + b.h)) + 50;

        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    }, [positions, floorBounds]);

    // Connections
    const connections = useMemo(() => {
        const conns: any[] = [];
        const seen = new Set<string>();

        roomList.forEach(room => {
            const fromPos = positions[room.id];
            if (!fromPos) return;

            Object.entries(room.exits).forEach(([dir, targetId]) => {
                const toPos = positions[targetId];
                if (!toPos) return;

                // Unique ID for connection
                const ids = [room.id, targetId].sort().join('-');
                if (seen.has(ids)) return;
                seen.add(ids);

                conns.push({
                    from: fromPos,
                    to: toPos,
                    isCrossFloor: fromPos.gridZ !== toPos.gridZ,
                    fromZ: fromPos.gridZ,
                    toZ: toPos.gridZ
                });
            });
        });
        return conns;
    }, [positions, roomList]);

    return (
        <div className="map-overlay" onClick={onClose}>
            <div className="map-container" onClick={e => e.stopPropagation()}>
                <div className="map-header">
                    <h2>*** MAP ***</h2>
                    <button className="map-close" onClick={onClose}>✕</button>
                </div>
                <svg className="map-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
                    {/* Floor Boxes */}
                    {Object.entries(floorBounds).map(([z, bounds]) => (
                        <rect
                            key={`floor-${z}`}
                            x={bounds.x}
                            y={bounds.y}
                            width={bounds.w}
                            height={bounds.h}
                            fill="none"
                            stroke="#00ff00"
                            strokeWidth="2"
                            rx="15"
                            style={{ opacity: 0.3 }}
                        />
                    ))}
                    {Object.keys(floorBounds).map(z => {
                        const b = floorBounds[Number(z)];
                        return (
                            <text
                                key={`label-${z}`}
                                x={b.x + 10}
                                y={b.y + 25}
                                fill="#00ff00"
                                fontSize="14"
                                opacity="0.7"
                            >
                                {Number(z) === 0 ? 'Ground Floor' : (Number(z) > 0 ? `Level ${z}` : `Basement ${Math.abs(Number(z))}`)}
                            </text>
                        );
                    })}

                    {/* Connections */}
                    {connections.map((conn, i) => {
                        const x1 = conn.from.x + ROOM_WIDTH / 2;
                        const y1 = conn.from.y + ROOM_HEIGHT / 2;
                        const x2 = conn.to.x + ROOM_WIDTH / 2;
                        const y2 = conn.to.y + ROOM_HEIGHT / 2;

                        let pathD = '';

                        if (conn.isCrossFloor) {
                            // Determine which is visually lower/higher level
                            // Note: We render higher Z at TOP (lower Y value)
                            // So Higher Level (Z=1) has LOWER Y value than Ground (Z=0)

                            const z1 = conn.fromZ;
                            const z2 = conn.toZ;

                            // Let's identify the 'Lower Level' room (lower Z) and 'Higher Level' room (higher Z)
                            const lowerZPos = z1 < z2 ? conn.from : conn.to;  // e.g. Ground (Visually Bottom)
                            const higherZPos = z1 > z2 ? conn.from : conn.to; // e.g. Level 1 (Visually Top)

                            // "Top left of bounding box of room on lower level"
                            const xStart = lowerZPos.x;
                            const yStart = lowerZPos.y;

                            // "Lower left of bounding box of room on higher level"
                            // (Bottom-Left)
                            const xEnd = higherZPos.x;
                            const yEnd = higherZPos.y + ROOM_HEIGHT;

                            pathD = `M ${xStart} ${yStart} L ${xEnd} ${yEnd}`;
                        } else {
                            // Standard L-shape for same floor
                            const x1 = conn.from.x + ROOM_WIDTH / 2;
                            const y1 = conn.from.y + ROOM_HEIGHT / 2;
                            const x2 = conn.to.x + ROOM_WIDTH / 2;
                            const y2 = conn.to.y + ROOM_HEIGHT / 2;
                            const midY = (y1 + y2) / 2;
                            pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
                        }

                        return (
                            <path
                                key={`conn-${i}`}
                                d={pathD}
                                className="map-connection"
                                strokeDasharray={conn.isCrossFloor ? "10,10" : "none"}
                                stroke={conn.isCrossFloor ? "#00ff00" : "#00ff00"}
                                opacity={conn.isCrossFloor ? 0.5 : 1}
                                fill="none"
                            />
                        );
                    })}

                    {/* Rooms */}
                    {roomList.map((room) => {
                        const pos = positions[room.id];
                        if (!pos) return null;
                        const isHere = room.id === currentRoomId;
                        const displayName = room.name.replace('The ', '');
                        const maxChars = 14;
                        const baseFontSize = 12;
                        const fontSize = displayName.length > maxChars
                            ? Math.max(8, baseFontSize * (maxChars / displayName.length))
                            : baseFontSize;

                        return (
                            <g key={room.id}>
                                <rect
                                    x={pos.x}
                                    y={pos.y}
                                    width={ROOM_WIDTH}
                                    height={ROOM_HEIGHT}
                                    className={`map-room ${isHere ? 'map-room-current' : ''}`}
                                />
                                <text
                                    x={pos.x + ROOM_WIDTH / 2}
                                    y={pos.y + ROOM_HEIGHT / 2}
                                    className="map-room-text"
                                    style={{ fontSize: `${fontSize}px` }}
                                >
                                    {displayName}
                                </text>
                                {isHere && (
                                    <text
                                        x={pos.x + ROOM_WIDTH / 2}
                                        y={pos.y + ROOM_HEIGHT + 15}
                                        className="map-you-marker"
                                    >
                                        ★ YOU
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Characters */}
                    {Object.entries(
                        Object.entries(characterPositions).reduce((acc, [charId, roomId]) => {
                            if (!acc[roomId]) acc[roomId] = [];
                            acc[roomId].push(charId);
                            return acc;
                        }, {} as Record<string, string[]>)
                    ).map(([roomId, charIds]) => {
                        const pos = positions[roomId];
                        if (!pos) return null;
                        const names = charIds.map(id => characterNames[id] || id).join(', ');
                        return (
                            <g key={`chars-${roomId}`}>
                                <circle
                                    cx={pos.x + ROOM_WIDTH - 15}
                                    cy={pos.y + 15}
                                    r={10}
                                    className="map-character-marker"
                                >
                                    <title>{names}</title>
                                </circle>
                                <text
                                    x={pos.x + ROOM_WIDTH - 15}
                                    y={pos.y + 19}
                                    className="map-character-count"
                                >
                                    {charIds.length}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <p className="map-hint">Press ESC or click anywhere to close</p>
            </div>
        </div>
    );
};
