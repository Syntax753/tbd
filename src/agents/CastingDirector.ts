import { GoogleGenerativeAI } from '@google/generative-ai';
import { Agent } from './Agent';
import type { Character, StoryManifest } from '../engine/types';
import type { AgentCard, Task } from '../engine/A2A';

export class CastingDirector extends Agent {
    private cast: Character[] = [];
    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        super('CastingDirector', 'Leo');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    get agentCard(): AgentCard {
        return {
            id: this.id,
            persona: this.persona,
            description: 'Creates cast of characters with personalities and motives',
            capabilities: [
                { name: 'generate_cast', description: 'Creates characters from story', inputType: 'StoryManifest', outputType: 'Character[]' },
                { name: 'get_characters', description: 'Returns cached cast', outputType: 'Character[]' }
            ]
        };
    }

    async handleTask(task: Task): Promise<any> {
        if (task.type === 'fetch_characters') {
            return this.getCast();
        }
        return null;
    }

    async work(story: StoryManifest, useTestData: boolean = false, suspectCount: number = 5, characterTypes?: string, modelMode: 'online' | 'offline' = 'online'): Promise<Character[]> {
        console.log("CastingDirector: Reviewing script and starting auditions...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        // TEST MODE: Use fallback cast
        if (useTestData) {
            console.log("CastingDirector -> TestData (Test Mode)");
            this.cast = this.getFallbackCast();
            return this.cast;
        }

        if (modelMode === 'online' && !this.genAI) {
            console.log("CastingDirector -> TestData (No API Key)");
            this.cast = this.getFallbackCast();
            return this.cast;
        }

        // Build character type description
        const charTypeDesc = characterTypes || 'aristocrats, socialites, and servants';

        // FULL MODE: Generate characters based on story
        try {
            const prompt = `
                You are a casting director for a murder mystery game.
                Based on the following story, create exactly ${suspectCount} unique characters.
                The characters should be ${charTypeDesc}.
                
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

            console.log(`CastingDirector -> LLM query ${prompt}`);
            let text = '';

            if (modelMode === 'offline') {
                const { generate } = await import('../llm/llmUtil');
                text = await generate(prompt, (_status) => { });
            } else {
                const model = this.genAI!.getGenerativeModel({ model: "gemini-2.5-flash" });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text();
            }

            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            console.log(`LLM -> CastingDirector response ${cleanText}`);
            const specs = JSON.parse(cleanText);

            this.cast = specs.map((spec: any, index: number) => {
                // Sanitize role for ID: lowercase, replace spaces/special chars with underscore
                const sanitizedRole = spec.role.toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscore
                    .replace(/_+/g, '_')          // Collapse multiple underscores
                    .replace(/^_|_$/g, '');       // Trim leading/trailing underscores
                return {
                    id: `char_${index}_${sanitizedRole}`,
                    name: spec.name,
                    role: spec.role,
                    bio: `A ${spec.role} with a ${spec.personality} personality.`,
                    personality: spec.personality
                };
            });

            console.log("CastingDirector: Cast hired.");

        } catch (error) {
            console.error("CastingDirector -> TestData (LLM Failed)", error);
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
