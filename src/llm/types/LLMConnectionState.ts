export const LLMConnectionState = {
    UNINITIALIZED: 'UNINITIALIZED',
    INITIALIZING: 'INITIALIZING',
    INIT_FAILED: 'INIT_FAILED',
    READY: 'READY',
    GENERATING: 'GENERATING'
} as const;

export type LLMConnectionState = typeof LLMConnectionState[keyof typeof LLMConnectionState];
