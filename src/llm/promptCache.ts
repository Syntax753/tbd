type StringMap = Record<string, string>;

const cache: StringMap = {};

export function getCachedPromptResponse(prompt: string): string | null {
    return cache[prompt] ?? null;
}

export function setCachedPromptResponse(prompt: string, response: string): void {
    cache[prompt] = response;
}
