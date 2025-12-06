import { Agent } from './Agent';
import { Writer } from './Writer';
import { LocationScout } from './LocationScout';
import { CastingDirector } from './CastingDirector';
import type { GameState, Room, Character, StoryManifest } from '../engine/types';

export class ExecutiveDirector extends Agent {
    private writer: Writer;
    private locationScout: LocationScout;
    private castingDirector: CastingDirector;

    constructor() {
        super('Orson', 'Executive Director');
        this.writer = new Writer();
        this.locationScout = new LocationScout();
        this.castingDirector = new CastingDirector();
    }

    async work(): Promise<Partial<GameState>> {
        console.log("Executive Director: Starting production...");

        // Parallel production
        const [story, rooms, charactersList] = await Promise.all([
            this.writer.work(),
            this.locationScout.work(),
            this.castingDirector.work()
        ]);

        // Assemble the game state
        const map: Record<string, Room> = {};
        rooms.forEach(room => {
            map[room.id] = room;
        });

        const characters: Record<string, Character> = {};
        charactersList.forEach(char => {
            // Place everyone in the Foyer or Dining Room initially
            char.currentRoomId = 'foyer';
            characters[char.id] = char;
        });

        return {
            story,
            map,
            characters,
            currentRoomId: 'foyer', // Player start
            history: [story.intro]
        };
    }
}
