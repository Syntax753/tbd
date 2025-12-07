import { Agent } from './Agent';
import type { Schedule, StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class Scheduler extends Agent {
    private cachedSchedule: Schedule | null = null;

    constructor() {
        super('Clockwork', 'Scheduler');
    }

    get agentCard(): AgentCard {
        return {
            name: this.name,
            role: this.role,
            capabilities: ['generate_schedule', 'get_schedule']
        };
    }

    async handleTask(task: Task): Promise<any> {
        if (task.type === 'get_schedule') {
            return this.cachedSchedule;
        }
        return null;
    }

    async work(story: StoryManifest, characters: any[]): Promise<Schedule> {
        // Simulating "scheduling" based on the story
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log("Scheduler: Creating schedule for cast...");

        // Generate schedule for "The Clockwork Inheritance" dynamically if possible
        const schedule: Schedule = {};

        // If we have characters, map them!
        if (characters.length > 0) {
            const timeline = [
                { time: '18:00', action: 'Arrives at Thorne Manor', locationId: 'foyer' },
                { time: '19:00', action: 'Listens to the Will Announcement', locationId: 'living_room' },
                { time: '20:00', action: 'Eats Dinner', locationId: 'dining_room' },
                { time: '00:00', action: 'Reacts to the murder', locationId: 'dining_room' }
            ];

            characters.forEach(char => {
                // Clone timeline
                schedule[char.id] = JSON.parse(JSON.stringify(timeline));

                // Customize a bit based on role
                if (char.role === 'Butler') {
                    schedule[char.id].push({ time: '22:30', action: 'Poisons the brandy', locationId: 'living_room' });
                }
                if (char.role === 'Spinster') {
                    schedule[char.id].push({ time: '22:00', action: 'Hides the knitting needle', locationId: 'guest_corridor' });
                }
                if (char.role.includes('Victim')) {
                    schedule[char.id] = [
                        { time: '18:00', action: 'Greets guests', locationId: 'foyer' },
                        { time: '19:00', action: 'Announces Will', locationId: 'living_room' },
                        { time: '00:00', action: 'DIES', locationId: 'dining_room' }
                    ];
                }
            });
        } else {
            // Fallback
            schedule['default'] = [];
        }

        this.cachedSchedule = schedule;
        return schedule;
    }
}
