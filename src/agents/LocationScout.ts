import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { Room } from '../engine/types';
import type { AgentCard } from '../engine/A2A';

export class LocationScout extends Agent {


        get agentCard(): AgentCard {
            return {
                id: this.id,
                persona: this.persona,
                description: 'Designs the mansion layout and rooms',
                capabilities: [
                    { name: 'generate_location', description: 'Creates rooms based on characters', inputType: 'Character[]', outputType: 'Room[]' },
                    { name: 'get_rooms', description: 'Returns cached rooms', outputType: 'Room[]' }
                ]
            };
        }

    private genAI: GoogleGenerativeAI | null = null;
    private cachedRooms: Room[] = [];

    constructor() {
        super('LocationScout', 'Sarah');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } else {
            console.warn("LocationScout: No Gemini API Key found. Using static map only.");
        }
    }

    async handleTask(task: { type: string }): Promise<any> {
        if (task.type === 'get_rooms') {
            return this.cachedRooms;
        }
        return null;
    }

    async work(_story: any, characters: any[], useTestData: boolean = false): Promise<Room[]> {
        console.log("LocationScout: Reviewing script and starting room scouting...");
        // TEST MODE: Use hardcoded mansion if useTestData is true
        if (useTestData) {
            console.log("LocationScout -> TestData (Test Mode)");
            return this.getTestMansion();
        }

        console.log("LocationScout: Surveying the estate...");

        let extraRooms: Room[] = [];

        if (this.genAI && characters && characters.length > 0) {
            try {
                console.log("LocationScout: Drafting new wings based on guest list...");
                const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const charSummaries = characters.map(c => `${c.name} (${c.role}): ${c.personality}`).join('\n');

                const prompt = `
                    You are an architect for a murder mystery game.
                    The mansion has these existing rooms: Foyer, Dining Room, Kitchen, Living Room, Upper Landing, Guest Corridor.
                    
                    Based on the following characters, generate one unique rooms per character OTHER THAN that would fit their personalities or roles (e.g. a Library for a smart character, a Garden for a nature lover, a Lab for a doctor).
                    
                    IMPORTANT:
                    1. Assign each new room a unique 'id' (lowercase, underscores).
                    2. Provide a 'name' and atmospheric 'description'.
                    3. Connect these new rooms to the existing rooms (Foyer, Living Room, Guest Corridor, etc) by specifying 'exits'.
                    4. Ensure the connections make spatial sense (e.g. don't overwrite existing exits unless logical).
                    
                    Here are the characters:
                    ${charSummaries}

                    Respond ONLY with a JSON array of Room objects:
                    interface Room {
                        id: string;
                        name: string;
                        description: string;
                        exits: { [direction: string]: string }; // direction: room_id
                    }
                `;

                console.log(`LocationScout -> LLM query ${prompt}`);
                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                console.log(`LLM -> LocationScout response ${text}`);
                extraRooms = JSON.parse(text);
                console.log(`LocationScout: Added ${extraRooms.length} new rooms.`);

            } catch (err) {
                console.warn("LocationScout: Failed to generate extra rooms.", err);
            }
        }

        // Merge rooms. Note: We might need to update exits of static rooms to point to new rooms if the LLM didn't doing it reciprocally (which it can't easily do for static objects).
        // For simplicity in this prototype, we rely on the LLM to say "The Library is NORTH of the Guest Corridor"
        // But we must manually ensure the Guest Corridor has an exit to the Library.
        // A smarter system would double-link. For now, let's just append.

        // Define staticRooms again locally since we removed the property earlier, or better yet, fetch getTestMansion() as base if we want mixed?
        // Actually, the request implies Test Mode = strictly the test layout. Full Mode = Dynamic.
        // But Dynamic needs a base. Let's re-introduce the base static rooms or just use getTestMansion as base?
        // The user said "Keep the same rooms but ensure they are logically positioned" for the test mode.
        // Let's assume for Dynamic Mode we start with getTestMansion() as the base and add on? Or maybe the original static list is better...
        // Let's use getTestMansion() as the base for now, as it's the most up-to-date map.

        let allRooms = [...this.getTestMansion(), ...extraRooms];

        // Auto-fix reciprocal exits
        extraRooms.forEach(newRoom => {
            Object.entries(newRoom.exits).forEach(([dir, targetId]) => {
                const targetRoom = allRooms.find(r => r.id === targetId);
                if (targetRoom) {
                    const opposite = this.getOppositeDir(dir);
                    if (opposite) {
                        targetRoom.exits[opposite] = newRoom.id;
                    }
                }
            });
        });

        this.cachedRooms = allRooms;
        return allRooms;
    }

    private getOppositeDir(dir: string): string | null {
        const admission = {
            'north': 'south', 'south': 'north',
            'east': 'west', 'west': 'east',
            'up': 'down', 'down': 'up'
        };
        // @ts-ignore
        return admission[dir.toLowerCase()] || null;
    }

    private getTestMansion(): Room[] {
        return [
            {
                id: 'foyer',
                name: 'The Grand Foyer',
                description: 'You stand in the Grand Foyer. A massive crystal chandelier hangs above.',
                exits: { north: 'upper_landing', east: 'dining_room', west: 'living_room', south: 'masters_study' }
            },
            {
                id: 'dining_room',
                name: 'Dining Room',
                description: 'A long mahogany table is set for dinner. The room is dimly lit.',
                exits: { south: 'kitchen', west: 'foyer' }
            },
            {
                id: 'kitchen',
                name: 'Kitchen',
                description: 'A bustling kitchen, though currently empty of staff. Pots and pans hang from the ceiling.',
                exits: { north: 'dining_room', east: 'butlers_pantry' }
            },
            {
                id: 'butlers_pantry',
                name: "The Butler's Pantry",
                description: 'A narrow room lined with shelves of fine china and silver.',
                exits: { west: 'kitchen' }
            },
            {
                id: 'living_room',
                name: 'Living Room',
                description: 'Comfortable armchairs surround a roaring fireplace. Bookshelves line the walls.',
                exits: { east: 'foyer', west: 'game_room' }
            },
            {
                id: 'game_room',
                name: 'The Game Room',
                description: 'A room featuring a billiard table and a dart board.',
                exits: { east: 'living_room' }
            },
            {
                id: 'masters_study',
                name: "The Master's Study",
                description: 'A dark, oak-paneled room smelling of old paper and pipe tobacco.',
                exits: { north: 'foyer' }
            },
            {
                id: 'upper_landing',
                name: 'Upper Landing',
                description: 'The top of the stairs. A long corridor stretches out.',
                exits: { south: 'foyer', east: 'guest_corridor' }
            },
            {
                id: 'guest_corridor',
                name: 'Guest Corridor',
                description: 'A long hallway lined with doors. You see names on the doors for the guests.',
                exits: { west: 'upper_landing' }
            }
        ];
    }


}
