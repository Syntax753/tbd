import { Agent } from './Agent';
import type { AgentCard, Task } from '../engine/A2A';
import type { Schedule, Character } from '../engine/types';
import { grafitti } from '../engine/RoomGraph';

/**
 * Destiny Agent - Controls character movement based on time and schedule.
 * Called after each player turn to update character positions.
 */
export class Destiny extends Agent {
    private schedule: Schedule | null = null;
    private characters: Record<string, Character> = {};

    constructor() {
        super('Destiny', 'Fate');
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Controls character movement based on time and schedule',
            capabilities: [
                { name: 'update_positions', description: 'Updates character positions for a given time', inputType: 'string', outputType: 'MovementResult[]' }
            ]
        };
    }

    /**
     * Initialize with schedule and characters
     */
    initialize(schedule: Schedule, characters: Record<string, Character>) {
        this.schedule = schedule;
        this.characters = characters;
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
     * Update all character positions based on current time.
     * Returns movement messages for the player to see.
     */
    updatePositions(currentTime: string, playerRoomId: string): string[] {
        if (!this.schedule) return [];

        const messages: string[] = [];

        Object.keys(this.schedule).forEach(charId => {
            const char = this.characters[charId];
            if (!char) return;

            const events = this.schedule![charId];
            if (!events || events.length === 0) return;

            // Find the target location for current time
            const targetEvent = this.getTargetEvent(events, currentTime);
            if (!targetEvent) return;

            const currentRoom = grafitti.getCharacterRoom(charId) || char.currentRoomId;
            const targetRoom = targetEvent.locationId;

            // If already at target, no movement needed
            if (currentRoom === targetRoom) return;

            // Get next step towards target
            const nextStep = grafitti.getNextStep(currentRoom || 'foyer', targetRoom);
            if (!nextStep) return;

            // Move character one step
            const oldRoom = currentRoom || 'foyer';
            grafitti.moveCharacter(charId, nextStep);
            char.currentRoomId = nextStep;

            // Generate messages if player is in affected rooms
            if (playerRoomId === oldRoom) {
                const direction = grafitti.getDirection(oldRoom, nextStep);
                messages.push(`${char.name} leaves to the ${direction?.toUpperCase() || 'somewhere'}.`);
            }
            if (playerRoomId === nextStep) {
                const direction = grafitti.getDirection(nextStep, oldRoom);
                messages.push(`${char.name} enters from the ${direction?.toUpperCase() || 'somewhere'}.`);
            }
        });

        return messages;
    }

    /**
     * Find the most recent event for current time (event.time <= currentTime)
     */
    private getTargetEvent(events: { time: string; action: string; locationId: string }[], currentTime: string): { time: string; action: string; locationId: string } | null {
        const currentMinutes = this.timeToMinutes(currentTime);

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

    /**
     * Work method (not used directly, but required by Agent base)
     */
    async work(): Promise<void> {
        console.log("Destiny: work() called - use updatePositions() instead");
    }
}
