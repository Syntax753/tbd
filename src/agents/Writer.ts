import { Agent } from './Agent';
import type { StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class Writer extends Agent {
    private cachedStory: StoryManifest | null = null;

    async handleTask(task: Task): Promise<any> {
        if (task.type === 'get_story' || task.type === 'get_story_context') {
            if (this.cachedStory) return this.cachedStory;
            return null;
        }
        return null;
    }

    get agentCard(): AgentCard {
        return {
            name: this.name,
            role: this.role,
            capabilities: ['generate_story', 'get_story']
        };
    }

    constructor() {
        super('Arthur', 'Writer');
    }

    async work(services: {
        locationScout: Agent,
        scheduler: Agent,
        castingDirector: Agent
    }): Promise<{ story: StoryManifest, map: any, characters: any, schedule: any }> {
        console.log("Writer: Consulting the digital muse (LLM)...");
        const story = await this.generateStoryFromLLM();
        this.cachedStory = story;

        console.log("Writer: Orchestrating production (A2A)...");
        // A2A Protocol: Writer calls the other agents directly
        const [map, characters, schedule] = await Promise.all([
            // @ts-ignore - We know the types at runtime for this prototype
            services.locationScout.work(story),
            // @ts-ignore
            services.castingDirector.work(story),
            // @ts-ignore
            services.scheduler.work(story)
        ]);

        return { story, map, characters, schedule };
    }

    private async generateStoryFromLLM(): Promise<StoryManifest> {
        // Simulating network latency for the "AI"
        await new Promise(resolve => setTimeout(resolve, 1500));

        return {
            title: "The Clockwork Inheritance",
            background: "You represent the law, but even you were surprised by the invitation. Archibald Thorne, a recluse known for his eccentric mechanical inventions, invited you to Thorne Manor for 'an evening of unique Entertainment'. You arrived at 6:00 PM, joining a cast of colorful strangers, none of whom knew why they were really there.",
            intro: "The grandfather clock strikes Midnight. A blood-curdling scream shatters the silence of the mansion. You rush to the Dining Room to find Archibald Thorne dead, slumped over his unfinished dessert. He was alive at 6:00 PM when the guests arrived, confused and wary. He was alive at 8:00 PM when Dinner was served with a side of cryptic insults. But now, the 'Entertainment' has taken a dark turn. You must determine who among these 7 strangers turned this game into a murder.",
            plotAndSecrets: [
                "*** CHRONICLE OF THE NIGHT ***",
                "18:00 - Guests arrive. The mysterious invitations are compared.",
                "19:00 - 'The Entertainment' begins: Archibald reveals he knows everyone's secrets.",
                "20:00 - Dinner is served at the grand table.",
                "22:00 - Archibald retires to his study, laughing about the 'Grand Finale'.",
                "00:00 - MIDNIGHT: Archibald is found dead.",
                "*** THE TRUTH ***",
                "MURDERER: The Butler, driven by a decades-old vendetta.",
                "METHOD: Poisoned the brandy snifter at 22:30.",
                "CLUE: The study door was locked from the inside, but the window was open.",
                "CAST: 8 Characters total (Host + 7 Suspects)."
            ],
            characterSpecs: [
                { name: "Archibald Thorne", role: "Host/Victim", personality: "Paranoid, wealthy, cruel" },
                { name: "Reginald Jeeves", role: "Butler", personality: "Loyal facade, secretly vengeful" },
                { name: "Aunt Petunia", role: "Spinster", personality: "Frail, observant, sharp-tongued" },
                { name: "General Sterling", role: "General", personality: "Blustery, nervous, fraudulent" },
                { name: "Vivienne Thorne", role: "Daughter", personality: "Ambitious, cold, calculating" },
                { name: "Arthur Pendelton", role: "Lawyer", personality: "Anxious, greedy, sweaty" },
                { name: "Dr. Black", role: "Doctor", personality: "Alcoholic, cynical, shaky hands" },
                { name: "Miss Scarlet", role: "Socialite", personality: "Flirtatious, manipulative, debt-ridden" }
            ]
        };
    }
}
