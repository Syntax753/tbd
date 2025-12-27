import React, { useState } from 'react';

export interface GameConfig {
    storySetting: string;
    characterTypes: string;
    suspectCount: string;
    deceasedName: string;
}

interface ConfigScreenProps {
    onStart: (config: GameConfig) => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ onStart }) => {
    const [config, setConfig] = useState<GameConfig>({
        storySetting: 'Beach',
        characterTypes: 'Lord of the Rings',
        suspectCount: '5',
        deceasedName: 'Archibald'
    });

    const handleChange = (field: keyof GameConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleStart = () => {
        onStart(config);
    };

    return (
        <div className="config-container">
            <h1>TBD MURDER</h1>
            <div className="config-subtitle">SYSTEM CONFIGURATION</div>

            <div className="config-form">
                <div className="config-field">
                    <label className="config-label">&gt; STORY SETTING:</label>
                    <input
                        type="text"
                        className="config-input"
                        placeholder="e.g., Victorian mansion, space station, medieval castle..."
                        value={config.storySetting}
                        onChange={handleChange('storySetting')}
                    />
                </div>

                <div className="config-field">
                    <label className="config-label">&gt; CHARACTER TYPES:</label>
                    <input
                        type="text"
                        className="config-input"
                        placeholder="e.g., aristocrats, elves, robots, pirates..."
                        value={config.characterTypes}
                        onChange={handleChange('characterTypes')}
                    />
                </div>

                <div className="config-field">
                    <label className="config-label">&gt; NUMBER OF SUSPECTS:</label>
                    <input
                        type="text"
                        className="config-input"
                        placeholder="5"
                        value={config.suspectCount}
                        onChange={handleChange('suspectCount')}
                    />
                </div>

                <div className="config-field">
                    <label className="config-label">&gt; NAME OF THE DECEASED:</label>
                    <input
                        type="text"
                        className="config-input"
                        placeholder="Archibald"
                        value={config.deceasedName}
                        onChange={handleChange('deceasedName')}
                    />
                </div>
            </div>

            <button className="config-start-btn" onClick={handleStart}>
                [ BEGIN MYSTERY ]
            </button>

            <div className="config-hint">Press ENTER or click to start...</div>
        </div>
    );
};
