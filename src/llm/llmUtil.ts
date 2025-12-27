/*
  This module is an abstraction layer for LLM APIs.

  General Usage:
  * call connect() to initialize the connection.
  * call generate() to get a response for a prompt.
  * other APIs are there for setting system message, chat history, etc.
  
  There is just one connection type for now: WebLLM.
*/

// Stubbed dependencies from decent-portal
function updateModelDeviceLoadHistory(_modelId: string, _success: boolean, _duration?: number) {
    // console.log(`[LLM Stats] Load ${_modelId} success=${_success} duration=${_duration}`);
}

function updateModelDevicePerformanceHistory(_modelId: string, _requestTime: number, _firstResponseTime: number, _endTime: number, _inputChars: number, _outputChars: number) {
    // console.log(`[LLM Stats] Perf ${_modelId} input=${_inputChars} output=${_outputChars}`);
}

import type { LLMConnection } from "./types/LLMConnection";
import { LLMConnectionState } from "./types/LLMConnectionState";
import { LLMConnectionType } from "./types/LLMConnectionType";
import type { LLMMessages } from "./types/LLMMessages";
import type { StatusUpdateCallback } from "./types/StatusUpdateCallback";
import { webLlmConnect, webLlmGenerate } from "./webLlmUtil";
import { getCachedPromptResponse, setCachedPromptResponse } from "./promptCache";

const UNSPECIFIED_MODEL_ID = 'UNSPECIFIED';

let theConnection: LLMConnection = {
    modelId: UNSPECIFIED_MODEL_ID,
    state: LLMConnectionState.UNINITIALIZED,
    webLLMEngine: null,
    serverUrl: null,
    connectionType: LLMConnectionType.NONE
}

let messages: LLMMessages = {
    chatHistory: [],
    maxChatHistorySize: 100,
    systemMessage: null
};

let savedMessages: LLMMessages | null = null;
let _connectionPromise: Promise<void> | null = null;
let _generationQueue: Promise<string> = Promise.resolve('');

function _clearConnectionAndThrow(message: string) {
    theConnection.webLLMEngine = null;
    theConnection.serverUrl = null;
    theConnection.connectionType = LLMConnectionType.NONE;
    theConnection.state = LLMConnectionState.INIT_FAILED;
    throw new Error(message);
}

function _inputCharCount(prompt: string): number {
    return prompt.length +
        (messages.systemMessage ? messages.systemMessage.length : 0) +
        messages.chatHistory.reduce((acc, curr) => acc + curr.content.length, 0);
}

/*
  Public APIs
*/

export function isLlmConnected(): boolean {
    return theConnection.state === LLMConnectionState.READY || theConnection.state === LLMConnectionState.GENERATING;
}

// Useful for app code that needs to use model-specific prompts or has other model-specific behavior.
export function getConnectionModelId(): string {
    if (theConnection.modelId = UNSPECIFIED_MODEL_ID) throw Error('Must connect before model ID can be known.');
    return theConnection.modelId;
}

export async function connect(modelId: string, onStatusUpdate: StatusUpdateCallback) {
    // If already connecting, return existing promise
    if (theConnection.state === LLMConnectionState.INITIALIZING && _connectionPromise) {
        return _connectionPromise;
    }

    if (isLlmConnected()) return;

    theConnection.state = LLMConnectionState.INITIALIZING;
    theConnection.modelId = modelId;
    const startLoadTime = Date.now();

    _connectionPromise = (async () => {
        try {
            if (!await webLlmConnect(theConnection.modelId, theConnection, onStatusUpdate)) {
                updateModelDeviceLoadHistory(theConnection.modelId, false);
                _clearConnectionAndThrow('Failed to connect to WebLLM.');
            }
            updateModelDeviceLoadHistory(theConnection.modelId, true, Date.now() - startLoadTime);
            theConnection.state = LLMConnectionState.READY;
        } catch (e) {
            theConnection.state = LLMConnectionState.INIT_FAILED;
            throw e;
        } finally {
            _connectionPromise = null;
        }
    })();

    await _connectionPromise;
}

export function setSystemMessage(message: string | null) {
    messages.systemMessage = message;
}

export function setChatHistorySize(size: number) {
    messages.maxChatHistorySize = size;
}

export function saveChatConfiguration() {
    savedMessages = { ...messages };
}

export function restoreChatConfiguration() {
    if (!savedMessages) throw Error('No saved configuration.');
    messages = { ...savedMessages };
}

export function clearChatHistory() {
    messages.chatHistory = [];
}

export function generate(prompt: string, onStatusUpdate: StatusUpdateCallback, historyMode: 'stateful' | 'stateless' = 'stateful'): Promise<string> {
    // Serialization wrapper
    const nextGen = _generationQueue.then(async () => {
        return _generateInternal(prompt, onStatusUpdate, historyMode);
    }).catch(e => {
        console.error("LLM generaton error in queue", e);
        throw e;
    });

    // @ts-ignore - mismatch boolean vs string promises, but we just need serialization
    _generationQueue = nextGen.catch(() => '');
    return nextGen;
}

async function _generateInternal(prompt: string, onStatusUpdate: StatusUpdateCallback, historyMode: 'stateful' | 'stateless'): Promise<string> {
    const cachedResponse = getCachedPromptResponse(prompt);
    if (cachedResponse) {
        onStatusUpdate(cachedResponse, 100);
        return cachedResponse;
    }

    // Wait for initialization if needed
    if (theConnection.state === LLMConnectionState.INITIALIZING && _connectionPromise) {
        console.log("LLM is initializing... waiting.");
        await _connectionPromise;
    }

    if (!isLlmConnected()) throw Error('LLM connection is not initialized.');
    if (theConnection.state !== LLMConnectionState.READY) throw Error(`LLM is not in ready state (Current: ${theConnection.state}).`);

    let firstResponseTime = 0;
    function _captureFirstResponse(status: string, percentComplete: number) {
        if (!firstResponseTime) firstResponseTime = Date.now();
        onStatusUpdate(status, percentComplete);
    }

    theConnection.state = LLMConnectionState.GENERATING;
    let message = '';
    let requestTime = Date.now();
    try {
        switch (theConnection.connectionType) {
            case LLMConnectionType.WEBLLM:
                // Create a temporary empty history for stateless requests
                const contextMessages = historyMode === 'stateless' ? {
                    chatHistory: [],
                    maxChatHistorySize: 100,
                    systemMessage: null
                } : messages;
                message = await webLlmGenerate(theConnection, contextMessages, prompt, _captureFirstResponse);
                break;
            default: throw Error('Unexpected');
        }
    } finally {
        theConnection.state = LLMConnectionState.READY;
    }

    updateModelDevicePerformanceHistory(theConnection.modelId, requestTime, firstResponseTime, Date.now(), _inputCharCount(prompt), message.length);
    setCachedPromptResponse(prompt, message);
    return message;
}
