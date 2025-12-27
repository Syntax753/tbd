import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { Schedule, StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class Scheduler extends Agent {
    private cachedSchedule: Schedule | null = null;

    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        super('Scheduler', 'Clockwork');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } else {
            console.warn("Scheduler -> TestData (No API Key)");
        }
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Creates timeline of character movements and events',
            capabilities: [
                { name: 'generate_schedule', description: 'Creates schedule from story and characters', inputType: 'StoryManifest, Character[], Room[]', outputType: 'Schedule' },
                { name: 'get_schedule', description: 'Returns cached schedule', outputType: 'Schedule' }
            ]
        };
    }

    async handleTask(task: Task): Promise<any> {
        if (task.type === 'get_schedule') {
            return this.cachedSchedule;
        }
        return null;
    }

    /**
     * Get the cached schedule directly (for ExecutiveDirector)
     */
    getSchedule(): Schedule | null {
        return this.cachedSchedule;
    }

    async work(_story: StoryManifest, characters: any[], rooms: any[], useTestData: boolean = false, venueName?: string, modelMode: 'online' | 'offline' = 'online'): Promise<Schedule> {
        void _story;
        // Simulating "scheduling" based on the story
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log("Scheduler: Creating schedule for cast...");

        // Base schedule
        const schedule: Schedule = {};

        // TEST MODE: Use simplified schedule without dinner/murder
        if (useTestData) {
            console.log("Scheduler -> TestData (Test Mode - No Dinner/Murder)");
            const testSchedule = this.getTestSchedule();

            // Use test schedule directly (already starts everyone in foyer)
            Object.entries(testSchedule).forEach(([charId, events]) => {
                schedule[charId] = events as any;
            });

            this.cachedSchedule = schedule;
            return schedule;
        }

        // Use venue name from meta context or default
        const venue = venueName || 'the venue';

        // FULL MODE: Base timeline with dinner/murder events
        const baseTimeline = [
            { time: '18:00', action: `Arrives at ${venue}`, locationId: 'foyer' },
            { time: '19:00', action: 'Listens to the Will Announcement', locationId: 'living_room' },
            { time: '20:00', action: 'Eats Dinner', locationId: 'dining_room' }
        ];

        // Initialize with base timeline
        characters.forEach(char => {
            schedule[char.id] = JSON.parse(JSON.stringify(baseTimeline));
        });

        if ((characters.length > 0) && (modelMode === 'offline' || this.genAI)) {
            // FULL MODE: Use Gemini or Local LLM
            try {
                console.log("Scheduler: Choreographing the night with AI...");

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
                    
                    CRITICAL TIMING RULES:
                    1. ALL event times MUST be in 5-minute increments (e.g., 20:30, 20:35, 20:40, NOT 20:32).
                    2. Characters MUST stay in each room for AT LEAST 10 minutes before moving.
                    3. Example valid schedule: 20:30 in Kitchen, next event 20:40 or later (NOT 20:35).
                    
                    CRITICAL BEHAVIOR RULES:
                    1. Characters MUST physically move between connected rooms.
                    2. Characters MUST have interactions (e.g., "Arguing with Vivienne", "Plotting with the General").
                    3. If Character A is interacting with Character B at a time/place, Character B MUST also be there.
                    4. Use ONLY the specific Room IDs provided. Do not invent rooms.
                    5. Actions should be flavorful and specific to their personality.
                    
                    Output Format:
                    Return a JSON object where keys are character IDs and values are arrays of events.
                    Event format: { "time": "HH:MM", "action": "Description", "locationId": "room_id" }
                    
                    Example (note 10+ minute gaps between location changes):
                    {
                        "char_butler": [
                            { "time": "20:30", "action": "Cleaning the silverware", "locationId": "kitchen" },
                            { "time": "20:45", "action": "Serving drinks to the General", "locationId": "living_room" }
                        ]
                    }
                `;

                console.log(`Scheduler -> LLM query ${prompt}`);
                let text = '';

                if (modelMode === 'offline') {
                    const { generate } = await import('../llm/llmUtil');
                    text = await generate(prompt, (_status) => { });
                } else {
                    const model = this.genAI!.getGenerativeModel({ model: "gemini-2.5-flash" });
                    const result = await model.generateContent(prompt);
                    text = result.response.text();
                }

                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log(`LLM -> Scheduler response ${cleanText}`);
                const dynamicSchedule = JSON.parse(cleanText);

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

        // Validate and normalize times to 5-minute increments for ALL modes
        Object.keys(schedule).forEach(charId => {
            schedule[charId] = schedule[charId].map((event: any) => {
                const minutes = this.timeToMinutes(event.time);
                const normalized = Math.round(minutes / 5) * 5;
                return { ...event, time: this.minutesToTime(normalized) };
            });
        });

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

        // Note: Travel events are now handled at runtime by the tick method
        // Characters stay in place until they need to move towards their next event

        this.cachedSchedule = schedule;
        return schedule;
    }

    /**
     * Tick method - called each game turn to update character positions.
     * Returns movement data for characters who should move.
     */
    tick(currentTime: string, characters: Record<string, { id: string; name: string; currentRoomId: string }>): { charId: string; charName: string; from: string; to: string }[] {

        if (!this.cachedSchedule) return [];

        const movements: { charId: string; charName: string; from: string; to: string }[] = [];
        const currentMinutes = this.timeToMinutes(currentTime);

        Object.keys(this.cachedSchedule).forEach(charId => {
            const char = characters[charId];
            if (!char) return;

            const events = this.cachedSchedule![charId];
            if (!events || events.length === 0) return;

            // Find where the character should be heading
            const targetEvent = this.getTargetEvent(events, currentMinutes);
            if (!targetEvent) return;

            const currentRoom = char.currentRoomId;
            const targetRoom = targetEvent.locationId;

            // If already at target, stay put - no movement needed
            if (currentRoom === targetRoom) return;

            // Character needs to move towards target
            // This will be processed by Grafitti/Destiny to get next step
            movements.push({
                charId,
                charName: char.name,
                from: currentRoom,
                to: targetRoom
            });
        });

        return movements;
    }

    /**
     * Add a new event to a character's schedule (called by Destiny for spontaneous events).
     * Inserts the event in chronological order.
     */
    addEvent(charId: string, time: string, action: string, locationId: string): boolean {
        if (!this.cachedSchedule || !this.cachedSchedule[charId]) {
            return false;
        }

        const newEvent = { time, action, locationId };
        this.cachedSchedule[charId].push(newEvent);

        // Sort by time to maintain order
        this.cachedSchedule[charId].sort((a, b) => a.time.localeCompare(b.time));

        console.log(`Scheduler: Added event for ${charId} at ${time} - ${action}`);
        return true;
    }

    /**
     * Find the event the character should be heading towards.
     * Returns the most recent scheduled event at or before currentTime,
     * OR the next upcoming event if they need to be traveling.
     */
    private getTargetEvent(events: { time: string; action: string; locationId: string }[], currentMinutes: number): { time: string; action: string; locationId: string } | null {

        // Find current event (most recent one that has started)
        let currentEvent = null;
        for (const event of events) {
            const eventMinutes = this.timeToMinutes(event.time);
            if (eventMinutes <= currentMinutes) {
                currentEvent = event;
            } else {
                break;
            }
        }

        // If there's a current event, character should be there
        // If there's a next event coming up, check if they need to start traveling
        return currentEvent;
    }



    private getTestSchedule(): any {
        // Test mode schedule: No dinner/murder events, just exploration for behavior analysis
        // All characters start in foyer and explore based on personality
        // IDs must match CastingDirector.getFallbackCast() format: char_N_role

        return {
            // Butler - methodical, always attending to duties
            'char_1_butler': [
                { time: '18:00', action: 'greeting guests at the door', locationId: 'foyer' },
                { time: '18:30', action: 'polishing silver', locationId: 'butlers_pantry' },
                { time: '19:30', action: 'preparing refreshments', locationId: 'kitchen' },
                { time: '21:00', action: 'serving evening drinks', locationId: 'living_room' },
                { time: '22:30', action: 'tidying up for the night', locationId: 'foyer' },
                { time: '23:45', action: 'checking the doors are locked', locationId: 'foyer' }
            ],
            // Spinster - nosy, always snooping
            'char_2_spinster': [
                { time: '18:00', action: 'judging the decor', locationId: 'foyer' },
                { time: '18:40', action: 'snooping through hallways', locationId: 'guest_corridor' },
                { time: '19:30', action: 'eavesdropping on conversations', locationId: 'living_room' },
                { time: '21:00', action: 'peering through keyholes', locationId: 'upper_landing' },
                { time: '22:30', action: 'making notes about everyone', locationId: 'guest_corridor' },
                { time: '23:30', action: 'whispering suspicions', locationId: 'foyer' }
            ],
            // General - proud, reminiscing about glory days
            'char_3_general': [
                { time: '18:00', action: 'boasting about past battles', locationId: 'foyer' },
                { time: '18:50', action: 'smoking a cigar', locationId: 'game_room' },
                { time: '20:00', action: 'recounting war stories', locationId: 'living_room' },
                { time: '21:30', action: 'having a brandy nightcap', locationId: 'living_room' },
                { time: '23:00', action: 'pacing restlessly', locationId: 'masters_study' }
            ],
            // Daughter - THE MURDERER - greedy, desperate for inheritance
            'char_4_daughter': [
                { time: '18:00', action: 'making a dramatic entrance', locationId: 'foyer' },
                { time: '18:35', action: 'checking inheritance papers', locationId: 'masters_study' },
                { time: '19:30', action: 'arguing with someone quietly', locationId: 'living_room' },
                { time: '21:00', action: 'drinking heavily', locationId: 'game_room' },
                { time: '22:00', action: 'slipping away unnoticed', locationId: 'guest_corridor' },
                { time: '23:30', action: 'preparing something sinister', locationId: 'kitchen' },
                { time: '23:55', action: 'arriving at the study', locationId: 'masters_study' }
            ],
            // Lawyer - nervous, hiding secrets
            'char_5_lawyer': [
                { time: '18:00', action: 'adjusting his tie nervously', locationId: 'foyer' },
                { time: '18:45', action: 'hiding a contract', locationId: 'butlers_pantry' },
                { time: '19:30', action: 'consulting legal notes', locationId: 'guest_corridor' },
                { time: '21:00', action: 'avoiding certain people', locationId: 'kitchen' },
                { time: '22:30', action: 'making a suspicious phone call', locationId: 'foyer' },
                { time: '23:30', action: 'looking for an alibi', locationId: 'living_room' }
            ],
            // Doctor - alcoholic, in debt
            'char_6_doctor': [
                { time: '18:00', action: 'looking for the bar', locationId: 'foyer' },
                { time: '18:20', action: 'mixing a stiff drink', locationId: 'living_room' },
                { time: '19:30', action: 'slurring words slightly', locationId: 'game_room' },
                { time: '21:00', action: 'examining his medical bag', locationId: 'kitchen' },
                { time: '22:30', action: 'stumbling around', locationId: 'upper_landing' },
                { time: '23:30', action: 'passing out in a chair', locationId: 'living_room' }
            ],
            // Socialite - charming, manipulative
            'char_7_socialite': [
                { time: '18:00', action: 'making a grand entrance', locationId: 'foyer' },
                { time: '18:40', action: 'flirting with the General', locationId: 'game_room' },
                { time: '19:30', action: 'spreading gossip', locationId: 'living_room' },
                { time: '21:00', action: 'making eyes at someone', locationId: 'upper_landing' },
                { time: '22:30', action: 'reapplying lipstick', locationId: 'guest_corridor' },
                { time: '23:30', action: 'looking for a late-night scandal', locationId: 'foyer' }
            ]
        };
    }

    private timeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    private minutesToTime(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}
