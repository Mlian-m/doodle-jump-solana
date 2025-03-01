import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

interface TournamentPanelProps {
  currentHighScore: number;
  highestScore: number;
  leaderAddress: string;
  players: number;
  prizePool: number;
  timeRemaining: string;
  onContribute: (amount: number) => void;
}

const TournamentPanel: React.FC<TournamentPanelProps> = ({
  currentHighScore,
  highestScore,
  leaderAddress,
  players,
  prizePool,
  timeRemaining,
  onContribute
}) => {
  const { connected } = useWallet();
  const [contribution, setContribution] = React.useState<number>(1);

  const handleContributeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contribution >= 1) {
      onContribute(contribution);
    }
  };

  // Format address for display (truncate middle)
  const formatAddress = (address: string) => {
    if (!address) return 'No leader yet';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-center">Doodle Jump Tournament</h2>
      
      <div className="mb-4">
        <div className="bg-gray-700 p-4 rounded-lg mb-4">
          <h3 className="text-xl font-semibold text-yellow-400 mb-2">Daily Tournament</h3>
          <div className="flex justify-between mb-2">
            <span>Time Remaining:</span>
            <span className="font-bold">{timeRemaining}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Prize Pool:</span>
            <span className="font-bold">{prizePool} USDC</span>
          </div>
          <div className="flex justify-between">
            <span>Total Players:</span>
            <span className="font-bold">{players}</span>
          </div>
        </div>
        
        <div className="bg-gray-700 p-4 rounded-lg mb-4">
          <h3 className="text-xl font-semibold text-green-400 mb-2">Current Standings</h3>
          <div className="flex justify-between mb-2">
            <span>Highest Score:</span>
            <span className="font-bold">{highestScore}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Current Leader:</span>
            <span className="font-bold text-yellow-300">{formatAddress(leaderAddress)}</span>
          </div>
          <div className="flex justify-between">
            <span>Your Best Score:</span>
            <span className="font-bold">{currentHighScore}</span>
          </div>
        </div>
      </div>
      
      <div className="mt-auto">
        {!connected ? (
          <div className="text-center mb-4">
            <p className="mb-2">Connect your wallet to join the tournament</p>
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>
        ) : (
          <form onSubmit={handleContributeSubmit} className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl font-semibold text-purple-400 mb-2">Join Tournament</h3>
            <p className="text-sm mb-2">Minimum contribution: 1 USDC</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min="1"
                step="1"
                value={contribution}
                onChange={(e) => setContribution(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white w-full"
              />
              <span>USDC</span>
            </div>
            <button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Contribute & Play
            </button>
          </form>
        )}
        
        <div className="text-center text-xs text-gray-400 mt-4">
          5% of each pool is collected as platform fee
        </div>
      </div>
    </div>
  );
};

export default TournamentPanel; 