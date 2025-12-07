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

        if (story.characterSpecs) {
            this.cast = story.characterSpecs.map((spec, index) => ({
                id: `char_${index}_${spec.role.toLowerCase().replace(/ /g, '_')}`,
                name: spec.name,
                role: spec.role,
                bio: `A ${spec.role} with a ${spec.personality} personality.`,
                personality: spec.personality
            }));
        } else {
            // Fallback if no specs provided
            this.cast = [
                { id: 'c1', name: 'Colonel Mustard', role: 'Soldier', bio: 'A dignified military man.', personality: 'Gruff' }
            ];
        }

        return this.cast;
    }

    async getCast(): Promise<Character[]> {
        return this.cast;
    }
}
