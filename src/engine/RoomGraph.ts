import type { Room, Character } from './types';

/**
 * Grafitti - The world graph tracker.
 * Maintains rooms, their connections, and character positions.
 * Used for pathfinding, validation, and querying the game world state.
 */
export class Grafitti {
    private rooms: Map<string, Room> = new Map();
    private adjacency: Map<string, Map<string, string>> = new Map(); // roomId -> direction -> targetRoomId
    private characterPositions: Map<string, string> = new Map(); // charId -> roomId

    /**
     * Initialize the graph with a set of rooms
     */
    initialize(rooms: Record<string, Room> | Room[]) {
        this.rooms.clear();
        this.adjacency.clear();

        const roomArray = Array.isArray(rooms) ? rooms : Object.values(rooms);

        roomArray.forEach(room => {
            this.rooms.set(room.id, room);
            this.adjacency.set(room.id, new Map(Object.entries(room.exits)));
        });
    }

    /**
     * Initialize character positions
     */
    initializeCharacters(characters: Record<string, Character> | Character[]) {
        this.characterPositions.clear();
        const charArray = Array.isArray(characters) ? characters : Object.values(characters);
        charArray.forEach(char => {
            this.characterPositions.set(char.id, char.currentRoomId || 'foyer');
        });
    }

    /**
     * Get character's current room
     */
    getCharacterRoom(charId: string): string | undefined {
        return this.characterPositions.get(charId);
    }

    /**
     * Move a character to a new room
     */
    moveCharacter(charId: string, newRoomId: string): boolean {
        if (!this.rooms.has(newRoomId)) return false;
        this.characterPositions.set(charId, newRoomId);
        return true;
    }

    /**
     * Get all characters in a room
     */
    getCharactersInRoom(roomId: string): string[] {
        const chars: string[] = [];
        this.characterPositions.forEach((room, charId) => {
            if (room === roomId) chars.push(charId);
        });
        return chars;
    }

    /**
     * Get all character positions
     */
    getAllCharacterPositions(): Map<string, string> {
        return new Map(this.characterPositions);
    }

    /**
     * Get a room by ID
     */
    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Get all rooms
     */
    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Get exits for a room with direction and target room info
     */
    getExits(roomId: string): { direction: string; shortDir: string; targetId: string; targetName: string }[] {
        const dirMap = this.adjacency.get(roomId);
        if (!dirMap) return [];

        const dirToShort: Record<string, string> = {
            'north': 'N',
            'south': 'S',
            'east': 'E',
            'west': 'W',
            'up': 'U',
            'down': 'D'
        };

        return Array.from(dirMap.entries()).map(([dir, targetId]) => ({
            direction: dir,
            shortDir: dirToShort[dir.toLowerCase()] || dir.charAt(0).toUpperCase(),
            targetId,
            targetName: this.rooms.get(targetId)?.name || targetId
        }));
    }

    /**
     * Check if two rooms are directly connected
     */
    areConnected(roomA: string, roomB: string): boolean {
        const exits = this.adjacency.get(roomA);
        if (!exits) return false;
        return Array.from(exits.values()).includes(roomB);
    }

    /**
     * Get the direction from roomA to roomB (if adjacent)
     */
    getDirection(fromId: string, toId: string): string | null {
        const exits = this.adjacency.get(fromId);
        if (!exits) return null;

        for (const [dir, targetId] of exits.entries()) {
            if (targetId === toId) return dir;
        }
        return null;
    }

    /**
     * BFS pathfinding - returns array of room IDs from start to target (excluding start)
     */
    findPath(startId: string, targetId: string): string[] {
        if (startId === targetId) return [];
        if (!this.rooms.has(startId) || !this.rooms.has(targetId)) return [];

        const queue: { id: string; path: string[] }[] = [{ id: startId, path: [] }];
        const visited = new Set<string>();
        visited.add(startId);

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (id === targetId) {
                return path;
            }

            const exits = this.adjacency.get(id);
            if (!exits) continue;

            for (const neighborId of exits.values()) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push({ id: neighborId, path: [...path, neighborId] });
                }
            }
        }

        return []; // No path found
    }

    /**
     * Get the next step towards a target room
     */
    getNextStep(fromId: string, toId: string): string | null {
        const path = this.findPath(fromId, toId);
        return path.length > 0 ? path[0] : null;
    }

    /**
     * Calculate travel time in 5-minute increments
     */
    getTravelTime(fromId: string, toId: string): number {
        const path = this.findPath(fromId, toId);
        return path.length * 5; // 5 minutes per room
    }

    /**
     * Validate that all room exits are reciprocal (optional)
     */
    validateReciprocal(): { valid: boolean; issues: string[] } {
        const issues: string[] = [];
        const opposites: Record<string, string> = {
            'north': 'south', 'south': 'north',
            'east': 'west', 'west': 'east',
            'up': 'down', 'down': 'up'
        };

        this.adjacency.forEach((exits, roomId) => {
            exits.forEach((targetId, dir) => {
                const opposite = opposites[dir.toLowerCase()];
                if (opposite) {
                    const targetExits = this.adjacency.get(targetId);
                    if (!targetExits || targetExits.get(opposite) !== roomId) {
                        issues.push(`${roomId} -> ${dir} -> ${targetId} has no reciprocal exit`);
                    }
                }
            });
        });

        return { valid: issues.length === 0, issues };
    }
}

// Singleton instance
export const grafitti = new Grafitti();
