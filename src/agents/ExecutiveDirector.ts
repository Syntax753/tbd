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
        super('ExecutiveDirector', 'Orson');
        this.writer = new Writer();
        this.locationScout = new LocationScout();
        this.castingDirector = new CastingDirector();
        this.scheduler = new Scheduler();
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Orchestrates all agents to produce a complete murder mystery',
            capabilities: [
                { name: 'orchestrate', description: 'Runs the full production pipeline', outputType: 'GameState' },
                { name: 'dispatch', description: 'Routes tasks to appropriate agents', inputType: 'Task', outputType: 'any' }
            ]
        };
    }

    // A2A Router: Dispatch task to the right agent
    async dispatch(task: Task): Promise<any> {
        console.log(`ExecutiveDirector: Dispatching task [${task.type}]...`);

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

    async work(onProgress?: (msg: string) => void): Promise<Partial<GameState>> {
        console.log("ExecutiveDirector: Starting production...");

        console.log("### Starting a new Production ###");

        // Executive Director runs the production pipeline sequentially
        console.log("ExecutiveDirector -> Writer<generate_story>");
        if (onProgress) onProgress("The Writer is drafting the plot...");
        const story = await this.writer.work();

        console.log("ExecutiveDirector -> CastingDirector<generate_cast>");
        if (onProgress) onProgress("The CastingDirector is hiring 8 suspects...");
        const charactersList = await this.castingDirector.work(story);

        console.log("ExecutiveDirector -> LocationScout<generate_location>");
        if (onProgress) onProgress("The LocationScout is designing the manor...");
        const rooms = await this.locationScout.work(story, charactersList);

        console.log("ExecutiveDirector -> Scheduler<generate_schedule>");
        if (onProgress) onProgress("The Scheduler is setting the scene...");
        const schedule = await this.scheduler.work(story, charactersList, rooms);

        console.log("### End of Production ###");

        // Assemble the game state
        const map: Record<string, Room> = {};
        rooms.forEach((room: Room) => {
            map[room.id] = room;
        });

        const characters: Record<string, Character> = {};
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
