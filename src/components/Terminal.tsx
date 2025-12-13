import React, { useState, useEffect, useRef } from 'react';

interface TerminalProps {
    history: string[];
    time?: string;
    onCommand: (cmd: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ history, time, onCommand }) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    // Auto-focus input on click anywhere, unless selecting text
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
        setInput('');
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
                        className="terminal-input"
                    />
                </form>
                {time && <div className="clock">{time}</div>}
            </div>
        </div>
    );
};
