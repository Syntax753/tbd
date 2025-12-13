import type { AgentCard, Task } from '../engine/A2A';

export abstract class Agent {
    protected id: string;      // PascalCase agent type (e.g., "Writer")
    protected persona: string; // Human name (e.g., "Arthur")

    // A2A: Every agent must declare its capabilities
    abstract get agentCard(): AgentCard;

    constructor(id: string, persona: string) {
        this.id = id;
        this.persona = persona;
    }

    // Legacy/Bootstrap method
    abstract work(...args: any[]): Promise<any>;

    // A2A: Standardized task handler
    async handleTask(task: Task): Promise<any> {
        console.warn(`${this.id} received task ${task.type} but has no handler.`);
        return null;
    }
}
