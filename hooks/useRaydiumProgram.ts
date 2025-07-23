/**
 * Real-Time Raydium Pool Monitoring Hook
 * Detects new token launches using onLogs with proper 8-byte discriminators
 * Focuses only on Raydium AMM V4 and CP Swap (no Meteora)
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
  COMMON_TOKENS
} from '../types/ray';

// ========================================================================
// MAIN HOOK FOR REAL-TIME RAYDIUM MONITORING
// ========================================================================

export const useRaydiumProgram = () => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [pools, setPools] = useState<TokenLaunchEvent[]>([]);
  const [livePoolStates, setLivePoolStates] = useState<LaunchpadLivePoolState[]>([]);
  
  // 🎪 NEW: Enhanced Launchpad monitoring state
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
    lastTokenLaunch: null
  });
  
  // 🎪 NEW: Launchpad-specific statistics
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

  // Refs dla cleanup
  const subscriptionRefs = useRef<number[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ========================================================================
  // RATE LIMITING & CACHE 🚀 (SIMPLIFIED - NO MORE QUEUE!)
  // ========================================================================
  // 🗑️ REMOVED: Queue system - now processing logs directly like pump.fun
  // const transactionCache = useRef<Map<string, any>>(new Map());
  // const requestQueue = useRef<Array<{ signature: string; logs: any }>>([]);
  // const isProcessing = useRef(false);
  // const lastRequestTime = useRef(0);
  // const REQUEST_DELAY = 200;
  
  // 🎯 NEW: Track processed transactions to avoid duplicates
  const processedTransactions = useRef<Set<string>>(new Set());
  
  // ========================================================================
  // CONNECTION SETUP
  // ========================================================================

  useEffect(() => {
    const initConnection = async () => {
      try {
        // Use Helius RPC for better performance and no rate limits
        const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        
        let rpcUrl: string;
        let wsUrl: string;
        
        if (HELIUS_API_KEY) {
          // Use Helius RPC with API key
          rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
          wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
          console.log('🚀 Using Helius RPC with API key');
        } else {
          // Fallback to public RPC (with rate limits)
          rpcUrl = 'https://api.mainnet-beta.solana.com';
          wsUrl = 'wss://api.mainnet-beta.solana.com';
          console.log('⚠️ Helius API key not found, using public RPC (limited)');
          console.log('💡 Get free API key from: https://www.helius.dev/');
        }
        
        const conn = new Connection(rpcUrl, {
          commitment: 'confirmed',
          wsEndpoint: wsUrl
        });

        // Test connection with timeout
        const connectionPromise = conn.getVersion();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        );
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        setConnection(conn);
        setStats(prev => ({ ...prev, isConnected: true }));
        
        console.log('🔥 Raydium Monitor connected successfully');
        console.log(`📡 Current slot: ${await conn.getSlot()}`);
        console.log(`🎯 Monitoring program: ${RAYDIUM_PROGRAMS.LAUNCHPAD.toString()}`);
      } catch (error) {
        console.error('❌ Failed to connect to Solana:', error);
        setStats(prev => ({ ...prev, isConnected: false }));
      }
    };

    initConnection();
    
    // Cleanup function to prevent WebSocket errors
    return () => {
      if (connection) {
        try {
          // Clean up any active subscriptions
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
  // ENHANCED: Parse Token Parameters from Launchpad Program Logs (LIKE PUMP.FUN!)
  // ========================================================================

  // 🎯 NOWA METODA: Parse mint params z program logs (jak pump.fun)
  const parseTokenParametersFromProgramLogs = (data: Buffer): {
    mintParams?: MintParams;
    curveParams?: CurveParams;
    vestingParams?: VestingParams;
  } | null => {
    try {
      console.log('📝 Parsing MintParams from Program Data (like pump.fun)...');

      // Parse instruction arguments after discriminator (8 bytes)
      let offset = 8;

      // Parse MintParams (base_mint_param argument)
      if (data.length > offset + 4) {
        
        // Read decimals (u8)
        const decimals = data.readUInt8(offset);
        offset += 1;

        // Read name string length and content
        if (data.length > offset + 4) {
          const nameLength = data.readUInt32LE(offset);
          offset += 4;
          
          if (data.length >= offset + nameLength) {
            const name = data.subarray(offset, offset + nameLength).toString('utf8');
            offset += nameLength;

            // Read symbol string length and content  
            if (data.length > offset + 4) {
              const symbolLength = data.readUInt32LE(offset);
              offset += 4;
              
              if (data.length >= offset + symbolLength) {
                const symbol = data.subarray(offset, offset + symbolLength).toString('utf8');
                offset += symbolLength;

                // Read URI string length and content
                if (data.length > offset + 4) {
                  const uriLength = data.readUInt32LE(offset);
                  offset += 4;
                  
                  if (data.length >= offset + uriLength) {
                    const uri = data.subarray(offset, offset + uriLength).toString('utf8');
                    offset += uriLength;

                    const mintParams: MintParams = {
                      decimals,
                      name,
                      symbol,
                      uri
                    };

                    console.log('✅ MintParams extracted from Program Data!');

                    // Try to parse additional params if available
                    let curveParams: CurveParams | undefined;
                    let vestingParams: VestingParams | undefined;

                    // Parse CurveParams if available
                    if (data.length > offset + 25) {
                      try {
                        const curveType = data.readUInt8(offset);
                        offset += 1;
                        const virtualBase = data.readBigUInt64LE(offset);
                        offset += 8;
                        const virtualQuote = data.readBigUInt64LE(offset);
                        offset += 8;
                        const supply = data.readBigUInt64LE(offset);
                        offset += 8;

                        curveParams = {
                          curveType,
                          virtualBase,
                          virtualQuote,
                          supply
                        };
                      } catch (curveError) {
                        // Silently continue - curve params are optional
                      }
                    }

                    // Parse VestingParams if available
                    if (data.length > offset + 24) {
                      try {
                        const startTime = data.readBigUInt64LE(offset);
                        offset += 8;
                        const endTime = data.readBigUInt64LE(offset);
                        offset += 8;
                        const totalAmount = data.readBigUInt64LE(offset);
                        offset += 8;

                        vestingParams = {
                          startTime,
                          endTime,
                          totalAmount
                        };
                      } catch (vestingError) {
                        // Silently continue - vesting params are optional
                      }
                    }

                    return { mintParams, curveParams, vestingParams };
                  }
                }
              }
            }
          }
        }
      }
    } catch (parseError) {
      console.warn('⚠️  Error parsing MintParams from Program Data:', parseError instanceof Error ? parseError.message : 'Unknown error');
    }
    return null;
  };

  // ========================================================================
  // LOG PROCESSING - ZOPTYMALIZOWANA LOGIKA DETECTION 🚀 (LIKE PUMP.FUN!)
  // ========================================================================

  // 🎯 NOWA METODA: Process logs jak pump.fun
  const processRaydiumLogsForTokenLaunches = useCallback((logs: any, signature: string) => {
    console.log(`📡 Processing Raydium logs: ${signature}`);
    
    // Avoid processing duplicates (like pump.fun does)
    if (processedTransactions.current.has(signature)) {
      return;
    }
    processedTransactions.current.add(signature);
    
    logs.logs.forEach((log: string) => {
      // Look for program data in logs (EXACTLY LIKE PUMP.FUN!)
      if (log.includes('Program data:')) {
        const dataMatch = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
        if (dataMatch) {
          try {
            const data = Buffer.from(dataMatch[1], 'base64');
            
            // Check for Launchpad Initialize Event
            if (hasDiscriminator(data, LAUNCHPAD_DISCRIMINATORS.initialize)) {
              console.log('🎪 🎪 🎪 NEW RAYDIUM TOKEN LAUNCH DETECTED! 🎪 🎪 🎪');
              
              // Parse token parameters from program data (like pump.fun)
              const tokenParams = parseTokenParametersFromProgramLogs(data);
              
              if (tokenParams?.mintParams) {
                console.log(`🏷️  Name: ${tokenParams.mintParams.name} (${tokenParams.mintParams.symbol})`);
                console.log(`📋 Decimals: ${tokenParams.mintParams.decimals}`);
                console.log(`📄 Metadata: ${tokenParams.mintParams.uri}`);
                console.log(`🔗 Tx: https://solscan.io/tx/${signature}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Create token launch event with parsed data
                const tokenLaunchEvent: TokenLaunchEvent = {
                  poolId: `detecting_${signature.slice(0, 8)}`, // Will be filled later
                  tokenA: 'detecting...', // Will be filled by getting transaction details
                  tokenB: 'SOL', // Assuming SOL pair
                  lpMint: 'N/A',
                  creator: 'detecting...',
                  timestamp: new Date(),
                  signature,
                  type: 'launchpad_initialize',
                  program: 'LAUNCHPAD',
                  isTokenLaunch: true,
                  initialLiquiditySOL: 0,
                  tokenMint: 'detecting...',
                  isNewToken: true,
                  createdAt: new Date(),
                  lifetime: 0,
                  // 🎯 MintParams data from program logs!
                  mintParams: tokenParams.mintParams,
                  curveParams: tokenParams.curveParams,
                  vestingParams: tokenParams.vestingParams,
                  // Legacy fields for UI compatibility
                  tokenSymbol: tokenParams.mintParams.symbol,
                  tokenName: tokenParams.mintParams.name,
                  tokenDecimals: tokenParams.mintParams.decimals,
                  tokenUri: tokenParams.mintParams.uri
                };

                // Add to state immediately with mint params
                addTokenLaunchToState(tokenLaunchEvent);
                
                // Optionally: Get full transaction details in background to fill missing data
                setTimeout(async () => {
                  try {
                    const tx = await connection!.getTransaction(signature, {
                      commitment: 'confirmed',
                      maxSupportedTransactionVersion: 0
                    });
                    
                    if (tx) {
                      // Extract more details and update the launch event
                      // This is optional - we already have the important mint params!
                    }
                  } catch (error) {
                    console.warn('Could not get full transaction details:', error);
                  }
                }, 100);
              }
            }
          } catch (error) {
            console.error('Error processing Raydium program data:', error);
          }
        }
      }
    });
  }, [connection]);

  // ========================================================================
  // POZOSTAŁE FUNKCJE - UPROSZCZONE (bez instruction data parsing)
  // ========================================================================

  // 🗑️ USUWAM STARE METODY - już niepotrzebne
  // const parseTokenParametersFromTransaction = ... (REMOVED)
  // const parseRaydiumInitialize2FromLogs = ... (SIMPLIFIED)  
  // const parseRaydiumInitializeFromLogs = ... (SIMPLIFIED)
  // const parseLaunchpadInitializeFromLogs = ... (REPLACED by processRaydiumLogsForTokenLaunches)

  // Helper function to add token launch to state and update stats
  const addTokenLaunchToState = (tokenLaunchEvent: TokenLaunchEvent) => {
    setPools(prev => [tokenLaunchEvent, ...prev.slice(0, 9)]); // Keep only 10
    
    setStats(prev => ({
      ...prev,
      poolsDetected: prev.poolsDetected + 1,
      tokenLaunchesDetected: prev.tokenLaunchesDetected + 1,
      lastTokenLaunch: new Date()
    }));

    // 🎯 CLEAN OUTPUT FOR TOKEN LAUNCHES
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 NEW TOKEN LAUNCH ADDED TO MONITORING`);
    console.log(`💰 Token: ${tokenLaunchEvent.tokenMint || tokenLaunchEvent.tokenA}`);
    if (tokenLaunchEvent.tokenName) console.log(`📝 Name: ${tokenLaunchEvent.tokenName}`);
    if (tokenLaunchEvent.tokenSymbol) console.log(`🏷️  Symbol: ${tokenLaunchEvent.tokenSymbol}`);
    if (tokenLaunchEvent.tokenDecimals !== undefined) console.log(`🔢 Decimals: ${tokenLaunchEvent.tokenDecimals}`);
    if (tokenLaunchEvent.tokenUri) console.log(`📄 Metadata: ${tokenLaunchEvent.tokenUri}`);
    console.log(`🏊 Pool: ${tokenLaunchEvent.poolId}`);
    console.log(`👤 Creator: ${tokenLaunchEvent.creator}`);
    console.log(`🔗 TX: https://solscan.io/tx/${tokenLaunchEvent.signature}`);
    console.log(`📊 Total launches detected: ${tokenLaunchEvent.tokenMint ? 'N/A' : 'counting...'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  };

  // Simple log processor - just adds to queue
  const processLogs = useCallback(async (logs: any, signature: string) => {
    if (!connection) return;

    // 🎯 NOWA LOGIKA: Process logs directly like pump.fun (no more queue!)
    processRaydiumLogsForTokenLaunches(logs, signature);
  }, [connection, processRaydiumLogsForTokenLaunches]);

  // Parse Launchpad Initialize (Enhanced with token parameters)
  const parseEnhancedLaunchpadInitialize = async (buffer: Buffer, signature: string, logs: any): Promise<boolean> => {
    try {
      console.log('🎪 ENHANCED LAUNCHPAD INITIALIZE PARSING...');
      
      // Use the new processRaydiumLogsForTokenLaunches method
      processRaydiumLogsForTokenLaunches(logs, signature);
      return true;
    } catch (error) {
      console.warn('Failed to parse enhanced launchpad initialize:', error);
    }
    return false;
  };

  // START MONITORING 🚀 - SIMPLIFIED (LIKE PUMP.FUN!)
  const startMonitoring = useCallback(async () => {
    if (!connection || isMonitoring) return;

    try {
      console.log('');
      console.log('🚀🚀🚀 RAYDIUM LAUNCHPAD TOKEN MONITORING 🚀🚀🚀');
      console.log('🎯 FOCUS: NEW TOKEN LAUNCHES + MINTPARAMS FROM PROGRAM LOGS');
      console.log('🎪 Program: Raydium Launchpad (LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj)');
      console.log('📝 Extracting: name, symbol, decimals, uri from Program Data');
      console.log('🎯 Method: Parse program logs (SAME AS PUMP.FUN!)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      setIsMonitoring(true);
      startTimeRef.current = new Date();
      
      // 🎯 Monitor ONLY Raydium Launchpad for new token launches
      console.log('🎪 Subscribing to Launchpad for NEW TOKEN LAUNCHES...');

      // Subscribe to Raydium Launchpad program logs (like pump.fun does)
      const launchpadSubscription = connection.onLogs(
        new PublicKey(RAYDIUM_PROGRAMS.LAUNCHPAD),
        (logs, context) => {
          // Process logs directly (no queue, just like pump.fun)
          processLogs(logs, logs.signature);
        },
        'confirmed'
      );

      subscriptionRefs.current = [launchpadSubscription];

      // Uptime counter
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const uptime = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setStats(prev => ({ ...prev, uptime, isMonitoring: true }));
        }
      }, 1000);

      setStats(prev => ({ ...prev, isMonitoring: true }));
      console.log('✅ New token launch monitoring started - parsing program logs like pump.fun!');
      
    } catch (error) {
      console.error('❌ Error starting monitoring:', error);
      setIsMonitoring(false);
    }
  }, [connection, isMonitoring, processLogs]);

  // STOP MONITORING 🛑
  const stopMonitoring = useCallback(async () => {
    if (!connection || !isMonitoring) return;

    try {
      // Show monitoring summary before stopping
      console.log('');
      console.log('🛑 STOPPING TOKEN LAUNCH MONITORING - SUMMARY:');
      console.log(`🎪 New token launches detected: ${pools.length}`);
      console.log(`📝 Total transactions processed: ${processedTransactions.current.size}`);
      
      // Calculate uptime inline
      const hours = Math.floor(stats.uptime / 3600);
      const minutes = Math.floor((stats.uptime % 3600) / 60);
      const secs = stats.uptime % 60;
      console.log(`⏱️  Monitoring duration: ${hours}h ${minutes}m ${secs}s`);
      
      console.log(`📋 Final queue size: ${processedTransactions.current.size}`); // Changed from requestQueue.current.length
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (pools.length > 0) {
        console.log('🚀 DETECTED TOKEN LAUNCHES:');
        pools.slice(0, 3).forEach((pool, i) => {
          console.log(`  ${i + 1}. ${pool.tokenName || 'Unknown'} (${pool.tokenSymbol || 'N/A'})`);
          console.log(`     💰 Token: ${pool.tokenA}`);
          console.log(`     🔗 TX: ${pool.signature}`);
          if (pool.tokenUri) console.log(`     📄 Metadata: ${pool.tokenUri}`);
        });
        if (pools.length > 3) {
          console.log(`  ... and ${pools.length - 3} more launches`);
        }
      } else {
        console.log('❌ No token launches detected during this session');
        console.log('💡 Possible reasons:');
        console.log('   • No new tokens were launched on Launchpad during monitoring');
        console.log('   • Launches happen at specific times (often evening/night)');
        console.log('   • Try monitoring for longer periods');
        console.log('   • Weekend vs weekday launch patterns may vary');
      }
      console.log('');

      // Remove wszystkie subskrypcje
      await Promise.all(
        subscriptionRefs.current.map(id => connection.removeOnLogsListener(id))
      );
      subscriptionRefs.current = [];

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setIsMonitoring(false);
      setStats(prev => ({ ...prev, isMonitoring: false }));
      startTimeRef.current = null;
      
      // 🗑️ Clear instruction counts for next session
      // instructionTypeCounts.current.clear(); // Removed

      console.log('✅ Token launch monitoring stopped');
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  }, [connection, isMonitoring, pools, stats.uptime]);

  // CLEAR DATA 🗑️
  const clearData = useCallback(() => {
    setPools([]);
    setLivePoolStates([]);
    
    // 🎪 Clear new Launchpad data
    setLaunchpadEvents([]);
    setLaunchpadTokenLaunches([]);
    setLaunchpadTrades([]);
    setLaunchpadMigrations([]);
    setActiveLaunchpadPools([]);
    
    setStats(prev => ({
      ...prev,
      poolsDetected: 0,
      tokenLaunchesDetected: 0,
      uptime: 0,
      lastTokenLaunch: null
    }));
    
    // 🎪 Clear Launchpad stats
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
    
    // 🗑️ Clear processed transactions
    processedTransactions.current.clear();
    
    console.log('🗑️ Token launch data cleared - ready for new monitoring session');
  }, []);

  // HELPER FUNCTIONS
  const formatUptime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }, []);

  const getNewTokenOnly = useCallback(() => {
    return pools.filter(pool => pool.isNewToken);
  }, [pools]);

  // Remove all lifecycle tracking helper functions and return simplified API
  const getRecentLaunches = useCallback((minutes: number = 60) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return pools.filter(pool => pool.timestamp.getTime() > cutoff);
  }, [pools]);

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

  // Enhanced helper functions for Launchpad
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
      
      // 🗑️ Cleanup processed transactions
      processedTransactions.current.clear();
    };
  }, [connection]);

  // ========================================================================
  // RETURN HOOK API - SIMPLIFIED FOR MINTPARAMS ONLY
  // ========================================================================

  return {
    // Connection state
    connection,
    isConnected: stats.isConnected,
    
    // Monitoring state
    isMonitoring,
    pools,
    livePoolStates,
    stats,

    // Controls  
    startMonitoring,
    stopMonitoring,
    clearData,

    // Helper functions (simplified)
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

    // Enhanced Launchpad stats (keep these as they were already defined)
    launchpadStats,
    launchpadEvents,
    launchpadTokenLaunches,
    launchpadTrades,
    launchpadMigrations,
    activeLaunchpadPools,
    getActiveLaunchpadPools,
    getRecentLaunchpadTrades
  };
}; 
