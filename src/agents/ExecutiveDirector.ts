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

    // A2A: Standardized task handler - routes to dispatch
    async handleTask(task: Task): Promise<any> {
        return this.dispatch(task);
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

        if (task.type === 'start_production') {
            // A2A: ClientAgent sends config, ExecutiveDirector runs production
            console.log(`ExecutiveDirector <- A2A Task: start_production`);
            const { config, metaContext, onProgress } = task.payload || {};
            return this.work(onProgress, config, metaContext);
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

    async work(onProgress?: (msg: string) => void, config?: { storySetting?: string; characterTypes?: string; suspectCount?: string; deceasedName?: string; modelMode?: 'online' | 'offline' }, metaContext?: { venueName?: string }): Promise<Partial<GameState>> {
        console.log("ExecutiveDirector: Starting production...");
        if (config) {
            console.log("ExecutiveDirector: Using player config:", config);
        }
        console.log("ExecutiveDirector: Action!");
        const useTestData = !config; // Simple heuristic for now, or pass explicit flag
        const modelMode = config?.modelMode || 'online';

        // 1. Writer creates the story
        if (onProgress) onProgress("Writer is drafting the screenplay...");
        // @ts-ignore
        const story = await this.writer.work(useTestData, config?.storySetting, config?.characterTypes, config?.deceasedName, modelMode);

        // 2. Casting Director hires actors
        if (onProgress) onProgress("Casting Director is auditing suspects...");
        const count = config?.suspectCount ? parseInt(config.suspectCount) : 5;
        // @ts-ignore
        const charactersList = await this.castingDirector.work(story, useTestData, count, config?.characterTypes, modelMode);

        // 3. Location Scout finds/designs the venue
        if (onProgress) onProgress("Location Scout is securing the venue...");
        // @ts-ignore
        const venueName = metaContext?.venueName || 'Thorne Manor';
        // @ts-ignore
        // Fix: Update LocationScout signature to match usage or update usage
        const rooms = await this.locationScout.work(story, charactersList, useTestData, config?.storySetting, modelMode);

        // 4. Scheduler plans the evening
        if (onProgress) onProgress("Scheduler is coordinating the timeline...");
        // @ts-ignore
        const schedule = await this.scheduler.work(story, charactersList, rooms, useTestData, venueName, modelMode);

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

        // Initialize Destiny with schedule, characters, and scheduler reference, AND model mode
        this.destiny.initialize(schedule, characters, this.scheduler, config?.modelMode || 'online');

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
