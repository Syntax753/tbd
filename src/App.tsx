import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { GameEngine } from './engine/GameEngine';
import { Terminal } from './components/Terminal';
import { LoadingScreen } from './components/LoadingScreen';

function App() {
  const [engine] = useState(() => new GameEngine());
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  // To verify if initialization has run
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initGame = async () => {
      // Simulate min wait time for cinematic effect
      const minWait = new Promise(res => setTimeout(res, 4000));

      await Promise.all([engine.initialize(), minWait]);

      setHistory(engine.getHistory());
      setIsLoading(false);
    };

    initGame();
  }, [engine]);

  const handleCommand = async (cmd: string) => {
    // Optimistic update
    const newHistory = [...engine.getHistory(), `> ${cmd}`];
    setHistory(newHistory);

    // Process
    await engine.parseCommand(cmd);

    // Update from engine state (single source of truth)
    setHistory([...engine.getHistory()]);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Terminal
      history={history}
      onCommand={handleCommand}
    />
  );
}

export default App;
