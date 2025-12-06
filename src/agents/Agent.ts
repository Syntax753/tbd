export abstract class Agent {
    protected name: string;
    protected role: string;

    constructor(name: string, role: string) {
        this.name = name;
        this.role = role;
    }

    abstract work(context?: any): Promise<any>;
}
