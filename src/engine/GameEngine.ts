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
        this.state.history.push(`> ${input}`);

        let response = "";
        const parts = cmd.split(' ');
        const verb = parts[0];
        const noun = parts.slice(1).join(' ');

        if (verb === 'look') {
            response = this.handleLook();
        } else if (['north', 'south', 'east', 'west', 'up', 'down'].includes(verb)) {
            response = this.handleMove(verb);
        } else if (verb === 'go' && noun) {
            if (['north', 'south', 'east', 'west', 'up', 'down'].includes(noun)) {
                response = this.handleMove(noun);
            } else {
                response = "You can't go that way.";
            }
        } else if (verb === 'talk') {
            response = this.handleTalk(noun);
        } else if (verb === 'help') {
            response = "Available commands: look, north/south/east/west, talk <name>";
        } else {
            response = "I don't understand that command.";
        }

        this.state.history.push(response);
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
        if (!room) return "You are lost.";

        const nextRoomId = room.exits[direction];
        if (nextRoomId) {
            this.state.currentRoomId = nextRoomId;
            return this.handleLook();
        } else {
            return "You can't go that way.";
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
