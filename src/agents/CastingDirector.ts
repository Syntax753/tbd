import { Agent } from './Agent';
import type { Character, StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class CastingDirector extends Agent {
    private cast: Character[] = [];

    constructor() {
        super('Leo', 'Casting Director');
    }

    get agentCard(): AgentCard {
        return {
            name: this.name,
            role: this.role,
            capabilities: ['cast_characters', 'fetch_characters']
        };
    }

    async handleTask(task: Task): Promise<any> {
        if (task.type === 'fetch_characters') {
            return this.getCast();
        }
        return null;
    }

    async work(story: StoryManifest): Promise<Character[]> {
        console.log("Casting Director: Reviewing script and auditing auditions...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        // TEST MODE or NO API KEY: Use fallback cast
        if (import.meta.env.VITE_USE_TEST_DATA === 'true' || !import.meta.env.VITE_GEMINI_API_KEY) {
            console.log("Casting Director: Using fallback cast.");
            this.cast = this.getFallbackCast();
            return this.cast;
        }

        // FULL MODE: Generate characters based on story
        try {
            // @ts-ignore
            const genAI = new (await import('@google/generative-ai')).GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `
                You are a casting director for a murder mystery game.
                Based on the following story, create 4-5 unique characters (including the victim if applicable, though usually they are pre-defined in the story context).
                
                Story Title: ${story.title}
                Background: ${story.background}
                Intro: ${story.intro}
                Plot: ${story.plotAndSecrets?.join('\n')}
                
                Create a diverse cast of suspects with unique personalities and motives.
                
                Respond ONLY with valid JSON matching this interface:
                [
                    { 
                        "name": "Name", 
                        "role": "Role (e.g. Butler, General)", 
                        "personality": "Personality description" 
                    }
                ]
            `;

            console.log(`CastingDirector calls LLM with query ${prompt}`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            console.log(`LLM replies with ${text}`);
            const specs = JSON.parse(text);

            this.cast = specs.map((spec: any, index: number) => ({
                id: `char_${index}_${spec.role.toLowerCase().replace(/ /g, '_')}`,
                name: spec.name,
                role: spec.role,
                bio: `A ${spec.role} with a ${spec.personality} personality.`,
                personality: spec.personality
            }));

            console.log("Casting Director: Cast hired.");

        } catch (error) {
            console.error("Casting Director: Failed to generate cast. Using fallback.", error);
            this.cast = this.getFallbackCast();
        }

        return this.cast;
    }

    private getFallbackCast(): Character[] {
        const specs = [
            { name: "Archibald Thorne", role: "Host/Victim", personality: "Paranoid, wealthy, cruel" },
            { name: "Reginald Jeeves", role: "Butler", personality: "Loyal facade, secretly vengeful" },
            { name: "Aunt Petunia", role: "Spinster", personality: "Frail, observant, sharp-tongued" },
            { name: "General Sterling", role: "General", personality: "Blustery, nervous, fraudulent" },
            { name: "Vivienne Thorne", role: "Daughter", personality: "Ambitious, cold, calculating" },
            { name: "Arthur Pendelton", role: "Lawyer", personality: "Anxious, greedy, sweaty" },
            { name: "Dr. Black", role: "Doctor", personality: "Alcoholic, cynical, shaky hands" },
            { name: "Miss Scarlet", role: "Socialite", personality: "Flirtatious, manipulative, debt-ridden" }
        ];

        return specs.map((spec, index) => ({
            id: `char_${index}_${spec.role.toLowerCase().replace(/ /g, '_')}`,
            name: spec.name,
            role: spec.role,
            bio: `A ${spec.role} with a ${spec.personality} personality.`,
            personality: spec.personality
        }));
    }

    async getCast(): Promise<Character[]> {
        return this.cast;
    }
}
