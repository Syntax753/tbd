import { Agent } from './Agent';
import { Writer } from './Writer';
import { LocationScout } from './LocationScout';
import { CastingDirector } from './CastingDirector';
import { Scheduler } from './Scheduler';
import type { AgentCard, Task } from '../engine/A2A';
import type { GameState, Room, Character } from '../engine/types';

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

    get agentCard(): AgentCard {
        return {
            name: this.name,
            role: this.role,
            capabilities: ['orchestrate', 'fetch_info']
        };
    }

    // A2A Router: Dispatch task to the right agent
    async dispatch(task: Task): Promise<any> {
        console.log(`Executive Director: Dispatching task [${task.type}]...`);

        if (task.type === 'get_characters') {
            return this.castingDirector.handleTask({ ...task, type: 'fetch_characters' });
        }

        if (task.type === 'get_story') {
            return this.writer.handleTask({ ...task, type: 'get_story' });
        }

        if (task.type === 'get_schedule') {
            return this.scheduler.handleTask({ ...task, type: 'get_schedule' });
        }

        return null;
    }

    async work(): Promise<Partial<GameState>> {
        console.log("Executive Director: Starting production...");

        // Phase 1: The Writer creates the story AND orchestrates the rest (A2A)
        console.log("Phase 1: Commissioning the Writer...");

        // Executive Director runs the production pipeline sequentially
        console.log("Executive Director: 1. Commissioning Story...");
        const story = await this.writer.work();

        console.log("Executive Director: 2. Scouting Location...");
        // @ts-ignore
        const rooms = await this.locationScout.work(story);

        console.log("Executive Director: 3. Casting Characters...");
        // @ts-ignore
        const charactersList = await this.castingDirector.work(story);

        console.log("Executive Director: 4. Scheduling Events...");
        // @ts-ignore
        const schedule = await this.scheduler.work(story, charactersList);




        // Assemble the game state
        const map: Record<string, Room> = {};
        // @ts-ignore
        rooms.forEach((room: Room) => {
            map[room.id] = room;
        });

        const characters: Record<string, Character> = {};
        // @ts-ignore
        charactersList.forEach((char: Character) => {
            // Place everyone in the Foyer initially (or respect schedule later)
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
