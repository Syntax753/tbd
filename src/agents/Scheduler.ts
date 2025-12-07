import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { Schedule, StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class Scheduler extends Agent {
    private cachedSchedule: Schedule | null = null;

    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        super('Clockwork', 'Scheduler');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } else {
            console.warn("Scheduler: No Gemini API Key found. Using static schedule.");
        }
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

    async work(story: StoryManifest, characters: any[], rooms: any[]): Promise<Schedule> {
        // Simulating "scheduling" based on the story
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log("Scheduler: Creating schedule for cast...");

        // Base schedule (Pre-Dinner)
        const schedule: Schedule = {};
        const baseTimeline = [
            { time: '18:00', action: 'Arrives at Thorne Manor', locationId: 'foyer' },
            { time: '19:00', action: 'Listens to the Will Announcement', locationId: 'living_room' },
            { time: '20:00', action: 'Eats Dinner', locationId: 'dining_room' }
        ];

        // Initialize with base timeline
        characters.forEach(char => {
            schedule[char.id] = JSON.parse(JSON.stringify(baseTimeline));
        });

        // TEST MODE: Use hardcoded schedule if VITE_USE_TEST_DATA is set
        if (import.meta.env.VITE_USE_TEST_DATA === 'true') {
            console.log("Scheduler: Test Mode detected. Using refined test schedule.");
            const dynamicSchedule = this.getTestSchedule();

            // Merge dynamic events
            Object.entries(dynamicSchedule).forEach(([charId, events]) => {
                if (schedule[charId]) {
                    // @ts-ignore
                    schedule[charId].push(...events);
                    // Sort by time
                    schedule[charId].sort((a, b) => a.time.localeCompare(b.time));
                }
            });
        } else if (this.genAI && characters.length > 0) {
            // FULL MODE: Use Gemini
            try {
                console.log("Scheduler: Choreographing the night with AI...");
                const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const charInfos = characters.map(c => `${c.id} (${c.name}, ${c.role}): ${c.personality}`).join('\n');
                const roomInfos = rooms.map(r => `${r.id} (${r.name}): ${r.description}`).join('\n');

                const prompt = `
                    You are a director scheduling the movements of characters in a murder mystery game.
                    The game takes place in a mansion between 20:00 (after dinner) and 00:00 (Midnight).
                    
                    Characters:
                    ${charInfos}
                    
                    Available Rooms:
                    ${roomInfos}
                    
                    Task:
                    Generate a schedule for each character from 20:30 to 23:55.
                    Characters should visit rooms that align with their interests/personalities.
                    Characters can move multiple times.
                    
                    IMPORTANT:
                    - Return a JSON object where keys are character IDs and values are arrays of events.
                    - Event format: { time: "HH:MM", action: "Specific action description", locationId: "room_id" }
                    - Do NOT schedule events for the Host/Victim after 20:00 (he is busy dying later).
                    - Ensure locationIds match the provided room list exactly.
                    
                    Example:
                    {
                        "char_butler": [
                            { "time": "20:30", "action": "Cleaning the silverware", "locationId": "kitchen" },
                            { "time": "22:00", "action": "Polishing the banister", "locationId": "foyer" }
                        ]
                    }
                `;

                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const dynamicSchedule = JSON.parse(text);

                // Merge dynamic events
                Object.entries(dynamicSchedule).forEach(([charId, events]) => {
                    if (schedule[charId]) {
                        // @ts-ignore
                        schedule[charId].push(...events);
                        // Sort by time
                        schedule[charId].sort((a, b) => a.time.localeCompare(b.time));
                    }
                });
                console.log("Scheduler: AI Schedule merged.");

            } catch (err) {
                console.warn("Scheduler: Failed to generate dynamic schedule.", err);
            }
        }

        // Add fixed murder events (overwrites/appends critical plot points)
        characters.forEach(char => {
            if (char.role === 'Butler') {
                schedule[char.id].push({ time: '22:30', action: 'Poisons the brandy', locationId: 'living_room' });
            }
            if (char.role.includes('Victim')) {
                // Clear dynamics for victim to ensure he dies correctly
                schedule[char.id] = [
                    { time: '18:00', action: 'Greets guests', locationId: 'foyer' },
                    { time: '19:00', action: 'Announces Will', locationId: 'living_room' },
                    { time: '00:00', action: 'DIES', locationId: 'dining_room' }
                ];
            }
            // Sort final
            schedule[char.id].sort((a, b) => a.time.localeCompare(b.time));
        });

        this.cachedSchedule = schedule;
        return schedule;
    }

    private getTestSchedule(): any {
        // Timeline:
        // 18:00 - Arrival / Exploration
        // 19:00 - Living Room (Announcement)
        // 20:00 - Dining Room (Dinner)
        // 21:00+ - Exploration / Secrets

        const fixedEvents = [
            { time: '19:00', action: 'Listening to Archibald\'s announcement', locationId: 'living_room' },
            { time: '20:00', action: 'eats a tense dinner', locationId: 'dining_room' }
        ];

        return {
            'reginald_jeeves': [
                { time: '18:00', action: 'greeting guests at the door', locationId: 'foyer' },
                ...fixedEvents,
                { time: '21:00', action: 'cleaning up dinner service', locationId: 'kitchen' },
                { time: '21:30', action: 'polishing silver', locationId: 'butlers_pantry' },
                { time: '22:00', action: 'locking up the wine cellar', locationId: 'kitchen' }
            ],
            'aunt_petunia': [
                { time: '18:00', action: 'judging the decor', locationId: 'foyer' },
                { time: '18:30', action: 'complaining about drafts', locationId: 'living_room' },
                ...fixedEvents,
                { time: '21:00', action: 'snooping for dust', locationId: 'guest_corridor' },
                { time: '21:30', action: 'spying from the balcony', locationId: 'upper_landing' }
            ],
            'general_sterling': [
                { time: '18:00', action: 'boasting about past battles', locationId: 'living_room' },
                ...fixedEvents,
                { time: '21:00', action: 'smoking a cigar', locationId: 'game_room' },
                { time: '21:30', action: 'nervously pacing', locationId: 'masters_study' },
                { time: '22:00', action: 'playing darts alone', locationId: 'game_room' }
            ],
            'vivienne_thorne': [
                { time: '18:00', action: 'checking her inheritance calculations', locationId: 'masters_study' },
                { time: '18:45', action: 'pouring a strong drink', locationId: 'living_room' },
                ...fixedEvents,
                { time: '21:00', action: 'searching for the will', locationId: 'masters_study' },
                { time: '22:00', action: 'arguing with Arthur', locationId: 'game_room' }
            ],
            'arthur_pendelton': [
                { time: '18:00', action: 'sweating and adjusting his tie', locationId: 'foyer' },
                ...fixedEvents,
                { time: '21:00', action: 'reviewing legal documents', locationId: 'guest_corridor' },
                { time: '21:45', action: 'hiding a contract', locationId: 'butlers_pantry' }
            ],
            'dr_black': [
                { time: '18:00', action: 'looking for the bar', locationId: 'living_room' },
                ...fixedEvents,
                { time: '21:00', action: 'mixing a stiff drink', locationId: 'kitchen' },
                { time: '21:30', action: 'muttering about lost licenses', locationId: 'game_room' }
            ],
            'miss_scarlet': [
                { time: '18:00', action: 'making a grand entrance', locationId: 'foyer' },
                ...fixedEvents,
                { time: '21:00', action: 'flirting with the General', locationId: 'game_room' },
                { time: '22:00', action: 'touching up makeup', locationId: 'upper_landing' }
            ]
        };
    }
}
