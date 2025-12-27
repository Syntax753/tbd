import { ProgressBar } from './ProgressBar';

interface LoadingScreenProps {
    message?: string;
    progress?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Loading...", progress }) => {
    return (
        <div className="loading-container">
            <h1>TBD MURDER</h1>
            <div className="loading-steps">
                <p className="loading-message">{message}</p>
                {progress !== undefined && (
                    <div style={{ marginTop: '20px', width: '100%', maxWidth: '400px' }}>
                        <ProgressBar percentComplete={progress} text={""} />
                    </div>
                )}
            </div>
            {!progress && <div className="spinner"></div>}
        </div>
    );
};
