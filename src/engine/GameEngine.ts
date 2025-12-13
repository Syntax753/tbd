import type { GameState, Character } from './types';
import { ExecutiveDirector } from '../agents/ExecutiveDirector';

export class GameEngine {
    private state: GameState;
    private executive: ExecutiveDirector;
    private isInitialized: boolean = false;

    constructor() {
        this.executive = new ExecutiveDirector();
        // Default empty state
        this.state = {
            currentRoomId: '',
            story: { title: '', background: '', intro: '' },
            map: {},
            characters: {},
            schedule: {},
            inventory: [],
            history: [],
            time: "18:00",
            isGameOver: false
        };
    }

    private lastAnnouncedTime: Record<string, string> = {};

    async initialize(onProgress?: (msg: string) => void): Promise<void> {
        const partialState = await this.executive.work(onProgress);
        this.state = {
            ...this.state,
            ...partialState,
            time: "18:00",
            isGameOver: false
        };
        this.isInitialized = true;
    }

    getHistory(): string[] {
        return this.state.history;
    }

    getState(): GameState {
        return this.state;
    }

    async parseCommand(input: string): Promise<string> {
        if (!this.isInitialized) return "The game is loading...";
        if (this.state.isGameOver) return "The game is over. Archibald is dead.";

        const cmd = input.trim().toLowerCase();
        this.state.history.push(`> ${input}`);

        let response = "";
        const parts = cmd.split(' ');
        const verb = parts[0];
        const noun = parts.slice(1).join(' ');

        // Shortcuts mapping
        const shortcuts: { [key: string]: string } = {
            'l': 'look',
            'n': 'north',
            's': 'south',
            'e': 'east',
            'w': 'west',
            'u': 'up',
            'd': 'down',
            'i': 'inventory'
        };

        const actualVerb = shortcuts[verb] || verb;

        if (actualVerb === 'look') {
            this.advanceTime(5);
            if (this.state.isGameOver) {
                const msg = "MIDNIGHT: Archibald is found dead! Game Over.";
                this.state.history.push(msg);
                return msg;
            }
            response = this.handleLook();
            this.state.history.push(response);
        } else if (['north', 'south', 'east', 'west', 'up', 'down'].includes(actualVerb)) {
            response = this.handleMove(actualVerb);
        } else if (verb === 'go' && noun) {
            const dir = shortcuts[noun] || noun;
            if (['north', 'south', 'east', 'west', 'up', 'down'].includes(dir)) {
                response = this.handleMove(dir);
            } else {
                response = "You can't go that way.";
                this.state.history.push(response);
            }
        } else if (actualVerb === 'wait') {
            this.state.history.push("You wait for 5 minutes...");
            this.advanceTime(5);
            response = "Time passes..."; // History update happens in advanceTime indirectly via logs or just the push above
            // Actually, we usually want to see what happens after time passes, so let's essentially do a 'look' or just show events?
            // The user req says: "actions should be displayed... movement made... description of person entering/exiting displayed".
            // These messages are pushed to history in updateCharacterLocations.
        } else if (actualVerb === 'talk') {
            response = this.handleTalk(noun);
            this.state.history.push(response);
        } else if (cmd === 'help') {
            const lines = [
                "*** HELP ***",
                "  look (l)         - Examine your surroundings",
                "  north (n)        - Move North",
                "  south (s)        - Move South",
                "  east (e)         - Move East",
                "  west (w)         - Move West",
                "  up (u)           - Move Up",
                "  down (d)         - Move Down",
                "  talk <name>      - Talk to a character",
                "  wait             - Wait for 5 minutes",
                "  inventory (i)    - Check your inventory",
                "  location (map)   - List all rooms and connections",
                "  story            - Review the story so far",
                "  schedule         - (Debug) View character schedules",
                "  characters       - (Debug) View character bios",
                "  help             - Show this message"
            ];
            this.state.history.push(...lines);
        } else if (cmd === 'location' || cmd === 'map') {
            const lines = ["*** MAP ***"];
            Object.values(this.state.map).forEach(room => {
                lines.push(`[${room.name}] (${room.id})`);
                Object.entries(room.exits).forEach(([dir, targetId]) => {
                    const targetName = this.state.map[targetId]?.name || targetId;
                    lines.push(`  -> ${dir.toUpperCase()}: ${targetName}`);
                });
                lines.push(""); // spacer
            });
            this.state.history.push(...lines);
        } else if (cmd === 'story') {
            const lines = [
                "*** STORY ***",
                `TITLE: ${this.state.story.title}`,
                `BACKGROUND: ${this.state.story.background}`,
                "PLOT POINTS:",
                ... (this.state.story.plotAndSecrets || ["No secrets found."])
            ];
            this.state.history.push(...lines);
        } else if (cmd === 'schedule') {
            const lines = ["*** SCHEDULE ***"];
            if (this.state.schedule) {
                Object.entries(this.state.schedule).forEach(([charId, events]) => {
                    const charName = this.state.characters[charId]?.name || charId;
                    lines.push(`[${charName}]`);
                    events.forEach(e => {
                        lines.push(`  ${e.time} - ${e.action} (@${e.locationId})`);
                    });
                    lines.push(""); // spacer
                });
            } else {
                lines.push("No schedule found.");
            }
            this.state.history.push(...lines);
        } else if (cmd === 'characters') {
            // A2A: Dispatch task to Executive Director
            const result = await this.executive.dispatch({
                id: 'cmd_chars',
                type: 'get_characters',
                status: 'submitted'
            });

            if (result && Array.isArray(result)) {
                const lines = ["*** CAST ***"];
                // @ts-ignore
                result.forEach((c: Character) => {
                    lines.push(`${c.name} (${c.role}): ${c.bio}`);
                });
                this.state.history.push(...lines);
            } else {
                this.state.history.push("No characters found.");
            }
        } else {
            response = "I don't understand that command.";
            this.state.history.push(response);
        }

        return response;
    }

