export interface AgentCard {
    name: string;
    role: string;
    capabilities: string[]; // e.g. ["generate_story", "fetch_characters"]
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
