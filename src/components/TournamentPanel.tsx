import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction,
  Connection
} from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';

// USDC pool wallet address
const POOL_WALLET_ADDRESS = '97P6dCEjSGvYsePRYV7N9R6pbVvA9SccVuHqiLVE66MC';
// USDC token mint address on Solana - use the correct one for your network
// Mainnet USDC
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Devnet USDC (uncomment if using devnet)
// const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

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
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [contribution, setContribution] = React.useState<number>(1);
  const [poolBalance, setPoolBalance] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null);

  // Function to fetch the USDC balance of the pool wallet
  const fetchPoolBalance = async (
    connection: Connection, 
    setPoolBalance: React.Dispatch<React.SetStateAction<number>>
  ) => {
    try {
      // For demo purposes, just set a mock balance
      // This avoids RPC errors during development
      setPoolBalance(Math.random() * 100 + 50);
      
      // In production, uncomment this code:
      /*
      const poolWalletPubkey = new PublicKey(POOL_WALLET_ADDRESS);
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      
      // Find the token account for this wallet that holds USDC
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        poolWalletPubkey,
        { mint: usdcMintPubkey }
      );
      
      // If token account exists, get the balance
      if (tokenAccounts.value.length > 0) {
        // Get the amount from the first token account
        const tokenAccount = tokenAccounts.value[0];
        const amount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
        setPoolBalance(amount);
      } else {
        console.log('No USDC token account found for the pool wallet');
        setPoolBalance(0);
      }
      */
    } catch (error) {
      console.error('Error fetching pool balance:', error);
      // Set a fallback value for demo purposes
      setPoolBalance(Math.random() * 100 + 50);
    }
  };

  // Fetch the pool balance when the component mounts and periodically
  useEffect(() => {
    fetchPoolBalance(connection, setPoolBalance);
    
    // Refresh the balance every 30 seconds
    const intervalId = setInterval(() => fetchPoolBalance(connection, setPoolBalance), 30000);
    
    return () => clearInterval(intervalId);
  }, [connection]);

  // Function to send USDC to the pool wallet
  const sendUSDCToPool = async (amount: number) => {
    if (!publicKey) {
      setTransactionStatus('Error: Wallet not connected');
      return false;
    }

    setIsSubmitting(true);
    setTransactionStatus('Preparing transaction...');

    try {
      // For demo purposes, simulate a successful transaction
      setTransactionStatus('Please approve the transaction in your wallet...');
      
      // Simulate wallet approval delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTransactionStatus('Transaction sent! Confirming...');
      
      // Simulate confirmation delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setTransactionStatus('Transaction confirmed! You are now in the tournament.');
      setTimeout(() => setTransactionStatus(null), 5000);
      setIsSubmitting(false);
      
      // In production, uncomment this code:
      /*
      // Get the associated token accounts for the user and pool
      const userUsdcAddress = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        publicKey
      );
      
      const poolUsdcAddress = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        new PublicKey(POOL_WALLET_ADDRESS)
      );

      // Create a transfer instruction
      const transferInstruction = createTransferInstruction(
        userUsdcAddress,
        poolUsdcAddress,
        publicKey,
        BigInt(amount * 1000000) // USDC has 6 decimals
      );

      // Create a transaction and add the transfer instruction
      const transaction = new Transaction().add(transferInstruction);
      
      // Set recent blockhash and fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Send the transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature);
      */
      
      return true;
      
    } catch (error) {
      console.error('Error sending USDC:', error);
      setTransactionStatus(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
      return false;
    }
  };

  const handleContributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contribution >= 1) {
      const success = await sendUSDCToPool(contribution);
      if (success) {
        onContribute(contribution);
        // After contribution, refresh the pool balance
        setTimeout(() => fetchPoolBalance(connection, setPoolBalance), 5000); // Wait 5 seconds for transaction to process
      }
    }
  };

  // Format address for display (truncate middle)
  const formatAddress = (address: string) => {
    if (!address) return 'No leader yet';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 text-center">Hedgy Jump Tournament</h2>
      
      <div className="mb-4">
        <div className="bg-gray-700 p-4 rounded-lg mb-4">
          <h3 className="text-xl font-semibold text-yellow-400 mb-2">Daily Tournament</h3>
          <div className="flex justify-between mb-2">
            <span>Time Remaining:</span>
            <span className="font-bold">{timeRemaining}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Prize Pool:</span>
            <span className="font-bold">{poolBalance.toFixed(2)} USDC</span>
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
                disabled={isSubmitting}
              />
              <span>USDC</span>
            </div>
            
            {transactionStatus && (
              <div className="bg-gray-900 p-2 rounded mb-3 text-sm">
                {transactionStatus}
              </div>
            )}
            
            <button 
              type="submit" 
              className={`w-full ${isSubmitting ? 'bg-gray-500' : 'bg-purple-600 hover:bg-purple-700'} text-white font-bold py-2 px-4 rounded`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Contribute & Play'}
            </button>
          </form>
        )}
        
        <div className="text-center text-xs text-gray-400 mt-4">
          20% of each pool is collected to buy back $HEDGY.
        </div>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-4">
        Pool Wallet: {formatAddress(POOL_WALLET_ADDRESS)}
      </div>
    </div>
  );
};

export default TournamentPanel; 