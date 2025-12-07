import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../engine/GameEngine';

describe('GameEngine Time System', () => {
    let engine: GameEngine;

    beforeEach(async () => {
        engine = new GameEngine();
        // Mock ExecutiveDirector to avoid full initialization
        // effectively skipping A2A for these unit tests if possible, 
        // or we just let it run if it's fast.
        // For accurate testing, we should mock the executive or just let it run.
        // Since we have fallbacks, it should be fine.
        await engine.initialize();
    });

    it('starts at 18:00', () => {
        const state = engine.getState();
        expect(state.time).toBe("18:00");
        expect(state.isGameOver).toBe(false);
    });

    it('advances time by 1 minute on move', async () => {
        // Find a valid move
        const room = engine.getState().map[engine.getState().currentRoomId];
        const dir = Object.keys(room.exits)[0];

        await engine.parseCommand(`go ${dir}`);
        expect(engine.getState().time).toBe("18:01");
    });

    it('advances time by 5 minutes on talk', async () => {
        // Need to be in a room with a character
        // Just mock the state for this test
        const state = engine.getState();
        state.characters['test_char'] = {
            id: 'test_char',
            name: 'Testy',
            role: 'Tester',
            bio: 'Test',
            personality: 'Test',
            currentRoomId: state.currentRoomId
        };

        await engine.parseCommand("talk Testy");
        expect(engine.getState().time).toBe("18:05");
    });

    it('triggers game over at midnight', async () => {
        const state = engine.getState();
        // fast forward
        state.time = "23:59";

        // Move (takes 1 min)
        const room = state.map[state.currentRoomId];
        const dir = Object.keys(room.exits)[0];
        const result = await engine.parseCommand(`go ${dir}`);

        expect(state.time).toBe("00:00");
        expect(state.isGameOver).toBe(true);
        expect(result).toContain("Archibald is found dead");
    });
});
