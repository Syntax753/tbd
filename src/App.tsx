import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { GameEngine } from './engine/GameEngine';
import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';
import { MapView } from './components/MapView';
import { roomGraph } from './engine/RoomGraph';

function App() {
  const [engine] = useState(() => new GameEngine());
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setIsLoadingMessage] = useState("Initializing...");
  const [history, setHistory] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);

  // To verify if initialization has run
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initGame = async () => {
      // Pass callback to update loading message
      await engine.initialize((msg) => setIsLoadingMessage(msg));

      // Initialize room graph for pathfinding
      roomGraph.initialize(engine.getState().map);

      setHistory(engine.getHistory());
      setIsLoading(false);
    };

    initGame();
  }, [engine]);

  const handleCommand = async (cmd: string) => {
    // Check for map command to toggle graphical map
    if (cmd.toLowerCase() === 'map' || cmd.toLowerCase() === 'location') {
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

  if (isLoading) {
    return <LoadingScreen message={loadingMessage} />;
  }

  const gameState = engine.getState();
  const currentRoom = gameState.map[gameState.currentRoomId];
  const exits = roomGraph.getExits(gameState.currentRoomId);

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
          onClose={() => setShowMap(false)}
        />
      )}
    </>
  );
}

export default App;
