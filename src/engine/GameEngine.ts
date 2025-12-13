import type { GameState, Character } from './types';
import { ExecutiveDirector } from '../agents/ExecutiveDirector';
import { colorName } from '../utils/colors';

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

        let response = "";
        let commandOutput: string[] = [];
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
            'i': 'inventory',
            'ask': 'talk'
        };

        const actualVerb = shortcuts[verb] || verb;

        if (actualVerb === 'look') {
            this.advanceTime(5);
            if (this.state.isGameOver) {
                commandOutput = ["MIDNIGHT: Archibald is found dead! Game Over."];
            }
            // Just refresh - no extra output for look
        } else if (['north', 'south', 'east', 'west', 'up', 'down'].includes(actualVerb)) {
            response = this.handleMove(actualVerb);
            if (response) commandOutput = [response];
        } else if (verb === 'go' && noun) {
            const dir = shortcuts[noun] || noun;
            if (['north', 'south', 'east', 'west', 'up', 'down'].includes(dir)) {
                response = this.handleMove(dir);
                if (response) commandOutput = [response];
            } else {
                commandOutput = ["You can't go that way."];
            }
        } else if (actualVerb === 'wait') {
            commandOutput = ["You wait for 5 minutes..."];
            this.advanceTime(5);
        } else if (cmd === 'help') {
            commandOutput = [
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
                "  location (map)   - View the graphical map",
                "  story            - Review the story so far",
                "  schedule         - (Debug) View character schedules",
                "  characters       - (Debug) View character bios",
                "  help             - Show this message"
            ];
        } else if (cmd === 'story') {
            commandOutput = [
                "*** STORY ***",
                `TITLE: ${this.state.story.title}`,
                `BACKGROUND: ${this.state.story.background}`,
                "PLOT POINTS:",
                ... (this.state.story.plotAndSecrets || ["No secrets found."])
            ];
        } else if (cmd === 'schedule') {
            commandOutput = ["*** SCHEDULE ***"];
            if (this.state.schedule) {
                Object.entries(this.state.schedule).forEach(([charId, events]) => {
                    const charName = this.state.characters[charId]?.name || charId;
                    commandOutput.push(`[${colorName(charName)}]`);
                    events.forEach(e => {
                        const roomName = this.state.map[e.locationId]?.name || e.locationId;
                        commandOutput.push(`  ${e.time} - ${e.action} (${roomName})`);
                    });
                    commandOutput.push(""); // spacer
                });
            } else {
                commandOutput.push("No schedule found.");
            }
        } else if (cmd === 'characters') {
            // A2A: Dispatch task to Executive Director
            const result = await this.executive.dispatch({
                id: 'cmd_chars',
                type: 'get_characters',
                status: 'submitted'
            });

            if (result && Array.isArray(result)) {
                commandOutput = ["*** CAST ***"];
                result.forEach((c: Character) => {
                    commandOutput.push(`${colorName(c.name)} (${c.role}): ${c.bio}`);
                });
            } else {
                commandOutput = ["No characters found."];
            }
        } else if (cmd === 'location' || cmd === 'map') {
            // Map is handled by UI, skip refresh
            return "";
        } else if (actualVerb === 'talk') {
            // Parse: "talk [to] <name> [about <topic>]"
            const withoutTo = noun.replace(/^to\s+/i, '').trim();
            if (!withoutTo) {
                commandOutput = ["Talk to whom? Try: talk to <name>"];
            } else {
                const aboutMatch = withoutTo.match(/^(.+?)\s+about\s+(.+)$/i);
                if (aboutMatch) {
                    // Talk about person or action
                    const charName = aboutMatch[1].trim();
                    const topic = aboutMatch[2].trim();
                    commandOutput = await this.handleTalkAbout(charName, topic);
                } else {
                    // Simple talk - character introduction
                    commandOutput = await this.handleTalk(withoutTo);
                }
            }
            this.advanceTime(5);
        } else {
            commandOutput = ["I don't understand that command."];
        }

        // Call tick to update character positions based on current time
        const movementMessages = await this.executive.dispatch({
            id: 'tick',
            type: 'tick',
            status: 'submitted',
            payload: {
                time: this.state.time,
                playerRoomId: this.state.currentRoomId,
                characters: this.state.characters
            }
        });

        // Add movement messages to output
        if (movementMessages && movementMessages.length > 0) {
            commandOutput = [...movementMessages, "", ...commandOutput];
        }

        // Refresh display with the structured format
        this.refreshDisplay(commandOutput);

        return response;
    }

    /**
     * Refresh the display with standard format:
     * 1. Room description
     * 2. Blank line
     * 3. Characters/actions
     * 4. Blank line
     * 5. Command output (passed in)
     */
    private refreshDisplay(commandOutput: string[] = []) {
        // Clear history
        this.state.history = [];

        // 1. Room description
        const room = this.state.map[this.state.currentRoomId];
        if (room) {
            this.state.history.push(room.description);
        }

        // 2. Blank line between description and characters (only if there are characters)
        const charsHere = Object.values(this.state.characters).filter(c => c.currentRoomId === room?.id);
        if (charsHere.length > 0) {
            this.state.history.push("");  // Blank line before character presence
        }

        // 3. Characters and their actions
        if (charsHere.length > 0) {
            charsHere.forEach(c => {
                const currentEvent = this.getCurrentEvent(c.id);
                if (currentEvent && currentEvent.locationId === room?.id) {
                    this.state.history.push(`${colorName(c.name)}: ${currentEvent.action}`);
                } else {
                    this.state.history.push(`${colorName(c.name)} is here.`);
                }
            });
        }

        // 4. Blank line before command output
        if (commandOutput.length > 0) {
            this.state.history.push("");
        }

        // 5. Command output
        commandOutput.forEach(line => this.state.history.push(line));
    }

    private handleLook(): string {
        // Just refresh display with no extra output
        this.refreshDisplay();
        return "";
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

    private async handleTalk(targetName: string): Promise<string[]> {
        if (!targetName) return ["Talk to whom?"];

        const room = this.state.map[this.state.currentRoomId];
        const charsHere = Object.values(this.state.characters).filter(c => c.currentRoomId === room.id);

        // Simple fuzzy match
        const target = charsHere.find(c => c.name.toLowerCase().includes(targetName.toLowerCase()));

        if (!target) {
            return [`You don't see "${targetName}" here.`];
        }

        // Get LLM-generated response from Destiny
        const response = await this.executive.getTalkResponse(target.id);

        return [
            `${colorName(target.name)} turns to you.`,
            `"${response}"`
        ];
    }

    private async handleTalkAbout(speakerName: string, topic: string): Promise<string[]> {
        const room = this.state.map[this.state.currentRoomId];
        const charsHere = Object.values(this.state.characters).filter(c => c.currentRoomId === room.id);

        // Find the speaker
        const speaker = charsHere.find(c => c.name.toLowerCase().includes(speakerName.toLowerCase()));
        if (!speaker) {
            return [`You don't see "${speakerName}" here.`];
        }

        // Check if topic is a person's name
        const allChars = Object.values(this.state.characters);
        const targetChar = allChars.find(c => c.name.toLowerCase().includes(topic.toLowerCase()));

        if (targetChar) {
            // Talking about a person - check speaker's memories
            const memories = (speaker.memory || []).filter(m =>
                m.witnessedCharId === targetChar.id
            );

            if (memories.length === 0) {
                return [
                    `${colorName(speaker.name)} shrugs.`,
                    `"I haven't noticed ${targetChar.name} doing anything unusual."`
                ];
            }

            // Report sightings
            const sightings = memories.slice(-3).map(m =>
                `"I saw them ${m.action} at ${m.time}."`
            );
            return [
                `${colorName(speaker.name)} thinks for a moment about ${colorName(targetChar.name)}...`,
                ...sightings
            ];
        } else {
            // Talking about an action/behavior - check if speaker has done it
            const speakerEvents = this.state.schedule[speaker.id] || [];
            const matchingEvent = speakerEvents.find(e =>
                e.action.toLowerCase().includes(topic.toLowerCase())
            );

            // Character responds based on personality
            const isDefensive = speaker.personality?.toLowerCase().includes('nervous') ||
                speaker.personality?.toLowerCase().includes('anxious') ||
                speaker.personality?.toLowerCase().includes('suspicious');

            if (matchingEvent) {
                if (isDefensive) {
                    return [
                        `${colorName(speaker.name)} looks startled.`,
                        `"Why are you asking about that? I had my reasons!"`
                    ];
                } else {
                    return [
                        `${colorName(speaker.name)} looks unconcerned.`,
                        `"Oh, that? It's perfectly normal. Nothing to worry about."`
                    ];
                }
            } else {
                return [
                    `${colorName(speaker.name)} looks confused.`,
                    `"I'm not sure what you mean by '${topic}'."`
                ];
            }
        }
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
                        this.state.history.push(`${colorName(char.name)} leaves to the ${direction?.toUpperCase()}.`);
                    }

                    // EXECUTE MOVE
                    char.currentRoomId = newRoomId;

                    // MESSAGING: Entering Room
                    if (this.state.currentRoomId === newRoomId) {
                        const direction = this.getDirection(newRoomId, oldRoomId); // Entered FROM
                        this.state.history.push(`${colorName(char.name)} enters from the ${direction?.toUpperCase()}.`);
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
                            this.state.history.push(`${colorName(char.name)}: ${currentEvent.action}`);
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

    private generateAsciiMap(): string[] {
        const lines: string[] = ["*** MAP ***", ""];
        const rooms = Object.values(this.state.map);

        // Build adjacency info for layout
        // For simplicity, we'll render rooms in a list format with visual connections
        // A true grid layout would require coordinate assignment which is complex

        const currentRoom = this.state.currentRoomId;
        const BOX_WIDTH = 18;

        // Helper to center text in box
        const center = (text: string, width: number) => {
            const pad = width - text.length;
            const left = Math.floor(pad / 2);
            const right = pad - left;
            return ' '.repeat(left) + text + ' '.repeat(right);
        };

        // Helper to truncate and pad
        const fit = (text: string, width: number) => {
            if (text.length > width) return text.slice(0, width - 2) + '..';
            return center(text, width);
        };

        // Render each room as a box with connections
        rooms.forEach(room => {
            const isHere = room.id === currentRoom;
            const marker = isHere ? '[*]' : '   ';
            const shortName = room.name.replace('The ', '').slice(0, 14);

            // Build room box
            const top = `┌${'─'.repeat(BOX_WIDTH)}┐`;
            const mid = `│${fit(shortName, BOX_WIDTH)}│`;
            const bottom = `└${'─'.repeat(BOX_WIDTH)}┘`;

            // Connection indicators
            const exits = room.exits;
            const hasN = !!exits['north'];
            const hasS = !!exits['south'];
            const hasE = !!exits['east'];
            const hasW = !!exits['west'];
            const hasU = !!exits['up'];
            const hasD = !!exits['down'];

            // North connection
            if (hasN) {
                const targetName = this.state.map[exits['north']]?.name || exits['north'];
                lines.push(`         ▲ N: ${targetName.slice(0, 12)}`);
                lines.push(`         │`);
            }

            // Room box with East/West indicators
            const westArrow = hasW ? `◄ W ──` : `      `;
            const eastArrow = hasE ? `── E ►` : `      `;
            const eastTarget = hasE ? ` ${(this.state.map[exits['east']]?.name || '').slice(0, 10)}` : '';
            const westTarget = hasW ? `${(this.state.map[exits['west']]?.name || '').slice(0, 10)} ` : '';

            lines.push(`${marker} ${top}`);
            lines.push(`${westTarget.padStart(12)}${westArrow}${mid}${eastArrow}${eastTarget}`);
            lines.push(`    ${bottom}`);

            // South connection
            if (hasS) {
                lines.push(`         │`);
                const targetName = this.state.map[exits['south']]?.name || exits['south'];
                lines.push(`         ▼ S: ${targetName.slice(0, 12)}`);
            }

            // Up/Down indicators
            if (hasU || hasD) {
                let verticals = '    ';
                if (hasU) verticals += `↑ Up: ${(this.state.map[exits['up']]?.name || '').slice(0, 10)}  `;
                if (hasD) verticals += `↓ Down: ${(this.state.map[exits['down']]?.name || '').slice(0, 10)}`;
                lines.push(verticals);
            }

            lines.push(""); // Spacer between rooms
        });

        lines.push("[*] = Your current location");
        return lines;
    }
}