    private handleLook(): string {
        const room = this.state.map[this.state.currentRoomId];
        if (!room) return "You are in void.";

        let desc = `[${room.name}]\n${room.description}`;

        // List exits
        const exits = Object.keys(room.exits).join(', ').toUpperCase();
        desc += `\nExits: ${exits}`;

        // List characters
        const charsHere = Object.values(this.state.characters).filter(c => c.currentRoomId === room.id);
        if (charsHere.length > 0) {
            const names = charsHere.map(c => `${c.name} is here.`).join(' ');
            desc += `\n\n${names}`;

            // Show current action if available
            charsHere.forEach(c => {
                const currentEvent = this.getCurrentEvent(c.id);
                if (currentEvent && currentEvent.locationId === room.id) {
                    desc += `\n${c.name}: ${currentEvent.action}`;
                }
            });
        }

        return desc;
    }

    private handleMove(direction: string): string {
        const room = this.state.map[this.state.currentRoomId];
        if (!room) {
            const error = "You are lost.";
            this.state.history.push(error);
            return error;
        }

        const nextRoomId = room.exits[direction];
        if (nextRoomId) {
            this.state.currentRoomId = nextRoomId;

            // Advance time by 5 minutes for movement
            this.advanceTime(5);

            if (this.state.isGameOver) {
                const msg = "MIDNIGHT: Archibald is found dead! Game Over.";
                this.state.history.push(msg);
                return msg;
            }

            // Clear screen (history) because we moved
            this.state.history = [];

            // Get new description
            const desc = this.handleLook();
            this.state.history.push(desc);
            return desc;
        } else {
            const error = "You can't go that way.";
            this.state.history.push(error);
            return error;
        }
    }

    private handleTalk(targetName: string): string {
        if (!targetName) return "Talk to whom?";

        const room = this.state.map[this.state.currentRoomId];
        const charsHere = Object.values(this.state.characters).filter(c => c.currentRoomId === room.id);

        // Simple fuzzy match
        const target = charsHere.find(c => c.name.toLowerCase().includes(targetName.toLowerCase()));

        if (!target) {
            return "You don't see them here.";
        }

        // Advance time by 5 minutes for talking
        this.advanceTime(5);
        if (this.state.isGameOver) {
            const msg = "MIDNIGHT: Archibald is found dead! Game Over.";
            return msg;
        }

        return `${target.name} says: "I didn't do it! I swear!" (${target.personality})`;
    }

    private advanceTime(minutes: number) {
        if (!this.state.time) return;

        const [currH, currM] = this.state.time.split(':').map(Number);
        let totalMinutes = currH * 60 + currM;
        totalMinutes += minutes;

        // Check for midnight (00:00 or 24:00)
        // Start is 18:00 (1080 min). Midnight is 1440 min (24 * 60).
        if (totalMinutes >= 24 * 60) {
            this.state.time = "00:00";
            this.state.isGameOver = true;
            return;
        }

        const newH = Math.floor(totalMinutes / 60) % 24;
        const newM = totalMinutes % 60;
        this.state.time = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

        // Update characters for every minute passed? Or just once?
        // Let's do it in one go, but ideally we'd simulate steps if minutes > 5. 
        // For now, handling a block of time as one 'tick' of logic is acceptable, 
        // but since we want step-by-step movement, we might assume 5 mins = 1 step.
        this.updateCharacterLocations();
    }

