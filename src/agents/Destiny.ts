import { Agent } from './Agent';
import type { AgentCard, Task } from '../engine/A2A';
import type { Schedule, Character } from '../engine/types';
import type { Scheduler } from './Scheduler';

/**
 * Destiny Agent - Controls character movement based on time and schedule.
 * Works with Scheduler for time-based events and can add spontaneous events.
 */
export class Destiny extends Agent {
    private schedule: Schedule | null = null;
    private characters: Record<string, Character> = {};
    private scheduler: Scheduler | null = null;

    constructor() {
        super('Destiny', 'Fate');
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
     * Work method (not used directly, but required by Agent base)
     */
    async work(): Promise<void> {
        console.log("Destiny: work() called - use updatePositions() instead");
    }
}
