import { Agent } from './Agent';
import type { Schedule, StoryManifest } from '../engine/types';

export class Scheduler extends Agent {
    constructor() {
        super('Clockwork', 'Scheduler');
    }

    async work(story: StoryManifest): Promise<Schedule> {
        // Simulating "scheduling" based on the story
        await new Promise(resolve => setTimeout(resolve, 800));

        // Hardcoded schedule for the prototype based on the "Dinner Party" theme
        const schedule: Schedule = {
            'guest_1': [
                { time: '18:00', action: 'Arrives at the mansion', locationId: 'foyer' },
                { time: '19:00', action: 'Drinks cocktails', locationId: 'living_room' },
                { time: '20:00', action: 'Dinner is served', locationId: 'dining_room' }
            ],
            'guest_2': [
                { time: '18:15', action: 'Arrives late and flustered', locationId: 'foyer' },
                { time: '19:00', action: 'Gossip with others', locationId: 'living_room' },
                { time: '20:00', action: 'Dinner is served', locationId: 'dining_room' }
            ],
            // Default for others
            'default': [
                { time: '19:00', action: 'Socializing', locationId: 'living_room' },
                { time: '20:00', action: 'Dinner', locationId: 'dining_room' }
            ]
        };

        return schedule;
    }
}
