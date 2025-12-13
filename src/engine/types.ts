export interface Room {
    id: string;
    name: string;
    description: string;
    exits: Record<string, string>; // e.g., { north: "kitchen" }
}

/**
 * A witnessed event stored in a character's memory.
 */
export interface CharacterMemory {
    time: string;           // When they witnessed it
    roomId: string;         // Where they were (ID)
    roomName: string;       // Where they were (display name)
    witnessedCharId: string; // Who they saw
    witnessedCharName: string;
    action: string;         // What they were doing
    cachedResponse?: string; // Pre-generated personality-based response
}

export interface Character {
    id: string;
    name: string;
    role: string;
    bio: string;
    personality: string;
    currentRoomId?: string;
    memory?: CharacterMemory[];      // Events witnessed by this character
    cachedResponses?: string[];      // Pre-generated LLM responses for "talk to" 
    responsesReady?: boolean;        // Whether async LLM responses are prepared
}

export interface StoryManifest {
    title: string;
    background: string;
    intro: string;
    plotAndSecrets?: string[];

}

export interface ScheduleEvent {
    time: string; // e.g., "18:00"
    action: string;
    locationId: string;
}

export interface Schedule {
    [characterId: string]: ScheduleEvent[];
}

export interface GameState {
    currentRoomId: string;
    story: StoryManifest;
    map: Record<string, Room>;
    characters: Record<string, Character>;
    schedule: Schedule;
    inventory: string[]; // Future
    history: string[]; // Log of text
    time: string; // e.g. "18:00"
    isGameOver: boolean;
}
