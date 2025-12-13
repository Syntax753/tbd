import { Agent } from './Agent';
import { Writer } from './Writer';
import { LocationScout } from './LocationScout';
import { CastingDirector } from './CastingDirector';
import { Scheduler } from './Scheduler';
import { Destiny } from './Destiny';
import type { AgentCard, Task } from '../engine/A2A';
import type { GameState, Room, Character } from '../engine/types';
import { grafitti } from '../engine/RoomGraph';
import { colorName } from '../utils/colors';

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
        // Don't log tick tasks - too noisy
        if (task.type !== 'tick') {
            console.log(`ExecutiveDirector: Dispatching task [${task.type}]...`);
        }

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

            // Get the character's scheduled action to include in message
            const scheduledAction = this.getScheduledAction(move.charId, currentTime);

            // Generate messages if player is in affected rooms
            if (playerRoomId === oldRoom) {
                const destRoomName = grafitti.getRoom(nextStep)?.name || nextStep;
                const direction = grafitti.getDirection(oldRoom, nextStep) || '';
                const dirText = direction ? ` (${direction})` : '';
                if (scheduledAction) {
                    messages.push(`${colorName(move.charName)} heads towards the ${destRoomName}${dirText} to ${scheduledAction}.`);
                } else {
                    messages.push(`${colorName(move.charName)} leaves towards the ${destRoomName}${dirText}.`);
                }
            }
            if (playerRoomId === nextStep) {
                const srcRoomName = grafitti.getRoom(oldRoom)?.name || oldRoom;
                if (scheduledAction) {
                    messages.push(`${colorName(move.charName)} enters from the ${srcRoomName} and ${scheduledAction}.`);
                } else {
                    messages.push(`${colorName(move.charName)} enters the room from the ${srcRoomName}.`);
                }
            }

            // Record witnessed event for all characters in the destination room
            if (scheduledAction) {
                const destRoomName = grafitti.getRoom(nextStep)?.name || nextStep;
                this.destiny.recordWitnessedEvent(
                    move.charId,
                    move.charName,
                    scheduledAction,
                    nextStep,
                    destRoomName,
                    currentTime
                );
            }
        }

        return messages;
    }

    /**
     * Get a character's scheduled action for the current time.
     * Uses Scheduler's cached schedule.
     */
    private getScheduledAction(charId: string, currentTime: string): string | null {
        const schedule = this.scheduler.getSchedule();
        if (!schedule || !schedule[charId]) return null;

        const events = schedule[charId];
        const currentMinutes = this.timeToMinutes(currentTime);

        // Find the current or upcoming event
        for (let i = events.length - 1; i >= 0; i--) {
            const eventMinutes = this.timeToMinutes(events[i].time);
            if (eventMinutes <= currentMinutes) {
                return events[i].action.toLowerCase();
            }
        }
        return events[0]?.action.toLowerCase() || null;
    }

    private timeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    /**
     * Get a talk response for a character (delegates to Destiny)
     */
    async getTalkResponse(charId: string): Promise<string> {
        return this.destiny.getTalkResponse(charId);
    }

    /**
     * Get a personality-based response for a specific witnessed event.
     * Waits for LLM if not cached.
     */
    async getEventResponse(charId: string, memory: any): Promise<string> {
        return this.destiny.getEventResponse(charId, memory);
    }

    async work(onProgress?: (msg: string) => void, config?: { storySetting?: string; characterTypes?: string; suspectCount?: string; deceasedName?: string }): Promise<Partial<GameState>> {
        console.log("ExecutiveDirector: Starting production...");
        if (config) {
            console.log("ExecutiveDirector: Using player config:", config);
        }

        // Determine test mode from environment - this is the single source of truth
        const useTestData = import.meta.env.VITE_USE_TEST_DATA === 'true';
        if (useTestData) {
            console.log("ExecutiveDirector: Running in TEST MODE");
        }

        console.log("### Starting a new Production ###");

        // Executive Director runs the production pipeline sequentially
        console.log("ExecutiveDirector -> Writer<generate_story>");
        if (onProgress) onProgress("The Writer is drafting the plot...");
        const story = await this.writer.work(useTestData, config?.storySetting, config?.characterTypes, config?.deceasedName);

        console.log("ExecutiveDirector -> CastingDirector<generate_cast>");
        if (onProgress) onProgress("The CastingDirector is auditioning suspects...");
        const suspectCount = parseInt(config?.suspectCount || '5', 10) || 5;
        const charactersList = await this.castingDirector.work(story, useTestData, suspectCount, config?.characterTypes);
        if (onProgress) onProgress(`The CastingDirector hired ${charactersList.length} suspects!`);

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

        // Initialize Destiny with schedule, characters, and scheduler reference
        this.destiny.initialize(schedule, characters, this.scheduler);

        // Pre-cache async LLM responses for all characters
        console.log("ExecutiveDirector: Pre-caching talk responses for all characters...");
        this.destiny.prepareAllResponses();

        // Build initial history with intro and starting events (18:00)
        const initialHistory: string[] = [story.intro, ""];

        // Add 18:00 events for all characters and record them for memory
        Object.entries(schedule).forEach(([charId, events]) => {
            const char = characters[charId];
            if (!char) return;

            // Find 18:00 event
            const startEvent = events.find(e => e.time === '18:00');
            if (startEvent) {
                initialHistory.push(`${colorName(char.name)}: ${startEvent.action}`);

                // Record this event in all other characters' memories (async LLM responses)
                const roomName = map[startEvent.locationId]?.name || startEvent.locationId;
                this.destiny.recordWitnessedEvent(
                    charId,
                    char.name,
                    startEvent.action,
                    startEvent.locationId,
                    roomName,
                    '18:00'
                );
            }
        });

        return {
            story,
            map,
            characters,
            schedule,
            currentRoomId: 'foyer', // Player start
            history: initialHistory
        };
    }
}
