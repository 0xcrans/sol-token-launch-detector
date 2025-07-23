/**
 * 🎯 IMPROVED: Raydium Token Detection via buy_exact_in Instructions
 * 
 * Problem: initialize instructions są rzadkie (1% transakcji)
 * Rozwiązanie: Używaj buy_exact_in jak pump.fun - 99% aktywności!
 * 
 * Strategy:
 * 1. Monitor buy_exact_in transactions (99% of activity)
 * 2. Extract token address from accounts[9] (base_token_mint)
 * 3. Track first-time seen tokens = NEW TOKENS!
 * 4. Much faster detection, no rate limiting issues
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { 
  RAYDIUM_PROGRAMS, 
  RAYDIUM_DISCRIMINATORS, 
  CP_SWAP_DISCRIMINATORS,
  LAUNCHPAD_DISCRIMINATORS,
  TokenLaunchEvent, 
  MonitoringStats,
  LaunchpadLivePoolState,
  LaunchpadTokenLaunch,
  LaunchpadTradeEvent,
  LaunchpadMigrationEvent,
  LaunchpadEvent,
  LaunchpadPoolStatus,
  LaunchpadMonitoringStats,
  MintParams,
  CurveParams,
  VestingParams,
  hasDiscriminator,
  isTokenLaunch,
  getInstructionType,
  isNewTokenLaunchInstruction,
  isTradingInstruction,
  COMMON_TOKENS
} from '../types/ray';

// ========================================================================
// 🎯 BUY_EXACT_IN APPROACH - Like Pump.fun
// ========================================================================

const RAYDIUM_LAUNCHPAD = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

// buy_exact_in discriminator from Raydium Launchpad program
const BUY_EXACT_IN_DISCRIMINATOR = new Uint8Array([250, 234, 13, 123, 213, 156, 19, 236]);

/*
🎯 KEY INSIGHT: buy_exact_in accounts structure dari launchpad.json:
[0] payer (signer) - buyer
[1] authority (PDA)  
[2] global_config
[3] platform_id
[4] pool_id           ← POOL ADDRESS
[5] user_token_account_base   ← USER'S TOKEN ACCOUNT (base token)
[6] user_token_account_quote  ← USER'S SOL ACCOUNT  
[7] base_vault        ← POOL'S TOKEN VAULT
[8] quote_vault       ← POOL'S SOL VAULT
[9] base_token_mint   ← 🎯 TOKEN ADDRESS (the new token!)
[10] quote_token_mint ← SOL/USDC address
*/

interface TokenFromBuyTransaction {
  tokenAddress: string;        // ← Extract from accounts[9] 
  poolAddress: string;         // ← Extract from accounts[4]
  buyerAddress: string;        // ← Extract from accounts[0]
  quoteTokenAddress: string;   // ← Extract from accounts[10] (usually SOL)
  timestamp: Date;
  signature: string;
  isNewToken: boolean;         // ← Check if we've seen this token before
  amountSOL?: number;          // ← Parse from instruction data if needed
  blockTime: number;
  // Compatibility with existing TokenLaunchEvent
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenUri?: string;
}

