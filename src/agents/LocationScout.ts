import { Agent } from './Agent';
import type { Room } from '../engine/types';

export class LocationScout extends Agent {
    constructor() {
        super('Sarah', 'Location Scout');
    }

    async work(): Promise<Room[]> {
        // Simulating "scouting"
        await new Promise(resolve => setTimeout(resolve, 1500));

        const rooms: Room[] = [
            {
                id: 'foyer',
                name: 'The Grand Foyer',
                description: 'You stand in the Grand Foyer. A massive crystal chandelier hangs above. To the NORTH is a grand staircase. To the EAST is the Dining Room. To the WEST is the Living Room.',
                exits: { north: 'upper_landing', east: 'dining_room', west: 'living_room' }
            },
            {
                id: 'dining_room',
                name: 'Dining Room',
                description: 'A long mahogany table is set for dinner. The room is dimly lit. To the SOUTH is the Kitchen. To the WEST back is the Foyer.',
                exits: { south: 'kitchen', west: 'foyer' }
            },
            {
                id: 'kitchen',
                name: 'Kitchen',
                description: 'A bustling kitchen, though currently empty of staff. Pots and pans hang from the ceiling. To the NORTH is the Dining Room.',
                exits: { north: 'dining_room' }
            },
            {
                id: 'living_room',
                name: 'Living Room',
                description: 'Comfortable armchairs surround a roaring fireplace. Bookshelves line the walls. To the EAST is the Foyer.',
                exits: { east: 'foyer' }
            },
            {
                id: 'upper_landing',
                name: 'Upper Landing',
                description: 'The top of the stairs. A long corridor stretches out. To the SOUTH is the stairs down. To the EAST are the guest bedrooms.',
                exits: { south: 'foyer', east: 'guest_corridor' }
            },
            {
                id: 'guest_corridor',
                name: 'Guest Corridor',
                description: 'A long hallway lined with doors. You see names on the doors for the guests. To the WEST is the Landing.',
                exits: { west: 'upper_landing' }
            }
        ];

        return rooms;
    }
}
