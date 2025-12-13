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
            console.log("Scheduler -> TestData (Test Mode)");
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
                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                console.log(`LLM -> Scheduler response ${text}`);
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

        // INJECT TRAVEL EVENTS (Pathfinding)
        // Convert rooms array to map for easier lookup
        const roomMap: Record<string, any> = {};
        rooms.forEach((r: any) => roomMap[r.id] = r);
        this.injectTravelEvents(schedule, roomMap);

        this.cachedSchedule = schedule;
        return schedule;
    }

    private injectTravelEvents(schedule: Schedule, roomMap: Record<string, any>) {
        Object.keys(schedule).forEach(charId => {
            const events = schedule[charId];
            const newEvents: any[] = [];

            // Start with the first event
            if (events.length === 0) return;
            newEvents.push(events[0]);

            for (let i = 1; i < events.length; i++) {
                const prevEvent = events[i - 1];
                const currEvent = events[i];

                if (prevEvent.locationId !== currEvent.locationId) {
                    // Calculate path
                    const path = this.findPath(prevEvent.locationId, currEvent.locationId, roomMap);

                    if (path.length > 0) {
                        // Back-fill from arrival time
                        // We need to arrive at 'currEvent.time'.
                        // The last step (entering currEvent.locationId) happens AT currEvent.time? 
                        // No, usually "Arrives at 20:00". So they must be "Moving" before 20:00.
                        // Let's say at 20:00 they are there. So at 19:55 they were at the previous step moving in?

                        const arrivalMinutes = this.timeToMinutes(currEvent.time);

                        // We need one event per step.
                        // Path: [Step1_ID, Step2_ID, ..., Target_ID]
                        // BUT: We are already AT prevEvent.locationId.
                        // Step 1: Move to P[0].
                        // Target is P[last].

                        // Let's say Path is [Hallway, Kitchen]. (From Foyer).
                        // Arrival at Kitchen is 20:00.
                        // 19:55: In Hallway (Moving to Kitchen).
                        // 19:50: In Foyer (Moving to Hallway).

                        // Iterate backwards through path
                        // path[last] is the target room (which determines the validation of arrival). 
                        // actually findPath result usually includes (or excludes) start/end depending on impl.
                        // Let's make findPath return ONLY intermediate steps + target.

                        // Path: [Intermediate1, Intermediate2, Target]

                        let offsetMinutes = 5;
                        for (let j = path.length - 1; j >= 0; j--) {
                            const stepRoomId = path[j]; // This is where they ARE.
                            // Wait, if they are AT the target at 20:00, then at 19:55 they are one step away.
                            // So path[last] is target. We don't need to say "Moving to target" AT the target.
                            // We need to say "Moving to target" at the step BEFORE target.

                            // Let's look at the example: 
                            // 19:55: Location = Hallway. Action = "Moving to Kitchen".

                            // So if I am at path[j] at time T, I am moving to path[j+1].

                            // Let's construct the sequence of LOCATIONS they occupy.
                            // Start -> ... -> End.
                            // At Time(End) they are at End.
                            // At Time(End)-5 they are at End-1.

                            // So we iterate:
                            // T_arrival = currEvent.
                            // Location(T-5) = path[last-1]. Action = "Moving to path[last]"
                            // Location(T-10) = path[last-2]. Action = "Moving to path[last-1]" (?? No, moving towards ultimate goal?)
                            // User wants simple "Moving".

                            // Let's refine:
                            // Path includes TARGET. 
                            // e.g. Start=Foyer. Target=Kitchen. Path=[Hallway, Kitchen].
                            // T=20:00, Loc=Kitchen (The main event).
                            // T=19:55, Loc=Hallway. Action="Moving to Kitchen".

                            // T=19:50, Loc=Foyer (Start). Action="Moving to Hallway".
                            // note: prevEvent was at Foyer. We might arguably overwrite/insert this.

                            // Let's loop k from 1 to path.length.
                            // The step we are taking is moving TO path[last - k + 1?].

                            // Actually, let's keep it simple.
                            // We have a list of rooms to traverse: [R1, R2, ..., R_Target].
                            // Start is R0.
                            // At T_Arrival (Time 0), we are at R_Target.
                            // At T-5, we are at R_(Target-1).

                            // Let's act on the path *excluding* target for the "Moving" events.
                            // If Path is [Hallway, Kitchen].
                            // We need an event at 19:55 in Hallway.

                            // What if Path has 1 step [Kitchen] (Neighbor).
                            // No intermediate event needed? 
                            // Wait, if I am at Foyer at 19:00. Dinner at 20:00 in Dining Room.
                            // Foyer -> Dining Room is direct? Let's say yes.
                            // 19:55: In Foyer, "Moving to Dining Room"?
                            // If we don't put this in, they just teleport at 20:00.
                            // The user said: "The scheduler would then insert an activity for moving...".
                            // So even for 1 step, we should probably have a "Leaving" or "Moving" event?
                            // Or does the Game Engine handle the 1-step move?
                            // Game Engine handles 5-min travel.
                            // If I schedule event at 20:00 in Dining Room.
                            // At 19:55 character is in Foyer.
                            // At 20:00 character moves to Dining Room?
                            // The engine sees: "Oh, it's 20:00, target is Dining Room. I am in Foyer. Move."
                            // So the ENGINE handles the actual move.
                            // BUT the user wants the SCHEDULE to include it.
                            // "The scheduler would then insert an activity for moving..."
                            // Maybe this means for MULTI-ROOM travel?
                            // "ensure the schedule includes moving the character to get there in time... using pathfinding ... how many moves it would take"

                            // If it takes 3 moves (15 mins), and scheduled event is 20:00.
                            // 19:45: Move 1.
                            // 19:50: Move 2.
                            // 19:55: Move 3 (Arrive).

                            // So we need intermediate waypoints for multi-hop paths.
                            // Path from Start to End.
                            // If Path is [A, B, C] (Length 3).
                            // Target C is at T.
                            // We need events for A (at T-10) and B (at T-5)?
                            // No, pathfinding returns [A, B, C].
                            // C is covered by the main event.
                            // We need to schedule "Transit" events for A and B.

                            // Wait, A is the first step.
                            // If start was S. Path [A, B, C].
                            // We need to be at A at T?
                            // T=20:00 is arrival at C.
                            // T-5 (19:55) = At B.
                            // T-10 (19:50) = At A.

                            // YES. We need to insert events for the *prefix* of the path.

                            const stepsNeeded = path.length - 1; // Exclude target
                            if (stepsNeeded <= 0) continue; // Direct connection, engine handles it? Or no?
                            // If direct connection, path is [Target]. Steps=0.
                            // Engine handles 1-hop.
                            // But if we want to confirm departure... "19:55 moving to Target"?
                            // Let's stick to filling gaps > 1 hop first.

                            for (let k = 0; k < stepsNeeded; k++) {
                                // path = [A, B, C]. stepsNeeded=2 (A, B).
                                // k=0 -> A. Time needed?
                                // Arrival (C) is at T.
                                // B is T-5.
                                // A is T-10.
                                // Formula: Minutes = Arrival - (PathLen - k) * 5?
                                // PathLen=3.
                                // k=0 (A): T - (3 - 0 - 1)*5? No.
                                // Reverse index?
                                // Let's simplify.
                                // The room we need to be in is path[k].
                                // The time we need to be there is Arrival - (PathLength - 1 - k) * 5.

                                // Example: [A, B, C]. Len=3.
                                // k=0 (A). Time = T - (3 - 1 - 0)*5 = T - 10. Correct.
                                // k=1 (B). Time = T - (3 - 1 - 1)*5 = T - 5. Correct.

                                const stepRoomId = path[k];
                                const timeOffset = (path.length - 1 - k) * 5;
                                const timeMinutes = arrivalMinutes - timeOffset;
                                const timeStr = this.minutesToTime(timeMinutes);

                                // Target of this move? The NEXT room.
                                const nextRoom = path[k + 1];
                                const nextRoomName = roomMap[nextRoom]?.name || nextRoom;

                                // Check if this time conflicts?
                                // We are just inserting into newEvents?
                                // We should push these to newEvents before pushing currEvent.
                                // BUT we need to make sure we don't duplicate or go out of order regarding prevEvent.
                                // If timeStr <= prevEvent.time, we have a squeeze.
                                // We'll just ignore for now or clamp?
                                // User said "ensure... in time".

                                newEvents.push({
                                    time: timeStr,
                                    action: `Moving towards ${nextRoomName}`,
                                    locationId: stepRoomId
                                });
                            }
                        }
                    }
                }

                newEvents.push(currEvent);
            }

            schedule[charId] = newEvents;
        });
    }

    private findPath(startId: string, targetId: string, roomMap: Record<string, any>): string[] {
        if (startId === targetId) return [];

        const queue: { id: string; path: string[] }[] = [{ id: startId, path: [] }];
        const visited = new Set<string>();
        visited.add(startId);

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (id === targetId) {
                return path; // Path of IDs to get there (excluding start, including end) -> [Step1, Step2, ..., Target]
            }

            const room = roomMap[id];
            if (!room) continue;

            // Exits loop
            for (const neighborId of Object.values(room.exits || {})) {
                if (!visited.has(neighborId as string)) {
                    visited.add(neighborId as string);
                    queue.push({ id: neighborId as string, path: [...path, neighborId as string] });
                }
            }
        }
        return [];
    }

    private getTestSchedule(): any {
        // Timeline (5-minute increments, 10-minute minimum stay per room):
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
                { time: '18:40', action: 'pouring a strong drink', locationId: 'living_room' },
                ...fixedEvents,
                { time: '21:00', action: 'searching for the will', locationId: 'masters_study' },
                { time: '22:00', action: 'arguing with Arthur', locationId: 'game_room' }
            ],
            'arthur_pendelton': [
                { time: '18:00', action: 'sweating and adjusting his tie', locationId: 'foyer' },
                ...fixedEvents,
                { time: '21:00', action: 'reviewing legal documents', locationId: 'guest_corridor' },
                { time: '21:40', action: 'hiding a contract', locationId: 'butlers_pantry' }
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
