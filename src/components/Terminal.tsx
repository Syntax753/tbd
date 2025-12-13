import React, { useState, useEffect, useRef } from 'react';

interface TerminalProps {
    history: string[];
    time?: string;
    onCommand: (cmd: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ history, time, onCommand }) => {
    const [input, setInput] = useState('');
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyPtr, setHistoryPtr] = useState<number>(0);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    // Auto-focus logic...
    useEffect(() => {
        const handleGlobalClick = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            inputRef.current?.focus();
        };

        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        onCommand(input);

        // Update history
        const newHistory = [...cmdHistory, input];
        setCmdHistory(newHistory);
        setHistoryPtr(newHistory.length);

        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyPtr > 0) {
                const newPtr = historyPtr - 1;
                setHistoryPtr(newPtr);
                setInput(cmdHistory[newPtr]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyPtr < cmdHistory.length - 1) {
                const newPtr = historyPtr + 1;
                setHistoryPtr(newPtr);
                setInput(cmdHistory[newPtr]);
            } else {
                setHistoryPtr(cmdHistory.length);
                setInput('');
            }
        }
    };

    return (
        <div className="game-container">
            {/* CRT Monitor Area for Output Only */}
            <div className="crt-monitor">
                <div className="terminal-output">
                    {history.map((line, index) => (
                        <div key={index} className="terminal-line" style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                            {line}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>
            </div>

            {/* Control Bar: Input + Clock */}
            <div className="control-bar">
                <form onSubmit={handleSubmit} className="terminal-input-form">
                    <span className="prompt">{'>'}</span>
                    <input
                        ref={inputRef}
                        autoFocus
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="terminal-input"
                    />
                </form>
                {time && <div className="clock">{time}</div>}
            </div>
        </div>
    );
};
