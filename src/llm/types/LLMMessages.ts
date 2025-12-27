import type { LLMMessage } from "./LLMMessage";

export type LLMMessages = {
    chatHistory: LLMMessage[],
    maxChatHistorySize: number;
    systemMessage: string | null;
    assistantMessage?: string | null;
}
