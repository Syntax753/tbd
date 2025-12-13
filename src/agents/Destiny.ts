import { Agent } from './Agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgentCard, Task } from '../engine/A2A';
import type { Schedule, Character, CharacterMemory } from '../engine/types';
import type { Scheduler } from './Scheduler';

/**
 * Destiny Agent - Controls character movement based on time and schedule.
 * Also manages character memory and pre-generates LLM responses for conversations.
 */
export class Destiny extends Agent {
    private schedule: Schedule | null = null;
    private characters: Record<string, Character> = {};
    private scheduler: Scheduler | null = null;
    private genAI: GoogleGenerativeAI | null = null;
    private pendingLLMCalls: Map<string, Promise<void>> = new Map();

    constructor() {
        super('Destiny', 'Fate');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Controls character movement and generates personality-based events',
            capabilities: [
                { name: 'update_positions', description: 'Updates character positions for a given time', inputType: 'string', outputType: 'MovementResult[]' },
                { name: 'generate_event', description: 'Generates spontaneous events based on personality', inputType: 'Character', outputType: 'void' }
            ]
        };
    }

    /**
     * Initialize with schedule, characters, and scheduler reference
     */
    initialize(schedule: Schedule, characters: Record<string, Character>, scheduler?: Scheduler) {
        this.schedule = schedule;
        this.characters = characters;
        this.scheduler = scheduler || null;
        console.log("Destiny: Initialized with schedule and characters");
    }

    /**
     * Pre-cache async LLM responses for all characters.
     * Called at game start to ensure responses are ready before player asks.
     */
    prepareAllResponses(): void {
        console.log("Destiny: Preparing async talk responses for all characters...");
        Object.keys(this.characters).forEach(charId => {
            this.queueResponseGeneration(charId);
        });
    }

    /**
     * Handle A2A tasks
     */
    async handleTask(task: Task): Promise<any> {
        if (task.type === 'update_positions' && task.payload?.time) {
            return this.updatePositions(task.payload.time, task.payload.playerRoomId);
        }
        return null;
    }

    /**
     * Get movement requests for current time.
     * Returns characters who need to move towards their scheduled locations.
     */
    getMovementRequests(currentTime: string): { charId: string; charName: string; from: string; to: string }[] {
        if (!this.schedule) return [];

        const movements: { charId: string; charName: string; from: string; to: string }[] = [];
        const currentMinutes = this.timeToMinutes(currentTime);

        Object.keys(this.schedule).forEach(charId => {
            const char = this.characters[charId];
            if (!char) return;

            const events = this.schedule![charId];
            if (!events || events.length === 0) return;

            // Find the target location for current time
            const targetEvent = this.getTargetEvent(events, currentMinutes);
            if (!targetEvent) return;

            const currentRoom = char.currentRoomId;
            const targetRoom = targetEvent.locationId;

            // If already at target, no movement needed
            if (currentRoom === targetRoom) return;

            movements.push({
                charId,
                charName: char.name,
                from: currentRoom || 'foyer',
                to: targetRoom
            });
        });

        return movements;
    }

    /**
     * Generate a spontaneous event based on character personality.
     * Called when a character is idle or passing through interesting locations.
     */
    generateSpontaneousEvent(charId: string, currentTime: string, currentRoomId: string): void {
        if (!this.scheduler) return;

        const char = this.characters[charId];
        if (!char) return;

        // Parse personality for traits
        const personality = char.personality?.toLowerCase() || '';

        // Generate events based on personality traits
        if (personality.includes('curious') || personality.includes('nosy')) {
            // Curious characters might explore interesting rooms
            if (currentRoomId === 'library') {
                this.scheduler.addEvent(charId, this.addMinutes(currentTime, 10),
                    'browsing old books curiously', 'library');
            } else if (currentRoomId === 'study') {
                this.scheduler.addEvent(charId, this.addMinutes(currentTime, 10),
                    'examining papers on the desk', 'study');
            }
        }

        if (personality.includes('suspicious') || personality.includes('paranoid')) {
            // Suspicious characters might investigate
            if (currentRoomId === 'hallway') {
                this.scheduler.addEvent(charId, this.addMinutes(currentTime, 5),
                    'glancing around nervously', currentRoomId);
            }
        }

        if (personality.includes('social') || personality.includes('gregarious')) {
            // Social characters seek company
            // (More complex: would need to check where other characters are)
        }
    }

    /**
     * Legacy method - kept for compatibility but movement is now handled by ExecutiveDirector
     */
    updatePositions(currentTime: string, _playerRoomId: string): string[] {
        // Movement logic is now in ExecutiveDirector.tick()
        // This method can be used for generating spontaneous events
        const movements = this.getMovementRequests(currentTime);

        // Check for idle characters who might do something spontaneous
        Object.keys(this.characters).forEach(charId => {
            const isMoving = movements.some(m => m.charId === charId);
            if (!isMoving) {
                // Character is idle - maybe generate a spontaneous event
                const char = this.characters[charId];
                if (char && Math.random() < 0.1) { // 10% chance
                    this.generateSpontaneousEvent(charId, currentTime, char.currentRoomId || 'foyer');
                }
            }
        });

        return []; // Messages are now generated by ExecutiveDirector
    }

    /**
     * Find the most recent event for current time (event.time <= currentTime)
     */
    private getTargetEvent(events: { time: string; action: string; locationId: string }[], currentMinutes: number): { time: string; action: string; locationId: string } | null {

        let targetEvent = null;
        for (const event of events) {
            const eventMinutes = this.timeToMinutes(event.time);
            if (eventMinutes <= currentMinutes) {
                targetEvent = event;
            } else {
                break;
            }
        }
        return targetEvent;
    }

    private timeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        if (h === 0 && m === 0) return 24 * 60;
        return h * 60 + m;
    }

    private addMinutes(timeStr: string, minutes: number): string {
        const totalMinutes = this.timeToMinutes(timeStr) + minutes;
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * Record an event witnessed by all characters in the same room.
     * Called when a character performs an action.
     */
    recordWitnessedEvent(
        actorId: string,
        actorName: string,
        action: string,
        roomId: string,
        roomName: string,
        time: string
    ): void {
        // All characters in the same room witness this event (except the actor)
        Object.values(this.characters).forEach(char => {
            if (char.id === actorId) return;
            if (char.currentRoomId !== roomId) return;

            // Initialize memory if needed
            if (!char.memory) char.memory = [];

            const memory: CharacterMemory = {
                time,
                roomId,
                roomName,
                witnessedCharId: actorId,
                witnessedCharName: actorName,
                action
            };

            char.memory.push(memory);
            console.log(`Destiny -> Memory: ${char.name} witnessed ${actorName} ${action} in ${roomName}`);

            // Generate async personality-based response for this specific memory
            this.generateEventResponse(char, memory);

            // Also refresh general talk responses
            this.queueResponseGeneration(char.id);
        });
    }

    /**
     * Generate a personality-based response for a witnessed event (async).
     */
    private async generateEventResponse(char: Character, memory: CharacterMemory): Promise<void> {
        if (!this.genAI) return;

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are ${char.name}, a ${char.role} in a 1920s murder mystery.
Personality: ${char.personality}

You witnessed: ${memory.witnessedCharName} ${memory.action} in the ${memory.roomName} at ${memory.time}.

Generate a SHORT response (1-2 sentences) that reflects your personality when asked about this event. 
- If you're nervous/insecure, be uncertain and hedging
- If you're confident, be direct and observant
- If you're suspicious, add intrigue or accusation
- If you're protective, maybe cover for them

Return ONLY the dialogue, no quotes, no character name prefix.`;

            console.log(`Destiny -> LLM: Generating event response for ${char.name} about ${memory.witnessedCharName}`);
            const result = await model.generateContent(prompt);
            const response = result.response.text().trim();

            // Store the response in the memory object
            memory.cachedResponse = response;
            console.log(`Destiny <- LLM: ${char.name}'s response cached: "${response.substring(0, 50)}..."`);
        } catch (error) {
            console.error(`Destiny: Error generating event response for ${char.name}:`, error);
        }
    }

    /**
     * Queue async LLM response generation for a character.
     * Generates 1-3 default responses based on personality and memories.
     */
    private queueResponseGeneration(charId: string): void {
        if (this.pendingLLMCalls.has(charId)) return; // Already generating

        const char = this.characters[charId];
        if (!char || !this.genAI) return;

        const promise = this.generateCharacterResponses(char);
        this.pendingLLMCalls.set(charId, promise);
        promise.finally(() => this.pendingLLMCalls.delete(charId));
    }

    /**
     * Generate default talk responses for a character using LLM.
     */
    private async generateCharacterResponses(char: Character): Promise<void> {
        if (!this.genAI) return;

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            // Build memory context
            const memoryLines = (char.memory || []).slice(-5).map(m =>
                `- Saw ${m.witnessedCharName} ${m.action} at ${m.time}`
            );

            const prompt = `You are ${char.name}, a ${char.role} in a murder mystery.
Personality: ${char.personality}
Bio: ${char.bio}

Recent observations:
${memoryLines.length > 0 ? memoryLines.join('\n') : '- Nothing unusual yet'}

Generate exactly 3 short responses (1-2 sentences each) that this character might say when the player talks to them. The responses should:
1. Reflect their personality and role
2. Reference their observations if relevant
3. Be mysterious but not reveal too much

Format: Return ONLY a JSON array of 3 strings, like ["response1", "response2", "response3"]`;

            console.log(`Destiny -> LLM: Generating responses for ${char.name}`);
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Parse JSON array
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const responses = JSON.parse(jsonMatch[0]);
                char.cachedResponses = responses;
                char.responsesReady = true;
                console.log(`Destiny <- LLM: ${char.name} has ${responses.length} responses ready`);
            }
        } catch (error) {
            console.error(`Destiny: Error generating responses for ${char.name}:`, error);
        }
    }

    /**
     * Get a character's talk response (uses cached if available, else generates).
     */
    async getTalkResponse(charId: string): Promise<string> {
        const char = this.characters[charId];
        if (!char) return "They don't seem interested in talking.";

        // If responses ready, use a cached one
        if (char.responsesReady && char.cachedResponses && char.cachedResponses.length > 0) {
            const response = char.cachedResponses.shift()!;
            if (char.cachedResponses.length === 0) {
                char.responsesReady = false;
                this.queueResponseGeneration(charId); // Refill
            }
            return response;
        }

        // Wait for pending generation
        if (this.pendingLLMCalls.has(charId)) {
            console.log(`Destiny: Waiting for ${char.name}'s response generation...`);
            await this.pendingLLMCalls.get(charId);
            return this.getTalkResponse(charId); // Retry
        }

        // Generate on demand
        await this.generateCharacterResponses(char);
        if (char.cachedResponses && char.cachedResponses.length > 0) {
            return char.cachedResponses.shift()!;
        }

        // Fallback
        return `${char.name} looks at you but says nothing.`;
    }

    /**
     * Get a personality-based response for a specific witnessed event.
     * Returns cached if available, otherwise generates synchronously.
     */
    async getEventResponse(charId: string, memory: CharacterMemory): Promise<string> {
        const char = this.characters[charId];
        if (!char) return "They don't remember.";

        // If already cached, return it
        if (memory.cachedResponse) {
            return memory.cachedResponse;
        }

        // Generate synchronously if not cached
        if (!this.genAI) {
            return `I saw ${memory.witnessedCharName} ${memory.action} in the ${memory.roomName} around ${memory.time}.`;
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are ${char.name}, a ${char.role} in a 1920s murder mystery.
Personality: ${char.personality}

You witnessed: ${memory.witnessedCharName} ${memory.action} in the ${memory.roomName} at ${memory.time}.

Generate a SHORT response (1-2 sentences) that reflects your personality when asked about this event. 
- If you're nervous/insecure, be uncertain and hedging
- If you're confident, be direct and observant
- If you're suspicious, add intrigue or accusation
- If you're protective, maybe cover for them

Return ONLY the dialogue, no quotes, no character name prefix.`;

            console.log(`Destiny -> LLM: Generating event response for ${char.name} about ${memory.witnessedCharName} (on-demand)`);
            const result = await model.generateContent(prompt);
            const response = result.response.text().trim();

            // Cache it for future use
            memory.cachedResponse = response;
            console.log(`Destiny <- LLM: ${char.name}'s response: "${response.substring(0, 50)}..."`);

            return response;
        } catch (error) {
            console.error(`Destiny: Error generating event response:`, error);
            return `I saw ${memory.witnessedCharName} ${memory.action} in the ${memory.roomName} around ${memory.time}.`;
        }
    }

    /**
     * Work method (not used directly, but required by Agent base)
     */
    async work(): Promise<void> {
        console.log("Destiny: work() called - use updatePositions() instead");
    }
}
