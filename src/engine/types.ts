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
}

export interface GameState {
    currentRoomId: string;
    story: StoryManifest;
    map: Record<string, Room>;
    characters: Record<string, Character>;
    inventory: string[]; // Future
    history: string[]; // Log of text
}
