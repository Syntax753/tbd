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
                    // Map stays open - only Escape closes it
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onMove, rooms, currentRoomId]);

    // Calculate room positions using strict grid-based layout
    const positions = useMemo(() => {
        const pos: Record<string, { x: number; y: number; gridX: number; gridY: number }> = {};
        const grid: Record<string, string> = {}; // "x,y" -> roomId
        const visited = new Set<string>();

        // Direction to grid offset mapping
        const dirToOffset: Record<string, { dx: number; dy: number }> = {
            'north': { dx: 0, dy: -1 },
            'south': { dx: 0, dy: 1 },
            'east': { dx: 1, dy: 0 },
            'west': { dx: -1, dy: 0 },
            'up': { dx: 0, dy: -1 },
            'down': { dx: 0, dy: 1 }
        };

        const oppositeDir: Record<string, string> = {
            'north': 'south', 'south': 'north',
            'east': 'west', 'west': 'east',
            'up': 'down', 'down': 'up'
        };

        // Start from foyer at grid center
        const startId = roomList.find(r => r.id === 'foyer')?.id || roomList[0]?.id;
        if (!startId) {
            console.log("Invalid grid - no starting room found");
            return {};
        }

        const startGridX = 5;
        const startGridY = 5;

        // BFS to assign grid positions
        const queue: { id: string; gx: number; gy: number }[] = [
            { id: startId, gx: startGridX, gy: startGridY }
        ];
        visited.add(startId);
        pos[startId] = {
            x: startGridX * SPACING_X,
            y: startGridY * SPACING_Y,
            gridX: startGridX,
            gridY: startGridY
        };
        grid[`${startGridX},${startGridY}`] = startId;

        while (queue.length > 0) {
            const { id, gx, gy } = queue.shift()!;
            const room = rooms[id];
            if (!room) continue;

            Object.entries(room.exits).forEach(([dir, targetId]) => {
                const offset = dirToOffset[dir.toLowerCase()];
                if (!offset) {
                    console.log(`Invalid grid - unknown direction "${dir}" from ${room.name}`);
                    return;
                }

                const newGx = gx + offset.dx;
                const newGy = gy + offset.dy;
                const gridKey = `${newGx},${newGy}`;

                // Check if target room exists
                const targetRoom = rooms[targetId];
                if (!targetRoom) {
                    console.log(`Invalid grid - ${room.name} has exit ${dir} to non-existent room "${targetId}"`);
                    return;
                }

                // Check bidirectional exit
                const expectedReturn = oppositeDir[dir.toLowerCase()];
                if (expectedReturn && targetRoom.exits[expectedReturn] !== id) {
                    console.log(`Invalid grid - missing return path: ${targetRoom.name} should have "${expectedReturn}" exit back to ${room.name}`);
                }

                if (visited.has(targetId)) {
                    // Already positioned - validate grid alignment
                    const existingPos = pos[targetId];
                    if (existingPos && (existingPos.gridX !== newGx || existingPos.gridY !== newGy)) {
                        console.log(`Invalid grid - ${targetRoom.name} would need to be at (${newGx},${newGy}) but is at (${existingPos.gridX},${existingPos.gridY})`);
                    }
                    return;
                }

                // Check for collision
                if (grid[gridKey] && grid[gridKey] !== targetId) {
                    const occupant = rooms[grid[gridKey]]?.name || grid[gridKey];
                    console.log(`Invalid grid - moving ${targetRoom.name}: position (${newGx},${newGy}) occupied by ${occupant}`);
                    // Find alternative position
                    let altGx = newGx, altGy = newGy;
                    let found = false;
                    for (let offset = 1; offset <= 3 && !found; offset++) {
                        for (const [dx, dy] of [[offset, 0], [-offset, 0], [0, offset], [0, -offset]]) {
                            const key = `${newGx + dx},${newGy + dy}`;
                            if (!grid[key]) {
                                altGx = newGx + dx;
                                altGy = newGy + dy;
                                found = true;
                                console.log(`  -> Relocated to (${altGx},${altGy})`);
                                break;
                            }
                        }
                    }
                    pos[targetId] = {
                        x: altGx * SPACING_X,
                        y: altGy * SPACING_Y,
                        gridX: altGx,
                        gridY: altGy
                    };
                    grid[`${altGx},${altGy}`] = targetId;
                } else {
                    pos[targetId] = {
                        x: newGx * SPACING_X,
                        y: newGy * SPACING_Y,
                        gridX: newGx,
                        gridY: newGy
                    };
                    grid[gridKey] = targetId;
                }

                visited.add(targetId);
                queue.push({ id: targetId, gx: pos[targetId].gridX, gy: pos[targetId].gridY });
            });
        }

        // Position any unvisited rooms (disconnected)
        let fallbackRow = 10;
        roomList.forEach(room => {
            if (!pos[room.id]) {
                console.log(`Invalid grid - ${room.name} is disconnected from main map`);
                while (grid[`${5},${fallbackRow}`]) fallbackRow++;
                pos[room.id] = {
                    x: 5 * SPACING_X,
                    y: fallbackRow * SPACING_Y,
                    gridX: 5,
                    gridY: fallbackRow
                };
                grid[`${5},${fallbackRow}`] = room.id;
                fallbackRow++;
            }
        });

        return pos;
    }, [rooms, roomList]);

    // Calculate viewBox to fit all rooms
    const viewBox = useMemo(() => {
        const allX = Object.values(positions).map(p => p.x);
        const allY = Object.values(positions).map(p => p.y);
        const minX = Math.min(...allX) - 50;
        const minY = Math.min(...allY) - 50;
        const maxX = Math.max(...allX) + ROOM_WIDTH + 50;
        const maxY = Math.max(...allY) + ROOM_HEIGHT + 50;
        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    }, [positions]);

    // Generate connections (lines between rooms)
    const connections: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    roomList.forEach((room) => {
        const fromPos = positions[room.id];
        if (!fromPos) return;
        Object.entries(room.exits).forEach(([, targetId]) => {
            const toPos = positions[targetId];
            if (!toPos) return;
            // Only add connection once (avoid duplicates)
            const exists = connections.some(c =>
                (c.from.x === toPos.x && c.from.y === toPos.y && c.to.x === fromPos.x && c.to.y === fromPos.y)
            );
            if (!exists) {
                connections.push({ from: fromPos, to: toPos });
            }
        });
    });

    return (
        <div className="map-overlay" onClick={onClose}>
            <div className="map-container" onClick={e => e.stopPropagation()}>
                <div className="map-header">
                    <h2>*** MAP ***</h2>
                    <button className="map-close" onClick={onClose}>✕</button>
                </div>
                <svg className="map-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
                    {/* Connection lines (orthogonal paths) */}
                    {connections.map((conn, i) => {
                        const x1 = conn.from.x + ROOM_WIDTH / 2;
                        const y1 = conn.from.y + ROOM_HEIGHT / 2;
                        const x2 = conn.to.x + ROOM_WIDTH / 2;
                        const y2 = conn.to.y + ROOM_HEIGHT / 2;

                        // Create orthogonal path (L-shaped)
                        // Go horizontal first, then vertical
                        const midY = (y1 + y2) / 2;
                        const pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

                        return (
                            <path
                                key={`conn-${i}`}
                                d={pathD}
                                className="map-connection"
                                fill="none"
                            />
                        );
                    })}

                    {/* Room boxes */}
                    {roomList.map((room) => {
                        const pos = positions[room.id];
                        if (!pos) return null;
                        const isHere = room.id === currentRoomId;
                        const displayName = room.name.replace('The ', '');
                        // Calculate font size to fit: shrink for longer names
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

                    {/* Character markers */}
                    {Object.entries(
                        // Group characters by room
                        Object.entries(characterPositions).reduce((acc, [charId, roomId]) => {
                            if (!acc[roomId]) acc[roomId] = [];
                            acc[roomId].push(charId);
                            return acc;
                        }, {} as Record<string, string[]>)
                    ).map(([roomId, charIds]) => {
                        const pos = positions[roomId];
                        if (!pos) return null;
                        const names = charIds.map(id => characterNames[id] || id).join(', ');
                        const count = charIds.length;
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
                                    {count}
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
