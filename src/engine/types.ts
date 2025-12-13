export interface Room {
    id: string;
    name: string;
    description: string;
    exits: Record<string, string>; // e.g., { north: "kitchen" }
}

export interface Character {
    id: string;
    name: string;
    role: string;
    bio: string;
    personality: string;
    currentRoomId?: string;
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
