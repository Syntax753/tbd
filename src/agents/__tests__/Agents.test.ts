import { describe, it, expect, beforeEach } from 'vitest';
import { Writer } from '../Writer';
import { Scheduler } from '../Scheduler';
import { CastingDirector } from '../CastingDirector';
import { LocationScout } from '../LocationScout';
import { ExecutiveDirector } from '../ExecutiveDirector';
import type { Task } from '../../engine/A2A';

describe('A2A Agent Network', () => {
    let writer: Writer;
    let scheduler: Scheduler;
    let castingDirector: CastingDirector;
    let locationScout: LocationScout;
    let executive: ExecutiveDirector;

    beforeEach(() => {
        writer = new Writer();
        scheduler = new Scheduler();
        castingDirector = new CastingDirector();
        locationScout = new LocationScout();
        executive = new ExecutiveDirector();
    });

    it('Writer generates a story and caches it', async () => {
        // Mock the sub-agents for Writer
        const mockServices = {
            locationScout: { work: () => Promise.resolve([]) } as any,
            scheduler: { work: () => Promise.resolve({}) } as any,
            castingDirector: { work: () => Promise.resolve([]) } as any
        };

        const result = await writer.work(mockServices);
        expect(result.story.title).toContain("Clockwork");

        // Test Retrieval via A2A
        const task: Task = { id: '1', type: 'get_story', status: 'submitted' };
        const cachedStory = await writer.handleTask(task);
        expect(cachedStory).toEqual(result.story);
    });

    it('Scheduler generates a schedule and caches it', async () => {
        // Mock CastingDirector
        const mockCast = [{ id: 'butler_1', name: 'Jeeves', role: 'Butler' }];
        const mockCD = { getCast: () => Promise.resolve(mockCast) };

        const schedule = await scheduler.work({} as any, mockCD);
        expect(schedule['butler_1']).toBeDefined();

        // Test Retrieval via A2A
        const task: Task = { id: '2', type: 'get_schedule', status: 'submitted' };
        const cachedSchedule = await scheduler.handleTask(task);
        expect(cachedSchedule).toBe(schedule);
    });

    it('ExecutiveDirector routes tasks correctly', async () => {
        // Initialize Executive (which inits its own agents)
        // We need to run work() to populate state if we rely on cached state
        await executive.work();

        // Test Dispatch -> Writer
        const storyTask: Task = { id: '3', type: 'get_story', status: 'submitted' };
        const story = await executive.dispatch(storyTask);
        expect(story).toBeDefined();
        expect(story.title).toBe("The Clockwork Inheritance");

        // Test Dispatch -> Scheduler
        const scheduleTask: Task = { id: '4', type: 'get_schedule', status: 'submitted' };
        const schedule = await executive.dispatch(scheduleTask);
        expect(schedule).toBeDefined();
        // Check for a known key if possible, or just non-null
        expect(Object.keys(schedule).length).toBeGreaterThan(0);
    });
});
