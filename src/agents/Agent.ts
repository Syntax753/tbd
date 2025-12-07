import type { AgentCard, Task } from '../engine/A2A';

export abstract class Agent {
    protected name: string;
    protected role: string;

    // A2A: Every agent must declare its capabilities
    abstract get agentCard(): AgentCard;

    constructor(name: string, role: string) {
        this.name = name;
        this.role = role;
    }

    // Legacy/Bootstrap method
    abstract work(context?: any): Promise<any>;

    // A2A: Standardized task handler
    async handleTask(task: Task): Promise<any> {
        console.warn(`${this.name} received task ${task.type} but has no handler.`);
        return null;
    }
}
