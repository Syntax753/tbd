import { Agent } from './Agent';
import { Writer } from './Writer';
import { LocationScout } from './LocationScout';
import { CastingDirector } from './CastingDirector';
import { Scheduler } from './Scheduler';
import type { GameState, Room, Character, StoryManifest } from '../engine/types';

export class ExecutiveDirector extends Agent {
    private writer: Writer;
    private locationScout: LocationScout;
    private castingDirector: CastingDirector;
    private scheduler: Scheduler;

    constructor() {
        super('Orson', 'Executive Director');
        this.writer = new Writer();
        this.locationScout = new LocationScout();
        this.castingDirector = new CastingDirector();
        this.scheduler = new Scheduler();
    }

    async work(): Promise<Partial<GameState>> {
        console.log("Executive Director: Starting production...");

        // Phase 1: The Writer creates the story
        console.log("Phase 1: Scripting");
        const story = await this.writer.work();

        // Phase 2: Casting, Location, and Scheduling based on the story
        console.log("Phase 2: Pre-production");
        const [rooms, charactersList, schedule] = await Promise.all([
            this.locationScout.work(), // In future, pass story
            this.castingDirector.work(), // In future, pass story
            this.scheduler.work(story)
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
            schedule,
            currentRoomId: 'foyer', // Player start
            history: [story.intro]
        };
    }
}
