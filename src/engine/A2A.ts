export interface CapabilityDefinition {
    name: string;           // e.g., "generate_story"
    description: string;    // Human-readable description
    inputType?: string;     // Simple type hint (e.g., "StoryManifest")
    outputType?: string;    // Simple type hint (e.g., "Character[]")
}

export interface AgentCard {
    id: string;             // PascalCase identifier (e.g., "Writer")
    persona: string;        // Human name (e.g., "Arthur")
    description: string;    // What this agent does
    capabilities: CapabilityDefinition[];
}

export type TaskStatus = 'submitted' | 'working' | 'completed' | 'failed';

export interface Task {
    id: string;
    type: string; // e.g. "fetch_characters"
    payload?: any;
    status: TaskStatus;
    result?: any;
    error?: string;
}

export interface Message {
    id: string;
    from: string;
    to: string;
    content: any;
    timestamp: number;
}
