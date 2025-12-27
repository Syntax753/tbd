import { useState, useRef } from 'react';
import './App.css';
import { GameEngine } from './engine/GameEngine';
import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { ProgressBar } from './components/ProgressBar';
import { MapView } from './components/MapView';
import { ConfigScreen } from './components/ConfigScreen';
import type { GameConfig } from './components/ConfigScreen';
import { grafitti } from './engine/RoomGraph';
import { useLLM } from './context/LLMContext';

function App() {
  const [engine] = useState(() => new GameEngine());
  const [showConfig, setShowConfig] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setIsLoadingMessage] = useState("Initializing...");
  const [history, setHistory] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);

  // LLM Context
  const { isOfflineMode, setOfflineMode, llmStatus, loadProgress, loadMessage } = useLLM();

  // To verify if initialization has run
  const initialized = useRef(false);

  const handleConfigSubmit = async (config: GameConfig) => {
    if (initialized.current) return;
    initialized.current = true;

    // Set offline mode in context
    if (config.modelMode === 'offline') {
      setOfflineMode(true);
    }

    setShowConfig(false);
    setIsLoading(true);

    // Pass callback to update loading message and config
    await engine.initialize((msg) => setIsLoadingMessage(msg), {
      storySetting: config.storySetting,
      characterTypes: config.characterTypes,
      suspectCount: config.suspectCount,
      deceasedName: config.deceasedName,
      // Pass the extended config with modelMode
      // @ts-ignore - The engine will be updated to accept this custom prop
      modelMode: config.modelMode
    });

    // Initialize room graph for pathfinding
    grafitti.initialize(engine.getState().map);

    setHistory(engine.getHistory());
    setIsLoading(false);
  };

  const handleCommand = async (cmd: string) => {
    // Check for map command to toggle graphical map
    const lowerCmd = cmd.toLowerCase();
    if (lowerCmd === 'map' || lowerCmd === 'location' || lowerCmd === 'm') {
      setShowMap(true);
      return;
    }

    // Optimistic update
    const newHistory = [...engine.getHistory(), `> ${cmd}`];
    setHistory(newHistory);

    // Process
    await engine.parseCommand(cmd);

    // Update from engine state (single source of truth)
    setHistory([...engine.getHistory()]);
  };

  if (showConfig) {
    return <ConfigScreen onStart={handleConfigSubmit} />;
  }

  // Combine engine loading message with LLM loading status
  const currentMessage = (isOfflineMode && llmStatus === 'initializing')
    ? `${loadingMessage} | ${loadMessage} (${loadProgress}%)`
    : loadingMessage;

  if (isLoading) {
    return <LoadingScreen
      message={currentMessage}
      progress={isOfflineMode && llmStatus === 'initializing' ? loadProgress / 100 : undefined}
    />;
  }

  const gameState = engine.getState();
  const currentRoom = gameState.map[gameState.currentRoomId];
  const exits = grafitti.getExits(gameState.currentRoomId);

  return (
    <>
      <Terminal
        history={history}
        time={gameState.time}
        roomName={currentRoom?.name}
        exits={exits}
        onCommand={handleCommand}
      />
      {showMap && (
        <MapView
          rooms={gameState.map}
          currentRoomId={gameState.currentRoomId}
          characterPositions={
            Object.fromEntries(
              Object.values(gameState.characters || {}).map(c => [c.id, c.currentRoomId || 'foyer'])
            )
          }
          characterNames={
            Object.fromEntries(
              Object.values(gameState.characters || {}).map(c => [c.id, c.name])
            )
          }
          onClose={() => setShowMap(false)}
          onMove={(dir) => handleCommand(dir)}
        />
      )}

      {/* Persistent Progress Bar for LLM Loading */}
      {isOfflineMode && llmStatus === 'initializing' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 9999,
          padding: '10px',
          backgroundColor: '#000'
        }}>
          <ProgressBar percentComplete={loadProgress / 100} text={loadMessage} />
        </div>
      )}
    </>
  );
}

export default App;
