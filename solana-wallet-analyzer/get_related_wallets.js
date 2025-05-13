import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Use environment variable
const apiKey = process.env.ALCHEMY_API_KEY;

// Helper function to sleep/delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determines the type of transaction based on its instructions and accounts
 * @param {Object} transaction - The parsed transaction object from Solana
 * @param {string} sourceAddress - The address that was used to query transactions
 * @returns {Object} Transaction type information including type, related addresses, and details
 */
function determineTransactionType(transaction, sourceAddress) {
  // Default result structure
  const result = {
    type: 'unknown',
    relatedAddresses: [],
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
        instructions.some(ix => ix.programId?.toString() === "ComputeBudget111111111111111111111111111111") ||
        instructions.some(ix => ix.programId?.toString() === SYSTEM_PROGRAM && ix.parsed?.type === "advanceNonce")
      ))) {
    // Find the actual transfer instruction (ignoring compute budget and nonce instructions)
    const transferIx = instructions.find(ix => 
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
          result.relatedAddresses.push({
            address: destination,
            direction: 'sent'
          });
        } else if (destination === sourceAddressStr) {
          result.relatedAddresses.push({
            address: source,
            direction: 'received'
          });
        }
      }
      
      return result;
    }
  }

  // Check for token transfers
  if (instructions.some(ix => 
      ix.programId?.toString() === TOKEN_PROGRAM && 
      (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked"))) {
    
    // If it also has swap program calls, it's probably a swap
    if (instructions.some(ix => knownSwapPrograms.includes(ix.programId?.toString()))) {
      result.type = 'swap';
      return result;
    }
    
    result.type = 'token_transfer';
    return result;
  }

  // Check for swap transactions
  if (instructions.some(ix => knownSwapPrograms.includes(ix.programId?.toString()))) {
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
      if (inner.instructions.some(ix => 
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

/**
 * Writes transaction data to a log file
 * @param {string} filePath - Path to the log file
 * @param {Array} transactions - Array of original parsed transactions
 * @param {PublicKey} sourceAddress - The address used to query transactions
 */
function writeTransactionsToFile(filePath, transactions, sourceAddress) {
  const logData = {
    wallet: sourceAddress.toString(),
    timestamp: new Date().toISOString(),
    transactionCount: transactions.length,
    transactions: transactions
  };
  
  fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
  console.log(`\nTransaction data written to: ${filePath}`);
}

async function main() {
    // Check for command-line arguments
    const args = process.argv.slice(2);
    let walletAddress = null;
    let limit = 10; // Default limit
    let shouldLog = false; // Default to not logging

    // Parse command-line arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--log") {
            shouldLog = true;
        } else if (!walletAddress) {
            // First non-flag argument is assumed to be the wallet address
            walletAddress = args[i];
        } else if (!isNaN(parseInt(args[i]))) {
            // If we already have a wallet address and this arg is a number, it's the limit
            limit = parseInt(args[i]);
        }
    }

    // Check if the user has provided a wallet address
    if(!walletAddress) {
        console.log("Usage: node get_related_wallets.js <wallet_address> [transaction_limit] [--log]");
        console.log("  wallet_address: Solana wallet address to analyze");
        console.log("  transaction_limit: (Optional) Number of transactions to fetch (default: 10, max: 1000)");
        console.log("  --log: (Optional) Write transaction data to a log file");
        process.exit(1);
    }

    // Check if the limit is a valid number
    if (isNaN(limit) || limit <= 0) {
        console.error("Error: Transaction limit must be a positive number");
        process.exit(1);
    }

    // Cap the limit to 1000
    const providedLimit = limit;
    limit = Math.min(providedLimit, 1000);
    
    // Notify if limit was capped
    if (providedLimit > 1000) {
        console.log(`Notice: Transaction limit capped to 1000 (you requested ${providedLimit})`);
    }

    // Establish a connection to the mainnet using Alchemy
    const rpc = `https://solana-mainnet.g.alchemy.com/v2/${apiKey}`;
    const connection = new Connection(rpc, "confirmed");

    // Parse the wallet address
    let address;
    try {
        address = new PublicKey(walletAddress);
    } catch (error) {
        console.error("Invalid wallet address:", error.message);
        process.exit(1);
    }

    // Prepare a set to collect related addresses
    // Use a Map to track addresses and their transaction directions
    const relatedAddressMap = new Map(); // address -> {sent: count, received: count}
    const parsedTransactions = shouldLog ? [] : null; // Only collect transactions if logging
    
    console.log(`\nAnalyzing transactions for address: ${address.toString()}`);
    console.log(`Transaction limit: ${limit}`);
    if (shouldLog) {
        console.log("Logging: Enabled");
    }
    console.log("==================================================");

    // Attempt to fetch signatures with requested limit
    let signatures;
    try {
        signatures = await connection.getSignaturesForAddress(address, { limit });
        console.log(`Found ${signatures.length} transactions\n`);
    } catch (error) {
        console.error("Error fetching transaction signatures:", error.message);
        process.exit(1);
    }
    
    if (signatures.length === 0) {
        console.log("No transactions found for this address.");
        process.exit(0);
    }
    
    for (let i = 0; i < signatures.length; i++) {
        const signature = signatures[i].signature;
        let transaction;
        
        try {
            transaction = await connection.getParsedTransaction(signature, {maxSupportedTransactionVersion: 0});
        } catch (error) {
            console.log(`Error fetching transaction ${i+1} (${signature}): ${error.message}`);
            continue;
        }
        
        // Skip null transactions
        if (!transaction) {
            console.log(`Transaction ${i+1} of ${signatures.length} (${signature}): Not found or failed to parse`);
            continue;
        }
        
        // Store the original parsed transaction if logging is enabled
        if (shouldLog) {
            parsedTransactions.push(transaction);
        }
        
        // Determine the transaction type and get related addresses
        const txInfo = determineTransactionType(transaction, address);
        
        // Add any found related addresses to our map with direction info
        txInfo.relatedAddresses.forEach(addrInfo => {
            const addrData = relatedAddressMap.get(addrInfo.address) || { sent: 0, received: 0 };
            
            if (addrInfo.direction === 'sent') {
                addrData.sent++;
            } else if (addrInfo.direction === 'received') {
                addrData.received++;
            }
            
            relatedAddressMap.set(addrInfo.address, addrData);
        });
        
        // Log info about this transaction
        let logMsg = `Transaction ${i+1}: ${txInfo.type} (${signature})`;
        if (txInfo.relatedAddresses.length > 0) {
            logMsg += `\n  Related addresses: ${txInfo.relatedAddresses.map(a => `${a.address} (${a.direction})`).join(', ')}`;
        }
        if (txInfo.type === 'transfer' && txInfo.details.amount) {
            logMsg += `\n  Amount: ${txInfo.details.amount} SOL`;
            if (txInfo.details.source === address.toString()) {
                logMsg += ` (Sent)`;
            } else {
                logMsg += ` (Received)`;
            }
        }
        console.log(logMsg);
        console.log("--------------------------------------------------");
        
        // Sleep for 100ms to avoid rate limiting, but don't sleep after the last request
        if (i < signatures.length - 1) {
            await sleep(100);
        }
    }
    
    // Write transactions to file if logging is enabled
    if (shouldLog && parsedTransactions.length > 0) {
        const logFileName = `tx_logs_${address.toString().substring(0, 8)}_${new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')}.json`;
        writeTransactionsToFile(logFileName, parsedTransactions, address);
    }
    
    // Output all unique related addresses found with direction info
    if (relatedAddressMap.size > 0) {
        console.log('\nSummary of related addresses:');
        console.log("==================================================");
        for (const [addr, counts] of relatedAddressMap.entries()) {
            const directionInfo = [];
            if (counts.sent > 0) directionInfo.push(`Sent: ${counts.sent}`);
            if (counts.received > 0) directionInfo.push(`Received: ${counts.received}`);
            console.log(`- ${addr} (${directionInfo.join(', ')})`);
        }
    } else {
        console.log('\nNo related addresses found in these transactions.');
    }
}

main().catch(console.error);