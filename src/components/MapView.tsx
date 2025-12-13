import React from 'react';
import type { Room } from '../engine/types';

interface MapViewProps {
    rooms: Record<string, Room>;
    currentRoomId: string;
    onClose: () => void;
}

// Define room positions for the test mansion layout
const ROOM_POSITIONS: Record<string, { x: number; y: number }> = {
    'foyer': { x: 300, y: 200 },
    'upper_landing': { x: 300, y: 50 },
    'guest_corridor': { x: 500, y: 50 },
    'dining_room': { x: 500, y: 200 },
    'kitchen': { x: 500, y: 350 },
    'butlers_pantry': { x: 700, y: 350 },
    'living_room': { x: 100, y: 200 },
    'game_room': { x: 100, y: 350 },
    'masters_study': { x: 300, y: 350 }
};

const ROOM_WIDTH = 120;
const ROOM_HEIGHT = 50;

export const MapView: React.FC<MapViewProps> = ({ rooms, currentRoomId, onClose }) => {
    const roomList = Object.values(rooms);

    // Generate positions for unknown rooms
    const getPosition = (roomId: string, index: number) => {
        if (ROOM_POSITIONS[roomId]) {
            return ROOM_POSITIONS[roomId];
        }
        // Dynamic positioning for LLM-generated rooms
        const col = index % 4;
        const row = Math.floor(index / 4) + 3; // Start below static rooms
        return { x: 100 + col * 200, y: 50 + row * 150 };
    };

    // Generate connections (lines between rooms)
    const connections: { from: { x: number; y: number }; to: { x: number; y: number }; dir: string }[] = [];
    roomList.forEach((room, index) => {
        const fromPos = getPosition(room.id, index);
        Object.entries(room.exits).forEach(([dir, targetId]) => {
            const targetIndex = roomList.findIndex(r => r.id === targetId);
            if (targetIndex !== -1) {
                const toPos = getPosition(targetId, targetIndex);
                // Only add connection once (avoid duplicates)
                const exists = connections.some(c =>
                    (c.from.x === toPos.x && c.from.y === toPos.y && c.to.x === fromPos.x && c.to.y === fromPos.y)
                );
                if (!exists) {
                    connections.push({ from: fromPos, to: toPos, dir });
                }
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
                <svg className="map-svg" viewBox="0 0 900 550">
                    {/* Connection lines */}
                    {connections.map((conn, i) => (
                        <line
                            key={`conn-${i}`}
                            x1={conn.from.x + ROOM_WIDTH / 2}
                            y1={conn.from.y + ROOM_HEIGHT / 2}
                            x2={conn.to.x + ROOM_WIDTH / 2}
                            y2={conn.to.y + ROOM_HEIGHT / 2}
                            className="map-connection"
                        />
                    ))}

                    {/* Room boxes */}
                    {roomList.map((room, index) => {
                        const pos = getPosition(room.id, index);
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
                <p className="map-hint">Click anywhere to close</p>
            </div>
        </div>
    );
};
