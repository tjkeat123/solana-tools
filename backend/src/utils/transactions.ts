interface TransactionInfo {
  type: string;
  relatedAddresses?: {
    address: string;
    direction: 'sent' | 'received';
  };
  details: {
    source?: string;
    destination?: string;
    amount?: number | null;
  };
}

/**
 * Determines the type of transaction based on its instructions and accounts
 * @param {Object} transaction - The parsed transaction object from Solana
 * @param {string} sourceAddress - The address that was used to query transactions
 * @returns {Object} Transaction type information including type, related addresses, and details
 */
export function determineTransactionType(transaction: any, sourceAddress: string): TransactionInfo {
  // Default result structure
  const result: TransactionInfo = {
    type: 'unknown',
    details: {}
  };

  // If transaction is null or missing critical fields
  if (!transaction || !transaction.transaction || !transaction.transaction.message) {
    return result;
  }

  const message = transaction.transaction.message;
  const instructions = message.instructions;
  const hasTokenBalanceChanges = transaction.meta && 
    (transaction.meta.preTokenBalances?.length > 0 || transaction.meta.postTokenBalances?.length > 0);
  
  // Known DeFi/Swap program IDs
  const knownSwapPrograms = [
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter
    "SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8", // Raydium
    "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca
    "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Concentrated liquidity pool
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"  // Trading program
  ];

  const SYSTEM_PROGRAM = "11111111111111111111111111111111";
  const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  // Check for simple SOL transfer
  if (instructions.length === 1 || 
      (instructions.length <= 4 && (
        instructions.some((ix: any) => ix.programId?.toString() === "ComputeBudget111111111111111111111111111111") ||
        instructions.some((ix: any) => ix.programId?.toString() === SYSTEM_PROGRAM && ix.parsed?.type === "advanceNonce")
      ))) {
    // Find the actual transfer instruction (ignoring compute budget and nonce instructions)
    const transferIx = instructions.find((ix: any) => 
      ix.programId?.toString() === SYSTEM_PROGRAM && 
      ix.parsed?.type === "transfer");
    
    if (transferIx && !hasTokenBalanceChanges) {
      result.type = 'transfer';
      
      // Extract source and destination addresses
      const source = transferIx.parsed?.info?.source;
      const destination = transferIx.parsed?.info?.destination;
      const amount = transferIx.parsed?.info?.lamports;
      
      // Add details
      result.details = {
        source,
        destination,
        amount: amount ? amount / 1e9 : null // Convert lamports to SOL
      };
      
      // Add the counterparty address (the address that's not the source address)
      if (source && destination) {
        // Convert input address to string to ensure correct comparison
        const sourceAddressStr = sourceAddress.toString();
        
        if (source === sourceAddressStr) {
          result.relatedAddresses = {
            address: destination,
            direction: 'sent'
          };
        } else if (destination === sourceAddressStr) {
          result.relatedAddresses = {
            address: source,
            direction: 'received'
          };
        }
      }
      
      return result;
    }
  }

  // Check for token transfers
  if (instructions.some((ix: any) => 
      ix.programId?.toString() === TOKEN_PROGRAM && 
      (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked"))) {
    
    // If it also has swap program calls, it's probably a swap
    if (instructions.some((ix: any) => knownSwapPrograms.includes(ix.programId?.toString()))) {
      result.type = 'swap';
      return result;
    }
    
    result.type = 'token_transfer';
    return result;
  }

  // Check for swap transactions
  if (instructions.some((ix: any) => knownSwapPrograms.includes(ix.programId?.toString()))) {
    result.type = 'swap';
    return result;
  }

  // Check log messages for swap-related terms as fallback
  if (transaction.meta && transaction.meta.logMessages) {
    const logMessages = transaction.meta.logMessages.join(' ').toLowerCase();
    if (logMessages.includes('swap') || 
        logMessages.includes('exchange') || 
        logMessages.includes('trade') ||
        logMessages.includes('buy') || 
        logMessages.includes('sell')) {
      result.type = 'swap';
      return result;
    }
  }

  // Check inner instructions as well
  if (transaction.meta && transaction.meta.innerInstructions) {
    for (const inner of transaction.meta.innerInstructions) {
      if (inner.instructions.some((ix: any) => 
          (ix.programId?.toString() === TOKEN_PROGRAM && 
           (ix.program === "spl-token" && 
            (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked"))) ||
          knownSwapPrograms.includes(ix.programId?.toString()))) {
        result.type = 'swap';
        return result;
      }
    }
  }

  return result;
}