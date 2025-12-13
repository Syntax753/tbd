import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class Writer extends Agent {
    private cachedStory: StoryManifest | null = null;
    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        super('Arthur', 'Writer');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } else {
            console.warn("Writer: No Gemini API Key found. Using fallback story.");
        }
    }

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

    async work(): Promise<StoryManifest> {
        console.log("Writer: Picks up the pen");
        const story = await this.generateStoryFromLLM();
        this.cachedStory = story;
        return story;
    }

    private async generateStoryFromLLM(): Promise<StoryManifest> {
        // TEST MODE: Force fallback story if VITE_USE_TEST_DATA is set
        if (import.meta.env.VITE_USE_TEST_DATA === 'true') {
            console.log("Writer -> TestData (Test Mode)");
            return this.getFallbackStory();
        }

        if (!this.genAI) {
            console.log("Writer -> TestData (No API Key)");
            return this.getFallbackStory();
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `
                You are a mystery writer. Create a murder mystery story manifest for a text adventure game.
                The setting is a mansion.
                The host, Archibald Thorne, is found dead at midnight.
                The game starts at 18:00.
                
                Respond ONLY with valid JSON matching this interface:
                interface StoryManifest {
                    title: string;
                    background: string; // Context before game starts
                    intro: string; // The text shown when the game starts
                    plotAndSecrets: string[]; // Timeline of events and the solution
                }
            `;

            console.log(`Writer -> LLM query ${prompt}`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            console.log(`LLM -> Writer response ${text}`);

            // Cleanup markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const story = JSON.parse(cleanText) as StoryManifest;
            return story;

        } catch (error) {
            console.error("Writer -> TestData (LLM Failed)", error);
            return this.getFallbackStory();
        }
    }

    private getFallbackStory(): StoryManifest {
        return {
            title: "The Clockwork Inheritance",
            background: "You are a free-lance detective. You received a mysterious invite to attend a dinner party by the wealthy Acrhibald Thorne.",
            intro: "Archibald Thorne, a reclusive and immensely wealthy industrialist, invited a select group of family, close associates, and specialists to his sprawling, enigmatic Thorne Manor for a weekend gathering. The stated purpose was a 'celebration of life and legacy,' but rumors abounded that Archibald, known for his eccentricities and failing health, intended to make a significant announcement regarding his vast fortune and controversial will. The manor itself is a character, with its labyrinthine corridors, hidden passages, and a history as rich and shadowy as its owner's past. Guests arrived expecting revelations, but none could have foreseen the tragic events that would unfold.",
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
        };
    }
}
