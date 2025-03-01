import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletContextProvider } from './context/WalletContext';
import DoodleJumpGame from './components/DoodleJumpGame';
import TournamentPanel from './components/TournamentPanel';

// Mock data for testing
const mockLeaderAddress = "8ZLKSRQrDDyHybaGGqrXUeWzotPg1kLxXb3y5Y38ruUT";

function Tournament() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [highestScore, setHighestScore] = useState(3450);
  const [leaderAddress, setLeaderAddress] = useState(mockLeaderAddress);
  const [players, setPlayers] = useState(42);
  const [prizePool, setPrizePool] = useState(146);
  const [timeRemaining, setTimeRemaining] = useState("23:45:12");
  
  // Update the score when the game reports a new score
  const handleScoreUpdate = (score: number) => {
    setCurrentScore(score);
    if (score > highScore) {
      setHighScore(score);
      // In a real app, we'd send this to our blockchain or backend
      if (score > highestScore) {
        setHighestScore(score);
        if (publicKey) {
          setLeaderAddress(publicKey.toString());
        }
      }
    }
  };
  
  // Handle contribution to the tournament
  const handleContribute = async (amount: number) => {
    // In a real app, this would interact with a Solana program
    console.log(`Contributing ${amount} USDC to the tournament`);
    
    // Mock update the prize pool and player count
    setPrizePool(prev => prev + amount);
    setPlayers(prev => prev + 1);
  };
  
  // Update countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      // Mock countdown logic
      const [hours, minutes, seconds] = timeRemaining.split(':').map(Number);
      let newSeconds = seconds - 1;
      let newMinutes = minutes;
      let newHours = hours;
      
      if (newSeconds < 0) {
        newSeconds = 59;
        newMinutes -= 1;
      }
      
      if (newMinutes < 0) {
        newMinutes = 59;
        newHours -= 1;
      }
      
      if (newHours < 0) {
        // Reset the tournament
        setTimeRemaining("24:00:00");
        return;
      }
      
      setTimeRemaining(
        `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining]);
  
  return (
    <div className="flex min-h-screen bg-gray-900 text-white p-4 font-sans">
      <div className="flex w-full max-w-7xl mx-auto gap-6">
        {/* Game Column */}
        <div className="w-2/3 bg-gray-800 rounded-lg overflow-hidden">
          <DoodleJumpGame onScoreUpdate={handleScoreUpdate} />
        </div>
        
        {/* Tournament Info Column */}
        <div className="w-1/3">
          <TournamentPanel
            currentHighScore={highScore}
            highestScore={highestScore}
            leaderAddress={leaderAddress}
            players={players}
            prizePool={prizePool}
            timeRemaining={timeRemaining}
            onContribute={handleContribute}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <WalletContextProvider>
      <Tournament />
    </WalletContextProvider>
  );
}

export default App; 