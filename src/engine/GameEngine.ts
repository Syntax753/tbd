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

    async initialize(): Promise<void> {
        const partialState = await this.executive.work();
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
        } else if (actualVerb === 'talk') {
            response = this.handleTalk(noun);
            this.state.history.push(response);
        } else if (cmd === 'help') {
            const lines = [
                "*** AVAILABLE COMMANDS ***",
                "  look (l)         - Examine your surroundings",
                "  north (n)        - Move North",
                "  south (s)        - Move South",
                "  east (e)         - Move East",
                "  west (w)         - Move West",
                "  up (u)           - Move Up",
                "  down (d)         - Move Down",
                "  talk <name>      - Talk to a character",
                "  inventory (i)    - Check your inventory",
                "  location (map)   - List all rooms and connections",
                "  story            - Review the story so far",
                "  schedule         - (Debug) View character schedules",
                "  characters       - (Debug) View character bios",
                "  help             - Show this message"
            ];
            this.state.history.push(...lines);
        } else if (cmd === 'location' || cmd === 'map') {
            const lines = ["*** MANSION LAYOUT ***"];
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
                "*** SECRET STORY ARCHIVE ***",
                `TITLE: ${this.state.story.title}`,
                `BACKGROUND: ${this.state.story.background}`,
                "PLOT POINTS:",
                ... (this.state.story.plotAndSecrets || ["No secrets found."])
            ];
            this.state.history.push(...lines);
        } else if (cmd === 'schedule') {
            const lines = ["*** CHARACTER SCHEDULES ***"];
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
                const lines = ["*** CAST LIST ***"];
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
            const names = charsHere.map(c => c.name).join(', ');
            desc += `\n\nYou see: ${names}`;
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

            // Advance time by 1 minute for movement
            this.advanceTime(1);

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

        this.updateCharacterLocations();
    }

    private updateCharacterLocations() {
        if (!this.state.schedule) return;

        // "Query" the scheduler (using cached schedule for now)
        Object.entries(this.state.schedule).forEach(([charId, events]) => {
            const char = this.state.characters[charId];
            if (!char) return;

            // Find the latest event that has happened
            // Sort events by time just in case
            // events.sort... (assuming sorted for now)

            // Simple logic: find the event with the largest time <= current time
            let currentLocation = char.currentRoomId;
            const currentTotal = this.timeToMinutes(this.state.time);

            for (const event of events) {
                const eventTotal = this.timeToMinutes(event.time);
                if (eventTotal <= currentTotal) {
                    currentLocation = event.locationId;
                }
            }

            if (currentLocation && currentLocation !== char.currentRoomId) {
                char.currentRoomId = currentLocation;
            }
        });
    }

    private timeToMinutes(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        // Handle midnight as 24:00 for comparison if needed, but our logic uses 00:00 as end
        if (h === 0 && m === 0) return 24 * 60;
        return h * 60 + m;
    }
}