    private updateCharacterLocations() {
        if (!this.state.schedule) return;

        Object.keys(this.state.schedule).forEach((charId) => {
            const char = this.state.characters[charId];
            if (!char) return;

            // 1. Determine TARGET Room based on Schedule
            const targetRoomId = this.getTargetLocation(charId);

            if (!targetRoomId) return;

            // 2. Determine Next Step (Pathfinding)
            if (char.currentRoomId !== targetRoomId) {
                const nextStepId = this.findNextStep(char.currentRoomId!, targetRoomId);

                if (nextStepId) {
                    const oldRoomId = char.currentRoomId!;
                    const newRoomId = nextStepId;

                    // MESSAGING: Leaving Room
                    if (this.state.currentRoomId === oldRoomId) {
                        const direction = this.getDirection(oldRoomId, newRoomId);
                        this.state.history.push(`${char.name} leaves to the ${direction?.toUpperCase()}.`);
                    }

                    // EXECUTE MOVE
                    char.currentRoomId = newRoomId;

                    // MESSAGING: Entering Room
                    if (this.state.currentRoomId === newRoomId) {
                        const direction = this.getDirection(newRoomId, oldRoomId); // Entered FROM
                        this.state.history.push(`${char.name} enters from the ${direction?.toUpperCase()}.`);
                    }
                }
            } else {
                // Character is AT destination
                // MESSAGING: Show action if player is in the same room
                // MESSAGING: Show action if player is in the same room
                if (this.state.currentRoomId === char.currentRoomId) {
                    const currentEvent = this.getCurrentEvent(charId);
                    if (currentEvent) {
                        // Suppress repetition: match against last announced event time
                        const lastTime = this.lastAnnouncedTime[charId];
                        if (lastTime !== currentEvent.time) {
                            // "Reginald Jeeves: Arrives at Thorne Manor"
                            this.state.history.push(`${char.name}: ${currentEvent.action}`);
                            this.lastAnnouncedTime[charId] = currentEvent.time;
                        }
                    }
                }
            }
        });
    }

    private getTargetLocation(charId: string): string | null {
        const events = this.state.schedule[charId];
        if (!events) return null;

        // Find the latest event that has happened (time <= current_time)
        // OR are they supposed to leave early to arrive on time?
        // User said: "From 21:00, the character would start moving towards the conservatory."
        // This implies at 21:00 they adopt the new target.

        let targetId = this.state.characters[charId].currentRoomId; // Default to stay put
        const currentTotal = this.timeToMinutes(this.state.time);

        // We need the event with the largest time <= currentTotal
        let relevantEvent = null;
        for (const event of events) {
            const eventTotal = this.timeToMinutes(event.time);
            if (eventTotal <= currentTotal) {
                relevantEvent = event;
            }
        }

        return relevantEvent ? relevantEvent.locationId : (targetId || null);
    }

    private getCurrentEvent(charId: string) {
        const events = this.state.schedule[charId];
        if (!events) return null;
        const currentTotal = this.timeToMinutes(this.state.time);

        let relevantEvent = null;
        for (const event of events) {
            const eventTotal = this.timeToMinutes(event.time);
            if (eventTotal <= currentTotal) {
                relevantEvent = event;
            }
        }
        return relevantEvent;
    }

    // BFS Pathfinding
    private findNextStep(startId: string, targetId: string): string | null {
        if (startId === targetId) return null;

        const queue: { id: string; path: string[] }[] = [{ id: startId, path: [] }];
        const visited = new Set<string>();
        visited.add(startId);

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (id === targetId) {
                return path[0]; // Return first step
            }

            const room = this.state.map[id];
            if (!room) continue;

            for (const neighborId of Object.values(room.exits)) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push({ id: neighborId, path: [...path, neighborId] });
                }
            }
        }

        return null; // No path found
    }

    private getDirection(fromId: string, toId: string): string | null {
        const room = this.state.map[fromId];
        if (!room) return null;

        for (const [dir, id] of Object.entries(room.exits)) {
            if (id === toId) return dir;
        }
        return "somewhere";
    }

    private timeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        if (h === 0 && m === 0) return 24 * 60;
        return h * 60 + m;
    }
}
