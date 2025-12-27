import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { connect, generate, setSystemMessage } from '../llm/llmUtil';

interface LLMContextType {
    isOfflineMode: boolean;
    setOfflineMode: (offline: boolean) => void;
    llmStatus: 'idle' | 'initializing' | 'ready' | 'error';
    loadProgress: number;
    loadMessage: string;
    submitPrompt: (systemPrompt: string, userPrompt: string, onUpdate: (response: string) => void) => Promise<string>;
}

const LLMContext = createContext<LLMContextType | undefined>(undefined);

// Hardcoded model ID for now - could be configurable
// const MODEL_ID = 'Llama-3-8B-Instruct-q4f32_1-MLC'; 
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'; // Smaller model for testing/browser

export const LLMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOfflineMode, setOfflineMode] = useState(false);
    const [llmStatus, setLlmStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadMessage, setLoadMessage] = useState('');

    useEffect(() => {
        if (isOfflineMode && llmStatus === 'idle') {
            initializeLLM();
        }
    }, [isOfflineMode, llmStatus]);

    const initializeLLM = async () => {
        try {
            setLlmStatus('initializing');
            setLoadMessage('Initializing Local LLM...');
            await connect(MODEL_ID, (status: string, progress: number) => {
                setLoadMessage(status);
                // Progress from WebLLM is 0-1 (e.g., 0.1, 0.5)
                setLoadProgress(Math.floor(progress * 100));
            });
            setLlmStatus('ready');
            setLoadMessage('Local LLM Ready');
        } catch (error) {
            console.error("Failed to initialize LLM:", error);
            setLlmStatus('error');
            setLoadMessage('Failed to load Local LLM');
        }
    };

    const submitPrompt = async (systemPrompt: string, userPrompt: string, onUpdate: (response: string) => void): Promise<string> => {
        if (!isOfflineMode) {
            throw new Error("Cannot use local submitPrompt in online mode");
        }

        if (llmStatus !== 'ready') {
            // Attempt to initialize if not ready (though it should be)
            if (llmStatus === 'idle') {
                await initializeLLM();
            } else {
                throw new Error("LLM is not ready yet");
            }
        }

        setSystemMessage(systemPrompt);
        // generate(prompt, callback) matches llmUtil signature
        // The callback receives (status, percent). If percent=1, it's done.
        // But status contains the partial text during generation.
        return await generate(userPrompt, (text: string, _percent: number) => {
            onUpdate(text);
        });
    };

    return (
        <LLMContext.Provider value={{
            isOfflineMode,
            setOfflineMode,
            llmStatus,
            loadProgress,
            loadMessage,
            submitPrompt
        }}>
            {children}
        </LLMContext.Provider>
    );
};

export const useLLM = () => {
    const context = useContext(LLMContext);
    if (!context) {
        throw new Error('useLLM must be used within an LLMProvider');
    }
    return context;
};
