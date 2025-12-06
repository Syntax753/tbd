import { Agent } from './Agent';
import type { Character } from '../engine/types';

export class CastingDirector extends Agent {
    constructor() {
        super('Leo', 'Casting Director');
    }

    async work(): Promise<Character[]> {
        // Simulating "auditions"
        await new Promise(resolve => setTimeout(resolve, 1200));

        return [
            {
                id: 'guest_1',
                name: 'General Sterling',
                role: 'Guest',
                bio: 'A retired military man with a stiff upper lip and a secretive past.',
                personality: 'Stern, commanding, defensive.'
            },
            {
                id: 'guest_2',
                name: 'Madame LeBlanc',
                role: 'Guest',
                bio: 'A wealthy socialite who seems to know everyone\'s business.',
                personality: 'Charming, gossipy, manipulative.'
            },
            {
                id: 'guest_3',
                name: 'Dr. Thorne',
                role: 'Guest',
                bio: 'A surgeon with shaky hands and a nervous tic.',
                personality: 'Nervous, intellectual, evasive.'
            },
            {
                id: 'guest_4',
                name: 'Miss Vance',
                role: 'Guest',
                bio: 'A young actress looking for her big break.',
                personality: 'Dramatic, emotional, ambitious.'
            },
            {
                id: 'guest_5',
                name: 'Baron Von Kessel',
                role: 'Guest',
                bio: 'A foreign dignitary with a scar on his cheek.',
                personality: 'Cold, polite, mysterious.'
            },
            {
                id: 'guest_6',
                name: 'Father O\'Malley',
                role: 'Guest',
                bio: 'A priest who seems out of place in such luxury.',
                personality: 'Humble, observant, moralizing.'
            },
            {
                id: 'guest_7',
                name: 'Professor Black',
                role: 'Guest',
                bio: 'An academic specializing in ancient history.',
                personality: 'Absent-minded, curious, rambling.'
            },
            {
                id: 'guest_8',
                name: 'Lady Ashbury',
                role: 'Guest',
                bio: 'A widow wearing all black.',
                personality: 'Melancholic, quiet, intense.'
            }
        ];
    }
}
