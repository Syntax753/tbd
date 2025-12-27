import React from 'react';

type Props = {
    percentComplete: number; // 0.0 to 1.0
    text: string;
}

export const ProgressBar: React.FC<Props> = ({ percentComplete, text }) => {
    // Clamp between 0 and 1
    const clamped = Math.min(Math.max(percentComplete, 0), 1);

    if (clamped <= 0 && !text) return null;

    return (
        <div style={{
            width: '100%',
            border: '2px solid #333',
            background: '#0a0a0a',
            color: '#0f0',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            position: 'relative',
            height: '24px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                width: `${clamped * 100}%`,
                backgroundColor: '#004400', // Darker green background for bar
                height: '100%',
                transition: 'width 0.2s ease-in-out',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1
            }}>
                {/* Striped pattern overlay could go here if we had the image */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'linear-gradient(45deg,rgba(0,255,0,.15) 25%,transparent 25%,transparent 50%,rgba(0,255,0,.15) 50%,rgba(0,255,0,.15) 75%,transparent 75%,transparent)',
                    backgroundSize: '20px 20px'
                }}></div>
            </div>

            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                textShadow: '0 0 2px #000'
            }}>
                {text} {clamped > 0 ? `(${(clamped * 100).toFixed(0)}%)` : ''}
            </div>
        </div>
    );
};