export const useRaydiumProgram = () => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  // 🎯 NEW: Buy-based token detection
  const [detectedTokens, setDetectedTokens] = useState<TokenFromBuyTransaction[]>([]);
  
  // Legacy compatibility - convert buy-based tokens to TokenLaunchEvent format
  const [pools, setPools] = useState<TokenLaunchEvent[]>([]);
  const [livePoolStates, setLivePoolStates] = useState<LaunchpadLivePoolState[]>([]);
  
  const [launchpadEvents, setLaunchpadEvents] = useState<LaunchpadEvent[]>([]);
  const [launchpadTokenLaunches, setLaunchpadTokenLaunches] = useState<LaunchpadTokenLaunch[]>([]);
  const [launchpadTrades, setLaunchpadTrades] = useState<LaunchpadTradeEvent[]>([]);
  const [launchpadMigrations, setLaunchpadMigrations] = useState<LaunchpadMigrationEvent[]>([]);
  const [activeLaunchpadPools, setActiveLaunchpadPools] = useState<LaunchpadPoolStatus[]>([]);
  
  const [stats, setStats] = useState<MonitoringStats>({
    isConnected: false,
    isMonitoring: false,
    poolsDetected: 0,
    tokenLaunchesDetected: 0,
    uptime: 0,
    lastTokenLaunch: null,
    rpcCallsThisSession: 0,
    rpcQueueSize: 0,
    successfulDetections: 0,
    failedDetections: 0
  });
  
  const [launchpadStats, setLaunchpadStats] = useState<LaunchpadMonitoringStats>({
    launchesDetected: 0,
    tradesDetected: 0,
    migrationsDetected: 0,
    activePools: 0,
    nearMigrationPools: 0,
    totalVolumeSOL: 0,
    volume24hSOL: 0,
    avgTimeToFirstTrade: 0,
    avgTimeToMigration: 0
  });

  // Refs for cleanup and token tracking
  const subscriptionRefs = useRef<number[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🎯 CRITICAL: Track seen tokens to identify NEW ones
  const seenTokensRef = useRef<Set<string>>(new Set());
  const processedTransactions = useRef<Set<string>>(new Set());

  // ========================================================================
  // 🔧 RATE LIMITING SYSTEM - Prevent 429 errors
  // ========================================================================

  const rpcQueue = useRef<Array<{
    signature: string;
    timestamp: number;
    resolve: () => void;
  }>>([]);
  const isProcessingQueue = useRef<boolean>(false);
  const lastRpcCall = useRef<number>(0);
  const RPC_DELAY = 150; // 150ms between calls to prevent rate limiting
  const MAX_CONCURRENT = 1; // Only 1 concurrent RPC call at a time

  // Store the processing function in a ref to avoid dependency cycles
  const extractTokenFromBuyTransactionThrottledRef = useRef<((signature: string) => Promise<void>) | null>(null);

  /**
   * 🔧 Process RPC queue with rate limiting
   */
  const processRpcQueue = useCallback(async () => {
    if (isProcessingQueue.current || rpcQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;

    while (rpcQueue.current.length > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - lastRpcCall.current;

      // Respect rate limit
      if (timeSinceLastCall < RPC_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RPC_DELAY - timeSinceLastCall));
      }

      const queueItem = rpcQueue.current.shift();
      if (!queueItem) break;

      lastRpcCall.current = Date.now();
      
      // Process this transaction
      try {
        if (extractTokenFromBuyTransactionThrottledRef.current) {
          await extractTokenFromBuyTransactionThrottledRef.current(queueItem.signature);
        }
      } catch (error) {
        console.warn(`⚠️ [QUEUE] Failed to process ${queueItem.signature.slice(0,8)}: ${error}`);
      }

      queueItem.resolve();
    }

    isProcessingQueue.current = false;
  }, []);

  /**
   * 🔧 Add transaction to processing queue
   */
  const queueRpcCall = useCallback((signature: string): Promise<void> => {
    return new Promise((resolve) => {
      // Check for duplicates
      if (rpcQueue.current.some(item => item.signature === signature)) {
        resolve();
        return;
      }

      rpcQueue.current.push({
        signature,
        timestamp: Date.now(),
        resolve
      });

      // Keep queue size manageable
      if (rpcQueue.current.length > 50) {
        console.warn(`⚠️ [QUEUE] Queue too large (${rpcQueue.current.length}), dropping oldest items`);
        rpcQueue.current = rpcQueue.current.slice(-30); // Keep last 30
      }

      // Start processing if not already running
      if (!isProcessingQueue.current) {
        processRpcQueue();
      }
    });
  }, [processRpcQueue]);

  // ========================================================================
  // 🎯 CORE: Extract token from buy_exact_in transaction (throttled version)
  // ========================================================================

  const extractTokenFromBuyTransactionThrottled = useCallback(async (signature: string) => {
    if (!connection) return;

    try {
      // Fetch transaction with retry for 429 errors
      let transaction = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          transaction = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.message?.includes('429') || error.status === 429) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error; // Re-throw non-429 errors
          }
        }
      }

      if (!transaction) {
        return;
      }

      // 🔧 DEFENSIVE: Check if transaction has required structure
      if (!transaction.transaction?.message?.compiledInstructions || 
          !transaction.transaction?.message?.staticAccountKeys) {
        return;
      }

      // Find Raydium Launchpad buy_exact_in instructions
      const launchpadInstructions = transaction.transaction.message.compiledInstructions.filter(ix => {
        const programIdIndex = ix.programIdIndex;
        
        // 🔧 DEFENSIVE: Check if programIdIndex is valid
        if (programIdIndex >= transaction.transaction.message.staticAccountKeys.length) {
          return false;
        }

        const programId = transaction.transaction.message.staticAccountKeys[programIdIndex];
        
        // 🔧 DEFENSIVE: Check if programId exists
        if (!programId) {
          return false;
        }

        return programId.toString() === RAYDIUM_LAUNCHPAD;
      });

      for (const instruction of launchpadInstructions) {
        const instructionData = Buffer.from(instruction.data);
        
        // Check if it's buy_exact_in
        if (instructionData.length >= 8) {
          const discriminator = instructionData.slice(0, 8);
          const isBuyExactIn = discriminator.every((byte, i) => byte === BUY_EXACT_IN_DISCRIMINATOR[i]);
          
          if (isBuyExactIn) {
            // 🎯 EXTRACT TOKEN ADDRESS from accounts
            const accounts = instruction.accountKeyIndexes.map(index => {
              // 🔧 DEFENSIVE: Check if account index is valid
              if (index >= transaction.transaction.message.staticAccountKeys.length) {
                return null;
              }
              return transaction.transaction.message.staticAccountKeys[index]?.toString();
            }).filter(account => account !== null); // Remove null entries

            if (accounts.length >= 11) {
              const buyerAddress = accounts[0];         // payer
              const poolAddress = accounts[4];          // pool_id  
              const tokenAddress = accounts[9];         // base_token_mint ← THE TOKEN!
              const quoteTokenAddress = accounts[10];   // quote_token_mint (SOL)

              // 🔧 DEFENSIVE: Verify all required addresses exist
              if (!buyerAddress || !poolAddress || !tokenAddress || !quoteTokenAddress) {
                continue;
              }

              // 🎯 CHECK IF THIS IS A NEW TOKEN
              const isNewToken = !seenTokensRef.current.has(tokenAddress);
              
              if (isNewToken) {
                // Add to seen tokens
                seenTokensRef.current.add(tokenAddress);
                
                // 🎯 MINIMAL LOGGING: Only new token discoveries
                console.log(`🚀 [RAYDIUM NEW] ${tokenAddress} | Pool: ${poolAddress} | TX: ${signature.slice(0,8)}`);

                // Create token detection event
                const tokenEvent: TokenFromBuyTransaction = {
                  tokenAddress,
                  poolAddress,
                  buyerAddress,
                  quoteTokenAddress,
                  timestamp: new Date(transaction.blockTime! * 1000),
                  signature,
                  isNewToken: true,
                  blockTime: transaction.blockTime!
                };

                // Add to detected tokens
                setDetectedTokens(prev => [tokenEvent, ...prev.slice(0, 49)]); // Keep last 50
                
                // Convert to legacy TokenLaunchEvent format for compatibility
                const legacyTokenLaunchEvent: TokenLaunchEvent = {
                  poolId: poolAddress,
                  tokenA: tokenAddress,           // ← The new token contract address
                  tokenB: quoteTokenAddress,      // ← Usually SOL
                  lpMint: poolAddress,
                  creator: buyerAddress,          // First buyer as creator for now
                  timestamp: new Date(transaction.blockTime! * 1000),
                  signature,
                  type: 'launchpad_initialize',   // ← Use existing type instead of 'launchpad_buy_detected'
                  program: 'LAUNCHPAD',
                  isTokenLaunch: true,
                  initialLiquiditySOL: 0,
                  tokenMint: tokenAddress,        // ← Contract address
                  isNewToken: true,
                  createdAt: new Date(transaction.blockTime! * 1000),
                  lifetime: 0,
                  detectionMethod: 'full_transaction', // ← Use existing type instead of 'buy_exact_in'
                  hasCompleteData: true,
                  isUpdating: false,
                  tokenSymbol: 'UNKNOWN',
                  tokenName: 'Unknown Token',
                  tokenDecimals: 9,
                  tokenUri: ''
                };

                // Add to legacy pools for existing UI compatibility
                setPools(prev => [legacyTokenLaunchEvent, ...prev.slice(0, 9)]);
                
                // Update stats
                setStats(prev => ({
                  ...prev,
                  poolsDetected: prev.poolsDetected + 1,
                  tokenLaunchesDetected: prev.tokenLaunchesDetected + 1,
                  lastTokenLaunch: new Date(),
                  successfulDetections: (prev.successfulDetections || 0) + 1,
                  rpcCallsThisSession: (prev.rpcCallsThisSession || 0) + 1
                }));
              }
            }
          }
        }
      }
      
    } catch (error: any) {
      setStats(prev => ({ 
        ...prev, 
        failedDetections: (prev.failedDetections || 0) + 1,
        rpcCallsThisSession: (prev.rpcCallsThisSession || 0) + 1
      }));
    }
  }, [connection]);

  // 🔧 Assign function to ref after definition
  extractTokenFromBuyTransactionThrottledRef.current = extractTokenFromBuyTransactionThrottled;

  // ========================================================================
  // 🎯 ORIGINAL FUNCTION - now just queues the work
  // ========================================================================

  const extractTokenFromBuyTransaction = useCallback(async (signature: string) => {
    // Just queue the work instead of doing it immediately
    await queueRpcCall(signature);
  }, [queueRpcCall]);

  // ========================================================================
  // 🎯 PROCESS LOGS - Look for Launchpad activity (buy_exact_in focused)
  // ========================================================================
  
  const processLaunchpadLogs = useCallback((logs: any, signature: string) => {
    try {
      // Avoid processing duplicates
      if (processedTransactions.current.has(signature)) {
        return;
      }
      processedTransactions.current.add(signature);
      
      // Check if it's Launchpad program activity
      const isLaunchpadTx = logs.logs.some((log: string) => 
        log.includes(RAYDIUM_LAUNCHPAD)
      );

      if (!isLaunchpadTx) {
        return; // Skip non-Launchpad transactions
      }
      
      // Analyze this transaction for token addresses
      extractTokenFromBuyTransaction(signature);
      
    } catch (error) {
      console.error(`❌ Error processing logs for ${signature.slice(0,8)}:`, error);
    }
  }, [extractTokenFromBuyTransaction]);

  // ========================================================================
  // 🎯 CONNECTION SETUP
  // ========================================================================

  useEffect(() => {
    const initConnection = async () => {
      try {
        const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        
        let rpcUrl: string;
        let wsUrl: string;
        
        if (HELIUS_API_KEY) {
          rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
          wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
          console.log('🚀 Using Helius RPC with API key');
        } else {
          rpcUrl = 'https://api.mainnet-beta.solana.com';
          wsUrl = 'wss://api.mainnet-beta.solana.com';
          console.log('⚠️ Helius API key not found, using public RPC (limited)');
        }
        
        const conn = new Connection(rpcUrl, {
          commitment: 'confirmed',
          wsEndpoint: wsUrl
        });

        const connectionPromise = conn.getVersion();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        );
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        setConnection(conn);
        setStats(prev => ({ ...prev, isConnected: true }));
        
        console.log('🔥 Raydium Buy-Based Monitor connected successfully');
        console.log(`📡 Current slot: ${await conn.getSlot()}`);
      } catch (error) {
        console.error('❌ Failed to connect to Solana:', error);
        setStats(prev => ({ ...prev, isConnected: false }));
      }
    };

    initConnection();
    
    return () => {
      if (connection) {
        try {
          subscriptionRefs.current.forEach(subId => {
            try {
              connection.removeOnLogsListener(subId);
            } catch (e) {
              // Ignore cleanup errors
            }
          });
          subscriptionRefs.current = [];
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // ========================================================================
  // 🎯 MONITORING CONTROLS
  // ========================================================================

  const startMonitoring = useCallback(async () => {
    if (!connection) {
      console.error('❌ Cannot start monitoring: No connection available');
      return;
    }
    
    if (isMonitoring) {
      return;
    }

    try {
      console.log('🎯 [RAYDIUM] Starting buy-based token monitoring...');
      
      setIsMonitoring(true);
      startTimeRef.current = new Date();
      
      // Reset stats and tracking
      setStats(prev => ({
        ...prev,
        rpcCallsThisSession: 0,
        successfulDetections: 0,
        failedDetections: 0,
        isMonitoring: true
      }));
      
      // Clear tracking sets
      seenTokensRef.current.clear();
      processedTransactions.current.clear();

      // Subscribe to Raydium Launchpad program logs
      const launchpadSubscription = connection.onLogs(
        new PublicKey(RAYDIUM_LAUNCHPAD),
        (logs, context) => {
          processLaunchpadLogs(logs, logs.signature);
        },
        'confirmed'
      );

      subscriptionRefs.current = [launchpadSubscription];

      // Stats update interval
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const uptime = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setStats(prev => ({ 
            ...prev, 
            uptime,
            rpcQueueSize: rpcQueue.current.length // Report queue size
          }));
        }
      }, 1000);

      console.log('✅ [RAYDIUM] Monitoring active - waiting for new tokens...');
      
    } catch (error) {
      console.error('❌ Error starting monitoring:', error);
      setIsMonitoring(false);
    }
  }, [connection, isMonitoring, processLaunchpadLogs]);

  const stopMonitoring = useCallback(async () => {
    if (!connection || !isMonitoring) return;

    try {
      console.log('🛑 [RAYDIUM] Stopping monitoring...');
      
      setIsMonitoring(false);
      setStats(prev => ({ ...prev, isMonitoring: false }));
      
      // Clean up subscriptions
      await Promise.all(
        subscriptionRefs.current.map(id => connection.removeOnLogsListener(id))
      );
      subscriptionRefs.current = [];

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      console.log('✅ [RAYDIUM] Monitoring stopped');
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  }, [connection, isMonitoring]);

  const clearData = useCallback(() => {
    setPools([]);
    setDetectedTokens([]);
    setLivePoolStates([]);
    setLaunchpadEvents([]);
    setLaunchpadTokenLaunches([]);
    setLaunchpadTrades([]);
    setLaunchpadMigrations([]);
    setActiveLaunchpadPools([]);
    
    seenTokensRef.current.clear();
    processedTransactions.current.clear();
    
    // 🔧 NEW: Clear RPC queue
    rpcQueue.current = [];
    isProcessingQueue.current = false;
    
    setStats(prev => ({
      ...prev,
      poolsDetected: 0,
      tokenLaunchesDetected: 0,
      uptime: 0,
      lastTokenLaunch: null,
      rpcCallsThisSession: 0,
      rpcQueueSize: 0,
      successfulDetections: 0,
      failedDetections: 0
    }));
    
    setLaunchpadStats({
      launchesDetected: 0,
      tradesDetected: 0,
      migrationsDetected: 0,
      activePools: 0,
      nearMigrationPools: 0,
      totalVolumeSOL: 0,
      volume24hSOL: 0,
      avgTimeToFirstTrade: 0,
      avgTimeToMigration: 0
    });
    
    console.log('🗑️ [RAYDIUM] Data cleared');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connection && subscriptionRefs.current.length > 0) {
        subscriptionRefs.current.forEach(id => {
          connection.removeOnLogsListener(id);
        });
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // 🔧 NEW: Cleanup RPC queue
      processedTransactions.current.clear();
      seenTokensRef.current.clear();
      rpcQueue.current = [];
      isProcessingQueue.current = false;
    };
  }, [connection]);

  // Helper functions
  const formatUptime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }, []);

  const getNewTokenOnly = useCallback(() => {
    return pools.filter(pool => pool.isNewToken);
  }, [pools]);

  const getRecentLaunches = useCallback((minutes: number = 60) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return detectedTokens.filter(token => token.timestamp.getTime() > cutoff);
  }, [detectedTokens]);

  const getHighLiquidityPools = useCallback(() => {
    return livePoolStates.filter(pool => pool.isHighLiquidity);
  }, [livePoolStates]);

  const getLargeSupplyPools = useCallback(() => {
    return livePoolStates.filter(pool => pool.isLargeSupply);
  }, [livePoolStates]);

  const getRecentPoolStates = useCallback((minutes: number = 10) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return livePoolStates.filter(pool => pool.timestamp.getTime() > cutoff);
  }, [livePoolStates]);

  const getActiveLaunchpadPools = useCallback(() => {
    return launchpadTokenLaunches.filter(launch => {
      const hoursAgo = (Date.now() - launch.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursAgo <= 24;
    });
  }, [launchpadTokenLaunches]);

  const getRecentLaunchpadTrades = useCallback((hours: number = 1) => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return launchpadTrades.filter(trade => trade.timestamp.getTime() > cutoff);
  }, [launchpadTrades]);

  // ========================================================================
  // 🎯 RETURN HOOK API - Enhanced with buy-based detection
  // ========================================================================

  return {
    // Connection state
    connection,
    isConnected: stats.isConnected,
    
    // Monitoring state
    isMonitoring,
    pools, // Legacy compatibility
    detectedTokens, // 🎯 NEW: Buy-based detected tokens
    livePoolStates,
    stats,

    // Controls  
    startMonitoring,
    stopMonitoring,
    clearData,

    // Helper functions
    formatUptime,
    getNewTokenOnly,
    getRecentLaunches,
    getHighLiquidityPools,
    getLargeSupplyPools,
    getRecentPoolStates,
    
    // Quick stats
    totalLaunches: stats.tokenLaunchesDetected,
    recentLaunches: getRecentLaunches(60).length,
    highLiquidityPools: getHighLiquidityPools().length,
    largeSupplyPools: getLargeSupplyPools().length,
    recentPoolUpdates: getRecentPoolStates(10).length,
    isActive: stats.isMonitoring && stats.isConnected,

    // Enhanced Launchpad stats
    launchpadStats,
    launchpadEvents,
    launchpadTokenLaunches,
    launchpadTrades,
    launchpadMigrations,
    activeLaunchpadPools,
    getActiveLaunchpadPools,
    getRecentLaunchpadTrades,
    
    // 🎯 NEW: Buy-based detection utilities
    totalTokensDetected: detectedTokens.length,
    totalUniqueTokens: seenTokensRef.current.size,
    isNewToken: (tokenAddress: string) => !seenTokensRef.current.has(tokenAddress),
    
    // Compatibility properties
    pendingDetections: 0,
    hasPendingDetections: false,
  };
}; 
