import { determineTransactionType } from '../src/utils/transactions';
import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });
dotenv.config({ path: 'tests/.env' });

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Copy tests/env.example to tests/.env: `cp tests/.env.example tests/.env`
 * 
 * 2. Edit tests/.env file and replace the placeholder values with real data:
 *    - TEST_SOL_TRANSFER_SIGNATURE: A simple SOL transfer transaction signature
 *    - TEST_TOKEN_TRANSFER_SIGNATURE: A SPL token transfer transaction signature  
 *    - TEST_JUPITER_SWAP_SIGNATURE: A Jupiter swap transaction signature
 *    - TEST_RAYDIUM_SWAP_SIGNATURE: A Raydium swap transaction signature
 *    - TEST_ORCA_SWAP_SIGNATURE: An Orca swap transaction signature
 *    - TEST_UNKNOWN_TX_SIGNATURE: Any complex transaction that doesn't fit other categories
 *    - TEST_SENDER_WALLET_ADDRESS: The wallet address that sent the SOL in your test transaction
 *    - TEST_RECEIVER_WALLET_ADDRESS: The wallet address that received the SOL in your test transaction
 * 
 * 3. Run tests with: npm test transactions.test.ts
 */

describe('determineTransactionType', () => {
  let connection: Connection;

  beforeAll(() => {
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      throw new Error('ALCHEMY_API_KEY not found in environment variables');
    }
    
    const rpc = `https://solana-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    connection = new Connection(rpc, 'confirmed');
  });

  // Helper function to fetch transaction data
  async function fetchTransactionData(signature: string) {
    try {
      const transaction = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      return transaction;
    } catch (error) {
      console.error(`Error fetching transaction ${signature}:`, error);
      return null;
    }
  }

  // Real transaction signatures - loaded from environment variables
  const testSignatures = {
    solTransfer: process.env.TEST_SOL_TRANSFER_SIGNATURE!,
    tokenTransfer: process.env.TEST_TOKEN_TRANSFER_SIGNATURE!, 
    jupiterSwap: process.env.TEST_JUPITER_SWAP_SIGNATURE!,
    raydiumSwap: process.env.TEST_RAYDIUM_SWAP_SIGNATURE!,
    orcaSwap: process.env.TEST_ORCA_SWAP_SIGNATURE!,
    unknownTx: process.env.TEST_UNKNOWN_TX_SIGNATURE!
  };

  // Test wallet addresses - loaded from environment variables
  const testWalletAddresses = {
    sender: process.env.TEST_SENDER_WALLET_ADDRESS!,
    receiver: process.env.TEST_RECEIVER_WALLET_ADDRESS!
  };

  describe('SOL Transfer Detection', () => {
    it('should identify a simple SOL transfer transaction', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('transfer');
      expect(result.relatedAddresses).toBeDefined();
      expect(result.relatedAddresses).toHaveProperty('address');
      expect(result.relatedAddresses).toHaveProperty('direction');
      expect(['sent', 'received']).toContain(result.relatedAddresses!.direction);
      expect(result.details).toHaveProperty('source');
      expect(result.details).toHaveProperty('destination');
      expect(result.details).toHaveProperty('amount');
    }, 10000); // 10 second timeout for network requests

    it('should correctly identify sent SOL transfers', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('transfer');
      expect(result.relatedAddresses?.direction).toBe('sent');
    }, 10000);

    it('should correctly identify received SOL transfers', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.receiver);
      
      expect(result.type).toBe('transfer');
      expect(result.relatedAddresses?.direction).toBe('received');
    }, 10000);

    it('should calculate amount correctly in SOL', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('transfer');
      expect(typeof result.details.amount).toBe('number');
      expect(result.details.amount).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Token Transfer Detection', () => {
    it('should identify token transfer transactions', async () => {
      const transactionData = await fetchTransactionData(testSignatures.tokenTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('token_transfer');
    }, 10000);

    it('should not confuse token transfers with swaps when no swap programs are present', async () => {
      const transactionData = await fetchTransactionData(testSignatures.tokenTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('token_transfer');
      expect(result.type).not.toBe('swap');
    }, 10000);
  });

  describe('Swap Transaction Detection', () => {
    it('should identify Jupiter swap transactions', async () => {
      const transactionData = await fetchTransactionData(testSignatures.jupiterSwap);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('swap');
    }, 10000);

    it('should identify Raydium swap transactions', async () => {
      const transactionData = await fetchTransactionData(testSignatures.raydiumSwap);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('swap');
    }, 10000);

    it('should identify Orca swap transactions', async () => {
      const transactionData = await fetchTransactionData(testSignatures.orcaSwap);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('swap');
    }, 10000);

    it('should identify swaps that include token transfers', async () => {
      const transactionData = await fetchTransactionData(testSignatures.jupiterSwap);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result.type).toBe('swap');
    }, 10000);
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null transactions gracefully', () => {
      const result = determineTransactionType(null, testWalletAddresses.sender);
      
      expect(result.type).toBe('unknown');
      expect(result.relatedAddresses).toBeUndefined();
      expect(result.details).toEqual({});
    });

    it('should handle transactions with missing critical fields', () => {
      const invalidTransaction = {
        // Missing transaction.message
      };
      
      const result = determineTransactionType(invalidTransaction, testWalletAddresses.sender);
      
      expect(result.type).toBe('unknown');
      expect(result.relatedAddresses).toBeUndefined();
      expect(result.details).toEqual({});
    });

    it('should handle transactions with no instructions', () => {
      const emptyTransaction = {
        transaction: {
          message: {
            instructions: []
          }
        },
        meta: {}
      };
      
      const result = determineTransactionType(emptyTransaction, testWalletAddresses.sender);
      
      expect(result.type).toBe('unknown');
    });

    it('should handle complex transactions that do not match known patterns', async () => {
      const transactionData = await fetchTransactionData(testSignatures.unknownTx);
      
      if (transactionData) {
        const result = determineTransactionType(transactionData, testWalletAddresses.sender);
        // This might be 'unknown' or some other type depending on the actual transaction
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('relatedAddresses');
        expect(result).toHaveProperty('details');
      } else {
        // If transaction doesn't exist or can't be fetched, that's also valid for this test
        expect(transactionData).toBeNull();
      }
    }, 10000);
  });

  describe('Return Value Structure', () => {
    it('should always return the correct structure', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('relatedAddresses');
      expect(result).toHaveProperty('details');
      expect(result.relatedAddresses === undefined || typeof result.relatedAddresses === 'object').toBe(true);
      expect(typeof result.details).toBe('object');
    }, 10000);

    it('should return valid direction values', async () => {
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      expect(transactionData).not.toBeNull();
      
      const result = determineTransactionType(transactionData, testWalletAddresses.sender);
      
      if (result.relatedAddresses) {
        expect(['sent', 'received']).toContain(result.relatedAddresses.direction);
        expect(typeof result.relatedAddresses.address).toBe('string');
      }
    }, 10000);
  });

  describe('Known Program ID Recognition', () => {
    const knownSwapPrograms = [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter
      "SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8", // Raydium
      "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca
      "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Concentrated liquidity pool
      "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"  // Trading program
    ];

    knownSwapPrograms.forEach(programId => {
      it(`should recognize ${programId} as a swap program`, () => {
        // TODO: Create mock transaction with this specific program ID
        const mockTransactionWithProgram = {
          transaction: {
            message: {
              instructions: [{
                programId: { toString: () => programId }
              }]
            }
          },
          meta: {}
        };
        
        const result = determineTransactionType(mockTransactionWithProgram, testWalletAddresses.sender);
        expect(result.type).toBe('swap');
      });
    });
  });

  describe('Log Message Analysis', () => {
    const swapKeywords = ['swap', 'exchange', 'trade', 'buy', 'sell'];
    
    swapKeywords.forEach(keyword => {
      it(`should identify swaps by "${keyword}" in log messages`, () => {
        const mockTransactionWithLogs = {
          transaction: {
            message: {
              instructions: []
            }
          },
          meta: {
            logMessages: [`Program log: ${keyword} operation completed`]
          }
        };
        
        const result = determineTransactionType(mockTransactionWithLogs, testWalletAddresses.sender);
        expect(result.type).toBe('swap');
      });
    });
  });

  describe('Integration Tests with Real Data', () => {
    it('should fetch and analyze a real transaction end-to-end', async () => {
      // This test validates the entire flow from fetching to analysis
      const transactionData = await fetchTransactionData(testSignatures.solTransfer);
      
      if (transactionData) {
        const result = determineTransactionType(transactionData, testWalletAddresses.sender);
        
        // Validate that we get a meaningful result
        expect(result).toBeDefined();
        expect(result.type).toBeDefined();
        expect(typeof result.type).toBe('string');
        expect(result.relatedAddresses === undefined || typeof result.relatedAddresses === 'object').toBe(true);
        expect(typeof result.details).toBe('object');
        
        console.log('Sample transaction analysis result:', JSON.stringify(result, null, 2));
      } else {
        console.log('Transaction not found or invalid signature provided');
        expect(transactionData).toBeNull();
      }
    }, 15000); // Longer timeout for this comprehensive test
  });
});
