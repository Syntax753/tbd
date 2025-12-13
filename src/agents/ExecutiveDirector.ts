import { Agent } from './Agent';
import { Writer } from './Writer';
import { LocationScout } from './LocationScout';
import { CastingDirector } from './CastingDirector';
import { Scheduler } from './Scheduler';
import { Destiny } from './Destiny';
import type { AgentCard, Task } from '../engine/A2A';
import type { GameState, Room, Character } from '../engine/types';
import { grafitti } from '../engine/RoomGraph';

export class ExecutiveDirector extends Agent {
    private writer: Writer;
    private locationScout: LocationScout;
    private castingDirector: CastingDirector;
    private scheduler: Scheduler;
    private destiny: Destiny;

    constructor() {
        super('ExecutiveDirector', 'Orson');
        this.writer = new Writer();
        this.locationScout = new LocationScout();
        this.castingDirector = new CastingDirector();
        this.scheduler = new Scheduler();
        this.destiny = new Destiny();
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Orchestrates all agents to produce a complete murder mystery',
            capabilities: [
                { name: 'orchestrate', description: 'Runs the full production pipeline', outputType: 'GameState' },
                { name: 'dispatch', description: 'Routes tasks to appropriate agents', inputType: 'Task', outputType: 'any' },
                { name: 'tick', description: 'Advances game time and updates character positions', inputType: 'string', outputType: 'string[]' }
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

        if (task.type === 'tick') {
            return this.tick(task.payload?.time, task.payload?.playerRoomId, task.payload?.characters || {});
        }

        return null;
    }

    /**
     * Gameplay loop tick - called after each player turn.
     * Uses Scheduler to determine who needs to move, then uses Grafitti to move them.
     */
    tick(currentTime: string, playerRoomId: string, characters: Record<string, { id: string; name: string; currentRoomId: string }>): string[] {
        console.log(`ExecutiveDirector: Tick at ${currentTime}`);

        const messages: string[] = [];

        // Get movement requests from Scheduler
        const movements = this.scheduler.tick(currentTime, characters);

        // Process each movement using Grafitti for pathfinding
        for (const move of movements) {
            const currentRoom = grafitti.getCharacterRoom(move.charId) || move.from;

            // Get next step towards target
            const nextStep = grafitti.getNextStep(currentRoom, move.to);
            if (!nextStep) continue; // No path or already there

            // Move character one step
            const oldRoom = currentRoom;
            grafitti.moveCharacter(move.charId, nextStep);

            // Update character object
            const char = characters[move.charId];
            if (char) char.currentRoomId = nextStep;

            // Generate messages if player is in affected rooms
            if (playerRoomId === oldRoom) {
                const direction = grafitti.getDirection(oldRoom, nextStep);
                messages.push(`${move.charName} leaves to the ${direction?.toUpperCase() || 'somewhere'}.`);
            }
            if (playerRoomId === nextStep) {
                const direction = grafitti.getDirection(nextStep, oldRoom);
                messages.push(`${move.charName} enters from the ${direction?.toUpperCase() || 'somewhere'}.`);
            }
        }

        return messages;
    }

    async work(onProgress?: (msg: string) => void): Promise<Partial<GameState>> {
        console.log("ExecutiveDirector: Starting production...");

        // Determine test mode from environment - this is the single source of truth
        const useTestData = import.meta.env.VITE_USE_TEST_DATA === 'true';
        if (useTestData) {
            console.log("ExecutiveDirector: Running in TEST MODE");
        }

        console.log("### Starting a new Production ###");

        // Executive Director runs the production pipeline sequentially
        console.log("ExecutiveDirector -> Writer<generate_story>");
        if (onProgress) onProgress("The Writer is drafting the plot...");
        const story = await this.writer.work(useTestData);

        console.log("ExecutiveDirector -> CastingDirector<generate_cast>");
        if (onProgress) onProgress("The CastingDirector is hiring 8 suspects...");
        const charactersList = await this.castingDirector.work(story, useTestData);

        console.log("ExecutiveDirector -> LocationScout<generate_location>");
        if (onProgress) onProgress("The LocationScout is designing the manor...");
        const rooms = await this.locationScout.work(story, charactersList, useTestData);

        console.log("ExecutiveDirector -> Scheduler<generate_schedule>");
        if (onProgress) onProgress("The Scheduler is setting the scene...");
        const schedule = await this.scheduler.work(story, charactersList, rooms, useTestData);

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

        // Initialize Grafitti with rooms and characters
        grafitti.initialize(map);
        grafitti.initializeCharacters(characters);

        // Initialize Destiny with schedule and characters
        this.destiny.initialize(schedule, characters);

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
