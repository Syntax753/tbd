import { Agent } from './Agent';
import type { StoryManifest } from '../engine/types';

export class Writer extends Agent {
    constructor() {
        super('Arthur', 'Writer');
    }

    async work(): Promise<StoryManifest> {
        // Simulating "creative process"
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            title: "The Mystery of Blackwood Manor",
            background: "You are a detective invited to an exclusive dinner party at Blackwood Manor. The host, billionaire recluse Lord Blackwood, has gathered 8 strangers.",
            intro: "It is a dark and stormy night. Thunder rumbles in the distance as you arrive at the imposing oak doors of Blackwood Manor. You were invited for dinner, but the atmosphere is heavy with tension. Inside, 8 other guests await. Lord Blackwood has not yet been seen.",
            plotAndSecrets: [
                "THE TRUTH BEHIND THE MURDER:",
                "Lord Blackwood was not killed by a guest, but by his own hubris.",
                "He attempted to summon a dark entity to grant him eternal life.",
                "The ritual went wrong, and the entity consumed his soul, leaving the body behind.",
                "The 'guests' were chosen as vessels for the entity's 8 lieutenants.",
                "General Sterling is actually a disgraced deserter.",
                "Madame LeBlanc is a blackmailer who knew Blackwood's secrets.",
                "The Butler knows everything but has been magically silenced.",
                "To win, the detective must find the 3 pieces of the amulet hidden in the library, crypt, and attic."
            ]
        };
    }
}
