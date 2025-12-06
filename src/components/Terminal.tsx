import React, { useState, useEffect, useRef } from 'react';

interface TerminalProps {
    history: string[];
    onCommand: (cmd: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ history, onCommand }) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        onCommand(input);
        setInput('');
    };

    return (
        <div className="terminal-container">
            <div className="terminal-output">
                {history.map((line, index) => (
                    <div key={index} className="terminal-line" style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                        {line}
                    </div>
                ))}
                <div ref={endRef} />
            </div>
            <form onSubmit={handleSubmit} className="terminal-input-form">
                <span className="prompt">{'>'}</span>
                <input
                    autoFocus
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="terminal-input"
                />
            </form>
        </div>
    );
};
