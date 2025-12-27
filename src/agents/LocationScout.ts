import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { Room } from '../engine/types';
import type { AgentCard } from '../engine/A2A';

export class LocationScout extends Agent {


    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Designs the world layout and rooms based on story setting',
            capabilities: [
                { name: 'generate_location', description: 'Creates rooms based on setting and characters', inputType: 'Character[]', outputType: 'Room[]' },
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

    async work(_story: any, characters: any[], useTestData: boolean = false, storySetting?: string, modelMode: 'online' | 'offline' = 'online'): Promise<Room[]> {
        console.log("LocationScout: Reviewing script and starting room scouting...");
        if (storySetting) {
            console.log(`LocationScout: Setting - "${storySetting}"`);
        }

        // TEST MODE: Use hardcoded mansion if useTestData is true
        if (useTestData) {
            console.log("LocationScout -> TestData (Test Mode)");
            return this.getTestMansion();
        }

        console.log("LocationScout: Surveying the location...");

        const setting = storySetting || 'a grand mansion';
        let rooms: Room[] = [];

        if ((characters && characters.length > 0) && (modelMode === 'offline' || this.genAI)) {
            try {
                console.log("LocationScout: Designing rooms based on setting and characters...");

                const charSummaries = characters.map(c => `${c.name} (${c.role}): ${c.personality}`).join('\n');

                const prompt = `
                    You are an architect for a murder mystery game set in: ${setting}
                    
                    Design a location with at least 6 rooms appropriate for this setting. Include:
                    1. An ENTRY ROOM appropriate for the setting (e.g., "Beach Entrance", "Space Station Airlock", "Castle Gate") - this MUST have id "foyer"
                    2. A DINING/EATING area (e.g., "Beach Bar", "Mess Hall", "Great Hall")
                    3. A KITCHEN/FOOD PREP area for staff
                    4. A GUEST QUARTERS/BEDROOM area
                    5. A STAFF/SERVANT quarters
                    6. At least 1-2 additional rooms that fit the setting and characters
                    
                    Characters to consider:
                    ${charSummaries}
                    
                    IMPORTANT RULES:
                    1. Room names should fit the "${setting}" theme - NO generic "manor" or "mansion" names
                    2. The entry room MUST have id "foyer" (but can have any name)
                    3. All rooms must be connected via exits (north, south, east, west, up, down)
                    4. Every exit must be bidirectional (if A connects to B, B must connect back to A)
                    5. Descriptions should be atmospheric and fit the setting
                    
                    Respond ONLY with a JSON array of Room objects:
                    interface Room {
                        id: string;       // lowercase, underscores, "foyer" for entry
                        name: string;     // Display name fitting the setting  
                        description: string;
                        exits: { [direction: string]: string }; // direction: room_id
                    }
                `;

                console.log(`LocationScout -> LLM: Generating ${setting} layout`);
                let text = '';

                if (modelMode === 'offline') {
                    const { generate } = await import('../llm/llmUtil');
                    text = await generate(prompt, (_status) => { }, 'stateless');
                } else {
                    const model = this.genAI!.getGenerativeModel({ model: "gemini-2.5-flash" });
                    const result = await model.generateContent(prompt);
                    text = result.response.text();
                }

                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log(`LLM -> LocationScout: ${cleanText.substring(0, 200)}...`);
                rooms = JSON.parse(cleanText);
                console.log(`LocationScout: Created ${rooms.length} rooms for ${setting}`);

            } catch (err) {
                console.warn("LocationScout: Failed to generate rooms, using fallback.", err);
                rooms = this.getTestMansion();
            }
        } else {
            rooms = this.getTestMansion();
        }

        // Comprehensive grid validation and auto-fix
        rooms = this.validateAndFixGrid(rooms);

        this.cachedRooms = rooms;
        return rooms;
    }

    /**
     * Validate and fix the room grid:
     * 1. Ensure all exits point to existing rooms
     * 2. Ensure bidirectional exits (if A->north->B, then B->south->A)
     * 3. Log all issues to console
     */
    private validateAndFixGrid(rooms: Room[]): Room[] {
        const roomById: Record<string, Room> = {};
        rooms.forEach(r => roomById[r.id] = r);

        rooms.forEach(room => {
            const toRemove: string[] = [];

            Object.entries(room.exits).forEach(([dir, targetId]) => {
                const target = roomById[targetId];

                // Check if target exists
                if (!target) {
                    console.log(`Invalid grid - ${room.name}: exit "${dir}" points to non-existent room "${targetId}". Removing exit.`);
                    toRemove.push(dir);
                    return;
                }

                // Check for reciprocal exit
                const opposite = this.getOppositeDir(dir);
                if (opposite) {
                    if (!target.exits[opposite]) {
                        console.log(`Invalid grid - adding return path: ${target.name} now has "${opposite}" exit back to ${room.name}`);
                        target.exits[opposite] = room.id;
                    } else if (target.exits[opposite] !== room.id) {
                        console.log(`Invalid grid - ${target.name} exit "${opposite}" points to ${roomById[target.exits[opposite]]?.name || target.exits[opposite]} instead of ${room.name}. Fixing.`);
                        target.exits[opposite] = room.id;
                    }
                }
            });

            // Remove invalid exits
            toRemove.forEach(dir => delete room.exits[dir]);
        });

        return rooms;
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
