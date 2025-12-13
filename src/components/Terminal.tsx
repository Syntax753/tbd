import React, { useState, useEffect, useRef } from 'react';

interface Exit {
    shortDir: string;
    targetName: string;
}

interface TerminalProps {
    history: string[];
    time?: string;
    roomName?: string;
    exits?: Exit[];
    onCommand: (cmd: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ history, time, roomName, exits, onCommand }) => {
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

    // Parse [[#HEX:text]] markup into colored spans
    const renderLine = (line: string) => {
        const parts: React.ReactNode[] = [];
        const regex = /\[\[(#[A-Fa-f0-9]{6}):([^\]]+)\]\]/g;
        let lastIndex = 0;
        let match;
        let keyCounter = 0;

        while ((match = regex.exec(line)) !== null) {
            // Add text before match
            if (match.index > lastIndex) {
                parts.push(line.slice(lastIndex, match.index));
            }
            // Add colored span
            parts.push(
                <span key={keyCounter++} style={{ color: match[1], fontWeight: 'bold' }}>
                    {match[2]}
                </span>
            );
            lastIndex = regex.lastIndex;
        }
        // Add remaining text
        if (lastIndex < line.length) {
            parts.push(line.slice(lastIndex));
        }
        return parts.length > 0 ? parts : line;
    };

    return (
        <div className="game-container">
            {/* Room Name Banner - Above CRT */}
            {roomName && (
                <div className="room-name-banner">
                    {roomName}
                </div>
            )}

            {/* CRT Monitor Area for Output Only */}
            <div className="crt-monitor">
                <div className="terminal-output">
                    {history.map((line, index) => (
                        <div key={index} className="terminal-line" style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                            {renderLine(line)}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                {/* Exits Footer */}
                {exits && exits.length > 0 && (
                    <div className="exits-footer">
                        {exits.map((e, i) => (
                            <span key={i} className="exit-item">
                                [{e.shortDir}] {e.targetName}{i < exits.length - 1 ? '  ' : ''}
                            </span>
                        ))}
                    </div>
                )}
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
