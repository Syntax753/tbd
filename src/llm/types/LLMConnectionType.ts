export const LLMConnectionType = {
    WEBLLM: 'WEBLLM',
    NONE: 'NONE'
} as const;

export type LLMConnectionType = typeof LLMConnectionType[keyof typeof LLMConnectionType];
