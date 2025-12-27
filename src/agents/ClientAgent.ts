import { Agent } from './Agent';
import type { AgentCard, Task } from '../engine/A2A';

export interface GameConfig {
    storySetting: string;
    characterTypes: string;
    suspectCount: string;
    deceasedName: string;
    modelMode: 'online' | 'offline';
}

export interface GameMetaContext {
    venueName: string;      // "The Beach Resort", "Space Station Omega", etc.
    settingTheme: string;   // The original story setting
    deceasedName: string;   // Victim's name
    characterTheme: string; // Character type theme
}

/**
 * ClientAgent - The user-facing agent that collects configuration
 * and communicates with ExecutiveDirector via A2A protocol.
 * Also stores game meta context for consistent references.
 */
export class ClientAgent extends Agent {
    private config: GameConfig | null = null;
    private metaContext: GameMetaContext | null = null;
    private executiveDirector: any; // Reference to ExecutiveDirector for A2A

    constructor() {
        super('ClientAgent', 'Client');
    }

    get agentCard(): AgentCard {
        return {
            id: 'ClientAgent',
            persona: 'Client',
            description: 'User-facing agent that collects game configuration and initiates production',
            capabilities: [
                { name: 'collect_config', description: 'Collects user configuration for the mystery', inputType: 'void', outputType: 'GameConfig' },
                { name: 'start_game', description: 'Sends config to ExecutiveDirector to start production', inputType: 'GameConfig', outputType: 'GameState' },
                { name: 'get_meta', description: 'Returns game meta context', outputType: 'GameMetaContext' }
            ]
        };
    }

    /**
     * Set reference to ExecutiveDirector for A2A communication
     */
    setExecutiveDirector(director: any): void {
        this.executiveDirector = director;
    }

    /**
     * Store user configuration from UI
     */
    setConfig(config: GameConfig): void {
        this.config = config;
        console.log(`ClientAgent: Config received -`, config);

        // Derive meta context from config
        this.metaContext = {
            venueName: this.deriveVenueName(config.storySetting),
            settingTheme: config.storySetting || 'Mansion',
            deceasedName: config.deceasedName || 'Archibald',
            characterTheme: config.characterTypes || 'aristocrats'
        };
        console.log(`ClientAgent: MetaContext derived -`, this.metaContext);
    }

    /**
     * Derive a venue name from the story setting
     */
    private deriveVenueName(setting: string): string {
        if (!setting) return 'The Grand Estate';

        const settingLower = setting.toLowerCase();
        if (settingLower.includes('beach')) return 'The Seaside Resort';
        if (settingLower.includes('space')) return 'Space Station Omega';
        if (settingLower.includes('castle')) return 'The Ancient Castle';
        if (settingLower.includes('ship')) return 'The Luxury Liner';
        if (settingLower.includes('mountain')) return 'The Mountain Lodge';
        if (settingLower.includes('island')) return 'The Island Villa';

        // Default: capitalize the setting
        return `The ${setting.charAt(0).toUpperCase() + setting.slice(1)}`;
    }

    /**
     * Get stored configuration
     */
    getConfig(): GameConfig | null {
        return this.config;
    }

    /**
     * Get game meta context
     */
    getMetaContext(): GameMetaContext | null {
        return this.metaContext;
    }

    /**
     * A2A Task Handler
     */
    async handleTask(task: Task): Promise<any> {
        console.log(`ClientAgent <- Task: ${task.type}`);

        switch (task.type) {
            case 'get_config':
                return this.config;
            default:
                return super.handleTask(task);
        }
    }

    /**
     * Start the production by dispatching task to ExecutiveDirector
     * This is the main A2A flow from Client -> Director
     */
    async startProduction(onProgress?: (msg: string) => void): Promise<any> {
        if (!this.executiveDirector) {
            throw new Error('ClientAgent: ExecutiveDirector not set');
        }

        if (!this.config) {
            throw new Error('ClientAgent: No config set');
        }

        console.log(`ClientAgent -> ExecutiveDirector<start_production>`);

        // Create A2A task for ExecutiveDirector
        const task: Task = {
            id: `task_${Date.now()}`,
            type: 'start_production',
            payload: {
                config: this.config,
                metaContext: this.metaContext,
                onProgress
            },
            status: 'submitted'
        };

        // Dispatch to ExecutiveDirector
        const result = await this.executiveDirector.handleTask(task);
        return result;
    }

    /**
     * Legacy work method - redirects to A2A flow
     */
    async work(onProgress?: (msg: string) => void): Promise<any> {
        return this.startProduction(onProgress);
    }
}
