import React, { useEffect, useMemo } from 'react';
import type { Room } from '../engine/types';

interface MapViewProps {
    rooms: Record<string, Room>;
    currentRoomId: string;
    onClose: () => void;
}

const ROOM_WIDTH = 120;
const ROOM_HEIGHT = 50;
const SPACING_X = 180;
const SPACING_Y = 100;

export const MapView: React.FC<MapViewProps> = ({ rooms, currentRoomId, onClose }) => {
    const roomList = Object.values(rooms);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Calculate room positions dynamically using BFS from foyer
    const positions = useMemo(() => {
        const pos: Record<string, { x: number; y: number }> = {};
        const visited = new Set<string>();

        // Start from foyer (center of map)
        const startId = 'foyer';
        const startX = 400;
        const startY = 250;

        if (!rooms[startId]) {
            // Fallback if no foyer
            roomList.forEach((room, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                pos[room.id] = { x: 100 + col * SPACING_X, y: 80 + row * SPACING_Y };
            });
            return pos;
        }

        // BFS to position rooms based on connections
        const queue: { id: string; x: number; y: number; depth: number }[] = [
            { id: startId, x: startX, y: startY, depth: 0 }
        ];
        visited.add(startId);
        pos[startId] = { x: startX, y: startY };

        // Direction offsets based on cardinal directions
        const dirOffsets: Record<string, { dx: number; dy: number }> = {
            'north': { dx: 0, dy: -SPACING_Y },
            'south': { dx: 0, dy: SPACING_Y },
            'east': { dx: SPACING_X, dy: 0 },
            'west': { dx: -SPACING_X, dy: 0 },
            'up': { dx: 0, dy: -SPACING_Y },
            'down': { dx: 0, dy: SPACING_Y }
        };

        while (queue.length > 0) {
            const { id, x, y } = queue.shift()!;
            const room = rooms[id];
            if (!room) continue;

            Object.entries(room.exits).forEach(([dir, targetId]) => {
                if (visited.has(targetId)) return;
                visited.add(targetId);

                const offset = dirOffsets[dir.toLowerCase()] || { dx: SPACING_X, dy: 0 };
                let newX = x + offset.dx;
                let newY = y + offset.dy;

                // Avoid overlaps by adjusting position
                let attempts = 0;
                while (attempts < 8 && Object.values(pos).some(p =>
                    Math.abs(p.x - newX) < ROOM_WIDTH && Math.abs(p.y - newY) < ROOM_HEIGHT
                )) {
                    // Spiral out
                    newX += (attempts % 2 === 0 ? 1 : -1) * SPACING_X * 0.3;
                    newY += (attempts % 2 === 1 ? 1 : -1) * SPACING_Y * 0.3;
                    attempts++;
                }

                pos[targetId] = { x: newX, y: newY };
                queue.push({ id: targetId, x: newX, y: newY, depth: 0 });
            });
        }

        // Position any unvisited rooms
        let fallbackIndex = 0;
        roomList.forEach(room => {
            if (!pos[room.id]) {
                pos[room.id] = {
                    x: 100 + (fallbackIndex % 4) * SPACING_X,
                    y: 450 + Math.floor(fallbackIndex / 4) * SPACING_Y
                };
                fallbackIndex++;
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
                                >
                                    {room.name.replace('The ', '').slice(0, 12)}
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
                </svg>
                <p className="map-hint">Press ESC or click anywhere to close</p>
            </div>
        </div>
    );
};
