import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import dotenv from "dotenv";
import { determineTransactionType } from "../utils/transactions.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

dotenv.config( { path: "../.env" });

// Helper function to ensure wallet exists in database
async function ensureWalletExists(address: string, isMainWallet: boolean = false) {
  await prisma.wallet.upsert({
    where: { address },
    update: { 
      lastUpdatedAt: new Date(),
      ...(isMainWallet && { lastAnalyzedAt: new Date() })
    },
    create: { 
      address,
      ...(isMainWallet && { lastAnalyzedAt: new Date() }),
      firstFoundAt: new Date(),
      lastUpdatedAt: new Date()
    }
  });
}

const alchemyApiKey = process.env.ALCHEMY_API_KEY;

// Create a shared connection instance
function getConnection(): Connection {
  const rpc = `https://solana-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
  return new Connection(rpc, "confirmed");
}

export async function getAllWalletTransactions(walletAddress: string) {
  const connection = getConnection();

  // check if the wallet address is valid
  let address: PublicKey;
  try {
    address = new PublicKey(walletAddress);
  } catch (error) {
    throw new Error("Invalid wallet address");
  }

  // Ensure the main wallet being analyzed exists in the database
  await ensureWalletExists(walletAddress, true);

  // Check if we have previous analysis for this wallet
  const existingAnalysis = await prisma.walletAnalysisCache.findFirst({
    where: { walletAddress: walletAddress },
    orderBy: { analyzedAt: 'desc' }
  });

  // get the transactions for the wallet address
  try {
    const signatures = await connection.getSignaturesForAddress(address);

    if (signatures.length === 0) {
        throw new Error("No transactions found");
    }

    // get detailed transaction information for each signature with rate limiting
    let processedCount = 0;
    for (let i = 0; i < signatures.length; i++) {
        const currentSignature = signatures[i].signature;
        
        // If we've seen this signature before in our cache, break the loop
        if (existingAnalysis && currentSignature === existingAnalysis.lastSignature) {
            console.log(`Found previously processed transaction at position ${i + 1}. Stopping analysis.`);
            break;
        }
        
        await _getTransactionDetail(connection, currentSignature, walletAddress);
        processedCount++;
        
        // Add delay to avoid rate limiting (except for last request)
        if (i < signatures.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
        
        // Log progress
        if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount} new transactions`);
        }
    }

    // Update cache with latest analysis info
    if (processedCount > 0) {
        // Upsert cache entry for this analysis session
        await prisma.walletAnalysisCache.upsert({
            where: {
                walletAddress: walletAddress
            },
            update: {
                lastSignature: signatures[0].signature, // Most recent transaction signature
                transactionCount: { increment: processedCount }, // Add to existing total
                analyzedAt: new Date()
            },
            create: {
                walletAddress: walletAddress,
                lastSignature: signatures[0].signature, // Most recent transaction signature
                transactionCount: processedCount,
                analyzedAt: new Date()
            }
        });
        console.log(`Analysis completed. Processed ${processedCount} new transactions.`);
    } else {
        console.log(`Analysis completed. No new transactions to process.`);
    }

  } catch (error) {
    console.error("Error in getAllWalletTransactions:", error);
    throw new Error("Error fetching transactions: " + (error as Error).message);
  }
}

// Helper function to get transaction details using the shared connection
async function _getTransactionDetail(connection: Connection, signature: string, walletAddress: string) {
  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) return null;
    
    const txInfo = determineTransactionType(transaction, walletAddress);

    // Only store transfer transactions (sent/received), skip swaps and other types
    if (txInfo.type === 'transfer') {
      // Ensure wallet records exist before creating transaction
      if (txInfo.details.source) {
        await ensureWalletExists(txInfo.details.source);
      }
      
      if (txInfo.details.destination) {
        await ensureWalletExists(txInfo.details.destination);
      }

      // add the transaction to the database
      await prisma.transaction.create({
        data: {
          signature: signature,
          transactionType: txInfo.type,
          sourceAddress: txInfo.details.source || '',
          destinationAddress: txInfo.details.destination || '',
          amountSol: txInfo.details.amount || 0,
          rawData: transaction
        }
      });

      // add the wallet relationship to the database
      if (txInfo.details.source && txInfo.details.destination) {
        await prisma.walletRelationship.upsert({
          where: {
            sourceWallet_targetWallet: {
              sourceWallet: txInfo.details.source!,
              targetWallet: txInfo.details.destination!
            }
          },
          update: {
            sentCount: { increment: 1 },
            totalSentSol: { increment: txInfo.details.amount || 0 },
            lastInteraction: new Date()
          },
          create: {
            sourceWallet: txInfo.details.source!,
            targetWallet: txInfo.details.destination!,
            sentCount: 1,
            totalSentSol: txInfo.details.amount || 0,
            firstInteraction: new Date(),
                lastInteraction: new Date()
          }
        });
      }
    }     
  } catch (error) {
    console.error(`Error fetching transaction ${signature}:`, error);
  }
}
