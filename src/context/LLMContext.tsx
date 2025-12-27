import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { connect, generate, setSystemMessage } from '../llm/llmUtil';

interface LLMContextType {
    isOfflineMode: boolean;
    setOfflineMode: (offline: boolean) => void;
    llmStatus: 'idle' | 'initializing' | 'ready' | 'generating' | 'error';
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
    const [llmStatus, setLlmStatus] = useState<'idle' | 'initializing' | 'ready' | 'generating' | 'error'>('idle');
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadMessage, setLoadMessage] = useState('');

    // Mutex for serialization
    const executionQueue = React.useRef<Promise<void>>(Promise.resolve());
    const initPromise = React.useRef<Promise<void> | null>(null);

    useEffect(() => {
        if (isOfflineMode && llmStatus === 'idle') {
            initializeLLM();
        }
    }, [isOfflineMode, llmStatus]);

    const initializeLLM = async (): Promise<void> => {
        if (initPromise.current) return initPromise.current;

        initPromise.current = (async () => {
            try {
                setLlmStatus('initializing');
                setLoadMessage('Initializing Local LLM...');
                await connect(MODEL_ID, (status: string, progress: number) => {
                    setLoadMessage(status);
                    setLoadProgress(Math.floor(progress * 100));
                });
                setLlmStatus('ready');
                setLoadMessage('Local LLM Ready');
            } catch (error) {
                console.error("Failed to initialize LLM:", error);
                setLlmStatus('error');
                setLoadMessage('Failed to load Local LLM');
                initPromise.current = null; // Allow retry
                throw error;
            }
        })();

        return initPromise.current;
    };

    const submitPrompt = (systemPrompt: string, userPrompt: string, onUpdate: (response: string) => void): Promise<string> => {
        if (!isOfflineMode) {
            return Promise.reject(new Error("Cannot use local submitPrompt in online mode"));
        }

        // Chain execution to ensure serial processing
        const resultPromise = executionQueue.current.then(async () => {
            // Ensure initialized
            if (llmStatus === 'idle' || llmStatus === 'initializing' || llmStatus === 'error') {
                // If error, try again. If executing, wait.
                await initializeLLM();
            }

            // At this point we should be ready, unless init failed
            // Note: We check 'generating' here implicitly because the queue serializes us. 
            // If the previous task finished, status should be 'ready'.

            try {
                setLlmStatus('generating');
                setSystemMessage(systemPrompt);

                const response = await generate(userPrompt, (text: string, _percent: number) => {
                    onUpdate(text);
                });

                setLlmStatus('ready');
                return response;
            } catch (error) {
                setLlmStatus('ready'); // Revert to ready on error (unless fatal?)
                console.error("Error during generation:", error);
                throw error;
            }
        });

        // Append to queue (and catch errors to avoid breaking the chain for subsequent requests)
        executionQueue.current = resultPromise.catch(() => { });

        return resultPromise;
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
