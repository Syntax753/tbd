import type { GameState, Room, Character } from './types';
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
            history: []
        };
    }

    async initialize(): Promise<void> {
        const partialState = await this.executive.work();
        this.state = {
            ...this.state,
            ...partialState
        };
        this.isInitialized = true;
    }

    getHistory(): string[] {
        return this.state.history;
    }

    getState(): GameState {
        return this.state;
    }

    parseCommand(input: string): string {
        if (!this.isInitialized) return "The game is loading...";

        const cmd = input.trim().toLowerCase();
        // Log input to history (unless it's a move command that clears it)
        // Actually, we'll log it, and if handleMove clears it, so be it.
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
            // handleMove manages history clearing and pushing description
        } else if (verb === 'go' && noun) {
            // Handle "go n" etc
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
            response = "Available commands: look (l), north/south/east/west (n/s/e/w), talk <name>, story, schedule";
            this.state.history.push(response);
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

        return `${target.name} says: "I didn't do it! I swear!" (${target.personality})`;
    }
}
