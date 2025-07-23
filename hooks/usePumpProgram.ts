import { useEffect, useState, useCallback, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  PUMP_CREATE_EVENT_DISCRIMINATOR,
  PUMP_TRADE_EVENT_DISCRIMINATOR,
  PUMP_COMPLETE_EVENT_DISCRIMINATOR
} from '../types';
import type { 
  PumpFun, 
  TokenLaunch, 
  TradeEvent, 
  CompleteEvent, 
  PumpMonitoringStats,
  BondingCurveState,
  PumpFunEvent,
  CurveMetrics
} from '../types';

// Pump.fun Program ID (mainnet)
const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Event discriminators from types (8-byte arrays)
const CREATE_EVENT_DISCRIMINATOR = PUMP_CREATE_EVENT_DISCRIMINATOR;
const TRADE_EVENT_DISCRIMINATOR = PUMP_TRADE_EVENT_DISCRIMINATOR;
const COMPLETE_EVENT_DISCRIMINATOR = PUMP_COMPLETE_EVENT_DISCRIMINATOR;

// Enhanced Bonding Curve Monitor Class
class PumpFunBondingCurveMonitor {
  private activeBondingCurves = new Map<string, BondingCurveState>();
  // DISABLED: Trade tracking since we're not processing trades anymore
  // private recentTradesByToken = new Map<string, TradeEvent[]>(); // Last 50 trades per curve
  private eventProcessingQueue: PumpFunEvent[] = [];
  
  // ADDED: Throttling for UI updates
  private lastUIUpdate: number = 0;
  private readonly UI_UPDATE_THROTTLE_MS = 500; // Update UI max every 500ms
  private pendingUIUpdate: boolean = false;
  
  // Constants from pump.fun mechanics
  private readonly SOL_REQUIRED_FOR_COMPLETION = 85;
  private readonly NEAR_COMPLETION_THRESHOLD = 0.8; // 80%
  // DISABLED: private readonly MAX_TRADES_STORED_PER_CURVE = 50;
  
  constructor(
    private onNewEventDetected: (event: PumpFunEvent) => void,
    private onBondingCurveStateUpdated: (curves: BondingCurveState[]) => void
  ) {}
  
  // ADDED: Throttled UI update method
  private triggerThrottledUIUpdate() {
    const now = Date.now();
    
    if (now - this.lastUIUpdate >= this.UI_UPDATE_THROTTLE_MS) {
      // Update immediately if enough time has passed
      this.lastUIUpdate = now;
      this.pendingUIUpdate = false;
      this.onBondingCurveStateUpdated(this.getAllActiveBondingCurves());
    } else if (!this.pendingUIUpdate) {
      // Schedule an update if none is pending
      this.pendingUIUpdate = true;
      const timeToWait = this.UI_UPDATE_THROTTLE_MS - (now - this.lastUIUpdate);
      
      setTimeout(() => {
        if (this.pendingUIUpdate) {
          this.lastUIUpdate = Date.now();
          this.pendingUIUpdate = false;
          this.onBondingCurveStateUpdated(this.getAllActiveBondingCurves());
        }
      }, timeToWait);
    }
  }
  
  registerNewTokenLaunch(launch: TokenLaunch) {
    // Initialize curve state for new launch
    const newBondingCurve: BondingCurveState = {
      mint: launch.mint,
      name: launch.name,
      symbol: launch.symbol,
      virtualSolReserves: 0,
      virtualTokenReserves: 0,
      realSolReserves: 0,
      realTokenReserves: 0,
      completionProgress: 0,
      solRaisedTarget: this.SOL_REQUIRED_FOR_COMPLETION,
      isNearCompletion: false,
      totalTrades: 0,
      recentVolume24h: 0,
      buyPressure: 0,
      avgTradeSize: 0,
      createdAt: launch.timestamp,
      lastActivity: launch.timestamp,
      isActive: true,
      isCompleted: false
    };
    
    this.activeBondingCurves.set(launch.mint, newBondingCurve);
    // DISABLED: this.recentTradesByToken.set(launch.mint, []);
    
    // Queue launch event
    const launchEvent: PumpFunEvent = {
      type: 'launch',
      timestamp: launch.timestamp,
      mint: launch.mint,
      data: launch,
      priority: 'normal',
      signature: launch.signature
    };
    
    this.addEventToProcessingQueue(launchEvent);
    this.triggerThrottledUIUpdate();
  }
  
  // DISABLED: Trade processing since we're not monitoring trades anymore
  /*
  updateBondingCurveFromTrade(trade: TradeEvent) {
    const { mint } = trade;
    
    // Get or create curve state
    let existingCurve = this.activeBondingCurves.get(mint);
    if (!existingCurve) {
      existingCurve = this.createBondingCurveFromFirstTrade(mint, trade);
    }
    
    // Update reserves from trade
    existingCurve.virtualSolReserves = trade.virtualSolReserves;
    existingCurve.virtualTokenReserves = trade.virtualTokenReserves;
    existingCurve.realSolReserves = trade.realSolReserves;
    existingCurve.realTokenReserves = trade.realTokenReserves;
    existingCurve.lastActivity = trade.timestamp;
    
    // Track recent trades for this curve
    if (!this.recentTradesByToken.has(mint)) {
      this.recentTradesByToken.set(mint, []);
    }
    const tradesForThisToken = this.recentTradesByToken.get(mint)!;
    tradesForThisToken.unshift(trade);
    if (tradesForThisToken.length > this.MAX_TRADES_STORED_PER_CURVE) tradesForThisToken.pop(); // Keep last 50
    
    // Calculate progress metrics
    const wasNearCompletionBefore = existingCurve.isNearCompletion;
    this.recalculateBondingCurveMetrics(existingCurve, tradesForThisToken);
    
    // Check for near completion warning (only fire once)
    if (existingCurve.isNearCompletion && !wasNearCompletionBefore && !existingCurve.isCompleted) {
      this.alertNearCompletionDetected(existingCurve);
    }
    
    this.activeBondingCurves.set(mint, existingCurve);
    
    // Queue trade event
    const tradeEvent: PumpFunEvent = {
      type: 'trade',
      timestamp: trade.timestamp,
      mint: trade.mint,
      data: trade,
      priority: existingCurve.isNearCompletion ? 'high' : 'normal',
      signature: trade.signature
    };
    
    this.addEventToProcessingQueue(tradeEvent);
    this.triggerThrottledUIUpdate();
  }
  */
  
  // DISABLED: Trade-dependent metric calculations since we're not processing trades
  /*
  private recalculateBondingCurveMetrics(curve: BondingCurveState, trades: TradeEvent[]) {
    // Completion progress based on real SOL reserves
    curve.completionProgress = Math.min(
      (curve.realSolReserves / this.SOL_REQUIRED_FOR_COMPLETION) * 100, 
      100
    );
    
    curve.isNearCompletion = curve.completionProgress >= this.NEAR_COMPLETION_THRESHOLD * 100;
    
    // Activity metrics from recent trades
    curve.totalTrades = trades.length;
    
    // 24h volume calculation
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const tradesInLast24Hours = trades.filter(t => t.timestamp.getTime() > twentyFourHoursAgo);
    curve.recentVolume24h = tradesInLast24Hours.reduce((sum, t) => sum + t.solAmount, 0);
    
    // Buy pressure (% of recent trades that are buys)
    const buyTradesInLast24Hours = tradesInLast24Hours.filter(t => t.isBuy);
    curve.buyPressure = tradesInLast24Hours.length > 0 ? 
      (buyTradesInLast24Hours.length / tradesInLast24Hours.length) * 100 : 0;
    
    // Average trade size
    curve.avgTradeSize = tradesInLast24Hours.length > 0 ?
      curve.recentVolume24h / tradesInLast24Hours.length : 0;
    
    // Estimate time to completion based on recent velocity
    if (curve.completionProgress < 100 && tradesInLast24Hours.length >= 5) {
      const solStillNeeded = this.SOL_REQUIRED_FOR_COMPLETION - curve.realSolReserves;
      const recentSolVelocityPerMinute = this.calculateRecentSolVelocity(tradesInLast24Hours);
      
      if (recentSolVelocityPerMinute > 0) {
        curve.estimatedTimeToCompletion = Math.ceil(solStillNeeded / recentSolVelocityPerMinute);
      }
    }
  }
  
  private calculateRecentSolVelocity(trades: TradeEvent[]): number {
    if (trades.length < 2) return 0;
    
    // Get trades from last 10 minutes
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const recentTrades = trades
      .filter(t => t.timestamp.getTime() > tenMinutesAgo)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (recentTrades.length < 2) return 0;
    
    const firstTradeInPeriod = recentTrades[0];
    const lastTradeInPeriod = recentTrades[recentTrades.length - 1];
    
    const solReservesIncrease = lastTradeInPeriod.realSolReserves - firstTradeInPeriod.realSolReserves;
    const timeDifferenceInMinutes = (lastTradeInPeriod.timestamp.getTime() - firstTradeInPeriod.timestamp.getTime()) / (1000 * 60);
    
    return timeDifferenceInMinutes > 0 ? solReservesIncrease / timeDifferenceInMinutes : 0;
  }
  
  private createBondingCurveFromFirstTrade(mint: string, firstTrade: TradeEvent): BondingCurveState {
    return {
      mint,
      virtualSolReserves: firstTrade.virtualSolReserves,
      virtualTokenReserves: firstTrade.virtualTokenReserves,
      realSolReserves: firstTrade.realSolReserves,
      realTokenReserves: firstTrade.realTokenReserves,
      completionProgress: 0,
      solRaisedTarget: this.SOL_REQUIRED_FOR_COMPLETION,
      isNearCompletion: false,
      totalTrades: 1,
      recentVolume24h: firstTrade.solAmount,
      buyPressure: firstTrade.isBuy ? 100 : 0,
      avgTradeSize: firstTrade.solAmount,
      createdAt: firstTrade.timestamp,
      lastActivity: firstTrade.timestamp,
      isActive: true,
      isCompleted: false
    };
  }
  */
  
  markBondingCurveAsCompleted(mint: string, completionEvent: CompleteEvent) {
    const completedCurve = this.activeBondingCurves.get(mint);
    if (completedCurve) {
      completedCurve.isCompleted = true;
      completedCurve.isActive = false;
      completedCurve.completionProgress = 100;
      
      console.log('🎯 🎯 🎯 BONDING CURVE COMPLETED! 🎯 🎯 🎯');
      console.log(`📋 Token: ${completedCurve.name || 'Unknown'} (${completedCurve.symbol || mint})`);
      console.log(`💰 Total SOL Raised: ${completedCurve.realSolReserves.toFixed(2)} SOL`);
      console.log(`📊 Total Trades: ${completedCurve.totalTrades}`);
      console.log(`⏱️  Time to Complete: ${this.formatTimeSpanToHumanReadable(completionEvent.timestamp.getTime() - completedCurve.createdAt.getTime())}`);
      console.log(`🔗 Now migrating to Raydium...`);
      
      this.activeBondingCurves.set(mint, completedCurve);
      
      // Queue completion event with high priority
      const completionEventForQueue: PumpFunEvent = {
        type: 'completion',
        timestamp: completionEvent.timestamp,
        mint: completionEvent.mint,
        data: completionEvent,
        priority: 'high',
        signature: completionEvent.signature
      };
      
      this.addEventToProcessingQueue(completionEventForQueue);
      this.triggerThrottledUIUpdate();
    }
  }
  
  private alertNearCompletionDetected(curve: BondingCurveState) {
    console.log('⚠️ 🚨 CURVE NEAR COMPLETION! 🚨 ⚠️');
    console.log(`📋 Token: ${curve.name || 'Unknown'} (${curve.symbol || curve.mint})`);
    console.log(`📊 Progress: ${curve.completionProgress.toFixed(1)}%`);
    console.log(`💰 SOL Raised: ${curve.realSolReserves.toFixed(2)}/${curve.solRaisedTarget} SOL`);
    // DISABLED: Trade-dependent metrics since we're not processing trades
    // console.log(`⏱️  Est. Time to Complete: ${curve.estimatedTimeToCompletion || 'Unknown'} minutes`);
    // console.log(`📈 Buy Pressure: ${curve.buyPressure.toFixed(1)}%`);
    
    // Queue near completion event with high priority
    const nearCompletionEvent: PumpFunEvent = {
      type: 'near_completion',
      timestamp: new Date(),
      mint: curve.mint,
      data: curve,
      priority: 'high',
      signature: ''
    };
    
    this.addEventToProcessingQueue(nearCompletionEvent);
  }
  
  private formatTimeSpanToHumanReadable(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  }
  
  private addEventToProcessingQueue(event: PumpFunEvent) {
    this.eventProcessingQueue.push(event);
    this.onNewEventDetected(event);
  }
  
  // Get curves sorted by completion progress
  getBondingCurvesSortedByProgress(): BondingCurveState[] {
    return Array.from(this.activeBondingCurves.values())
      .filter(c => c.isActive && !c.isCompleted)
      .sort((a, b) => b.completionProgress - a.completionProgress);
  }
  
  // DISABLED: Volume-based sorting since we're not processing trades
  /*
  // Get most active curves (by recent volume)
  getBondingCurvesSortedByVolume(limit: number = 10): BondingCurveState[] {
    return Array.from(this.activeBondingCurves.values())
      .filter(c => c.isActive && !c.isCompleted)
      .sort((a, b) => b.recentVolume24h - a.recentVolume24h)
      .slice(0, limit);
  }
  */
  
  // Get all active curves
  getAllActiveBondingCurves(): BondingCurveState[] {
    return Array.from(this.activeBondingCurves.values())
      .filter(c => c.isActive);
  }
  
  // Get near completion curves
  getBondingCurvesNearCompletion(): BondingCurveState[] {
    return Array.from(this.activeBondingCurves.values())
      .filter(c => c.isActive && !c.isCompleted && c.isNearCompletion)
      .sort((a, b) => b.completionProgress - a.completionProgress);
  }
  
  // Get queued events and clear queue
  getAllQueuedEventsAndClear(): PumpFunEvent[] {
    const allEvents = [...this.eventProcessingQueue];
    this.eventProcessingQueue = [];
    return allEvents;
  }
  
  // Get high priority events
  getHighPriorityQueuedEvents(): PumpFunEvent[] {
    return this.eventProcessingQueue.filter(e => e.priority === 'high');
  }
  
  // Clear all data
  resetAllData() {
    this.activeBondingCurves.clear();
    // DISABLED: this.recentTradesByToken.clear();
    this.eventProcessingQueue = [];
  }
  
  // Get curve by mint
  getBondingCurveByMint(mint: string): BondingCurveState | undefined {
    return this.activeBondingCurves.get(mint);
  }
}

export const usePumpProgram = () => {
  const { connected } = useWallet();
  
  // Connection state
  const [solanaConnection, setSolanaConnection] = useState<Connection | null>(null);
  const [isPumpMonitoringActive, setIsPumpMonitoringActive] = useState(false);
  
  // Event data (existing)
  const [detectedTokenLaunches, setDetectedTokenLaunches] = useState<TokenLaunch[]>([]);
  const [detectedTrades, setDetectedTrades] = useState<TradeEvent[]>([]);
  const [detectedCompletions, setDetectedCompletions] = useState<CompleteEvent[]>([]);
  
  // Enhanced curve monitoring
  const [activeBondingCurves, setActiveBondingCurves] = useState<BondingCurveState[]>([]);
  const [queuedPumpEvents, setQueuedPumpEvents] = useState<PumpFunEvent[]>([]);
  const [bondingCurvesNearCompletion, setBondingCurvesNearCompletion] = useState<BondingCurveState[]>([]);
  // DISABLED: Volume-based curves since we're not processing trades
  // const [highVolumeBondingCurves, setHighVolumeBondingCurves] = useState<BondingCurveState[]>([]);

  // Stats and monitoring - CHANGED: Remove separate counters, calculate from arrays
  const [monitoringStatistics, setMonitoringStatistics] = useState<PumpMonitoringStats>({
    isConnected: false,
    isMonitoring: false,
    launchesDetected: 0,  // Will be calculated from detectedTokenLaunches.length
    tradesDetected: 0,    // Will be calculated from detectedTrades.length  
    completionsDetected: 0, // Will be calculated from detectedCompletions.length
    uptime: 0,
    lastEventTime: null
  });

  // ADDED: Calculate real-time stats from actual data arrays
  const calculateRealTimeStatistics = useCallback(() => {
    setMonitoringStatistics((prev: PumpMonitoringStats) => ({
      ...prev,
      launchesDetected: detectedTokenLaunches.length,
      tradesDetected: detectedTrades.length,
      completionsDetected: detectedCompletions.length
    }));
  }, [detectedTokenLaunches.length, detectedTrades.length, detectedCompletions.length]);

  // ADDED: Update stats whenever data arrays change
  useEffect(() => {
    calculateRealTimeStatistics();
  }, [calculateRealTimeStatistics]);
  
  // Refs for cleanup
  const logsSubscriptionRef = useRef<number | null>(null);
  const monitoringStartTimeRef = useRef<Date | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bondingCurveMonitorRef = useRef<PumpFunBondingCurveMonitor | null>(null);

  // Initialize curve monitor
  useEffect(() => {
    const handleNewEventDetected = (event: PumpFunEvent) => {
      setQueuedPumpEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
    };
    
    const handleBondingCurveStateUpdated = (curves: BondingCurveState[]) => {
      setActiveBondingCurves(curves);
      
      // Update derived states
      const curvesNearCompletion = curves
        .filter(c => c.isActive && !c.isCompleted && c.isNearCompletion)
        .sort((a, b) => b.completionProgress - a.completionProgress);
      setBondingCurvesNearCompletion(curvesNearCompletion);
      
      // DISABLED: High volume curves since we're not processing trades
      /*
      const highVolumeCurves = curves
        .filter(c => c.isActive && !c.isCompleted)
        .sort((a, b) => b.recentVolume24h - a.recentVolume24h)
        .slice(0, 10);
      setHighVolumeBondingCurves(highVolumeCurves);
      */
    };
    
    bondingCurveMonitorRef.current = new PumpFunBondingCurveMonitor(
      handleNewEventDetected,
      handleBondingCurveStateUpdated
    );
  }, []);

  // Initialize connection
  useEffect(() => {
    const establishSolanaConnection = async () => {
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
        
        const newConnection = new Connection(rpcUrl, {
          commitment: 'confirmed',
          wsEndpoint: wsUrl
        });
        
        // Test connection with timeout
        const connectionPromise = newConnection.getSlot();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        );
        
        const currentSlot = await Promise.race([connectionPromise, timeoutPromise]);
        console.log('🔥 Pump Monitor connected successfully');
        console.log(`📡 Current slot: ${currentSlot}`);
        console.log(`🎯 Monitoring program: ${PUMP_FUN_PROGRAM_ID.toString()}`);
        
        setSolanaConnection(newConnection);
        setMonitoringStatistics((prev: PumpMonitoringStats) => ({ ...prev, isConnected: true }));
      } catch (error) {
        console.error('❌ Failed to connect to Solana:', error);
        setMonitoringStatistics((prev: PumpMonitoringStats) => ({ ...prev, isConnected: false }));
      }
    };

    establishSolanaConnection();
    
    // Cleanup function to prevent WebSocket errors
    return () => {
      if (solanaConnection && logsSubscriptionRef.current) {
        try {
          solanaConnection.removeOnLogsListener(logsSubscriptionRef.current);
          logsSubscriptionRef.current = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
        uptimeIntervalRef.current = null;
      }
    };
  }, []);

  // Utility: Check if buffer has specific discriminator
  const bufferHasExpectedDiscriminator = useCallback((data: Buffer, discriminator: number[]): boolean => {
    if (data.length < 8) return false;
    for (let i = 0; i < 8; i++) {
      if (data[i] !== discriminator[i]) return false;
    }
    return true;
  }, []);

  // Decode CreateEvent from program logs
  const decodeTokenLaunchEvent = useCallback((data: Buffer, signature: string): TokenLaunch | null => {
    try {
      let offset = 8; // Skip 8-byte discriminator
      
      // Read name (string)
      const nameLength = data.readUInt32LE(offset);
      offset += 4;
      const name = data.subarray(offset, offset + nameLength).toString('utf8');
      offset += nameLength;
      
      // Read symbol (string)
      const symbolLength = data.readUInt32LE(offset);
      offset += 4;
      const symbol = data.subarray(offset, offset + symbolLength).toString('utf8');
      offset += symbolLength;
      
      // Read uri (string)
      const uriLength = data.readUInt32LE(offset);
      offset += 4;
      const uri = data.subarray(offset, offset + uriLength).toString('utf8');
      offset += uriLength;
      
      // Read mint (32 bytes)
      const mint = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read bonding curve (32 bytes)
      const bondingCurve = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read creator (32 bytes)
      const creator = new PublicKey(data.subarray(offset, offset + 32)).toString();
      
      return {
        mint,
        name,
        symbol,
        uri,
        bondingCurve,
        creator,
        timestamp: new Date(),
        signature
      };
    } catch (error) {
      console.error('Error decoding CreateEvent:', error);
      return null;
    }
  }, []);

  // Decode TradeEvent from program logs
  const decodeTokenTradeEvent = useCallback((data: Buffer, signature: string): TradeEvent | null => {
    try {
      let offset = 8; // Skip discriminator
      
      // Read mint (32 bytes)
      const mint = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read solAmount (8 bytes)
      const solAmount = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
      offset += 8;
      
      // Read tokenAmount (8 bytes)
      const tokenAmount = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      // Read isBuy (1 byte)
      const isBuy = data.readUInt8(offset) === 1;
      offset += 1;
      
      // Read user (32 bytes)
      const user = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read timestamp (8 bytes)
      const timestamp = new Date(Number(data.readBigInt64LE(offset)) * 1000);
      offset += 8;
      
      // Read virtualSolReserves (8 bytes)
      const virtualSolReserves = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
      offset += 8;
      
      // Read virtualTokenReserves (8 bytes)
      const virtualTokenReserves = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      // Read realSolReserves (8 bytes)
      const realSolReserves = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
      offset += 8;
      
      // Read realTokenReserves (8 bytes)
      const realTokenReserves = Number(data.readBigUInt64LE(offset));
      
      return {
        mint,
        solAmount,
        tokenAmount,
        isBuy,
        user,
        timestamp,
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
        signature
      };
    } catch (error) {
      console.error('Error decoding TradeEvent:', error);
      return null;
    }
  }, []);

  // Decode CompleteEvent from program logs
  const decodeBondingCurveCompletionEvent = useCallback((data: Buffer, signature: string): CompleteEvent | null => {
    try {
      let offset = 8; // Skip discriminator
      
      // Read user (32 bytes)
      const user = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read mint (32 bytes)
      const mint = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read bonding curve (32 bytes)
      const bondingCurve = new PublicKey(data.subarray(offset, offset + 32)).toString();
      offset += 32;
      
      // Read timestamp (8 bytes)
      const timestamp = new Date(Number(data.readBigInt64LE(offset)) * 1000);
      
      return {
        mint,
        bondingCurve,
        user,
        timestamp,
        signature
      };
    } catch (error) {
      console.error('Error decoding CompleteEvent:', error);
      return null;
    }
  }, []);

  // Process logs and extract events
  const processTransactionLogsForPumpEvents = useCallback((logs: any, signature: string) => {
    console.log(`📡 Processing transaction: ${signature}`);
    
    logs.logs.forEach((log: string) => {
      // Look for program data in logs
      if (log.includes('Program data:')) {
        const dataMatch = log.match(/Program data: ([A-Za-z0-9+/=]+)/);
        if (dataMatch) {
          try {
            const data = Buffer.from(dataMatch[1], 'base64');
            
            // Check for CreateEvent (Token Launch)
            if (bufferHasExpectedDiscriminator(data, CREATE_EVENT_DISCRIMINATOR)) {
              const launchEvent = decodeTokenLaunchEvent(data, signature);
              if (launchEvent) {
                console.log('🚀 🚀 🚀 NEW TOKEN LAUNCH DETECTED! 🚀 🚀 🚀');
                console.log(`🏷️  Name: ${launchEvent.name} (${launchEvent.symbol})`);
                console.log(`📋 CA: ${launchEvent.mint}`);
                console.log(`👤 Creator: ${launchEvent.creator}`);
                console.log(`🔗 Bonding Curve: ${launchEvent.bondingCurve}`);
                console.log(`📄 Metadata: ${launchEvent.uri}`);
                console.log(`🔗 Tx: https://solscan.io/tx/${signature}`);
                console.log(`🔍 Token: https://solscan.io/token/${launchEvent.mint}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                setDetectedTokenLaunches(prev => [launchEvent, ...prev.slice(0, 199)]); // Keep last 200
                setMonitoringStatistics((prev: PumpMonitoringStats) => ({ 
                  ...prev, 
                  lastEventTime: new Date()
                }));
                bondingCurveMonitorRef.current?.registerNewTokenLaunch(launchEvent);
              }
            }
            
            // DISABLED: TradeEvent processing (not used in frontend)
            /*
            // Check for TradeEvent
            else if (bufferHasExpectedDiscriminator(data, TRADE_EVENT_DISCRIMINATOR)) {
              const tradeEvent = decodeTokenTradeEvent(data, signature);
              if (tradeEvent) {
                console.log(`💰 ${tradeEvent.isBuy ? '🟢 BUY' : '🔴 SELL'} - ${tradeEvent.solAmount.toFixed(4)} SOL`);
                console.log(`📋 Token: ${tradeEvent.mint}`);
                console.log(`💎 Amount: ${tradeEvent.tokenAmount.toLocaleString()} tokens`);
                console.log(`👤 User: ${tradeEvent.user}`);
                console.log(`🔗 Tx: https://solscan.io/tx/${signature}`);
                
                setDetectedTrades(prev => [tradeEvent, ...prev.slice(0, 499)]); // Keep last 500
                setMonitoringStatistics((prev: PumpMonitoringStats) => ({ 
                  ...prev, 
                  lastEventTime: new Date()
                }));
                bondingCurveMonitorRef.current?.updateBondingCurveFromTrade(tradeEvent);
              }
            }
            */
            
            // Check for CompleteEvent (Bonding curve completion)
            else if (bufferHasExpectedDiscriminator(data, COMPLETE_EVENT_DISCRIMINATOR)) {
              const completionEvent = decodeBondingCurveCompletionEvent(data, signature);
              if (completionEvent) {
                console.log('🎯 🎯 🎯 BONDING CURVE COMPLETED! 🎯 🎯 🎯');
                console.log(`📋 Token: ${completionEvent.mint}`);
                console.log(`👤 Completed by: ${completionEvent.user}`);
                console.log(`🔗 Bonding Curve: ${completionEvent.bondingCurve}`);
                console.log(`🔗 Tx: https://solscan.io/tx/${signature}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                setDetectedCompletions(prev => [completionEvent, ...prev.slice(0, 99)]); // Keep last 100
                setMonitoringStatistics((prev: PumpMonitoringStats) => ({ 
                  ...prev, 
                  lastEventTime: new Date()
                }));
                bondingCurveMonitorRef.current?.markBondingCurveAsCompleted(completionEvent.mint, completionEvent);
              }
            }
          } catch (error) {
            console.error('Error processing log data:', error);
          }
        }
      }
    });
  }, [bufferHasExpectedDiscriminator, decodeTokenLaunchEvent, /* decodeTokenTradeEvent, */ decodeBondingCurveCompletionEvent]);

  // Start monitoring pump.fun program
  const startPumpFunMonitoring = useCallback(async () => {
    if (!solanaConnection || isPumpMonitoringActive) {
      console.warn('⚠️ Cannot start monitoring: connection not ready or already monitoring');
      return;
    }

    try {
      console.log('🔥 🔥 🔥 STARTING PUMP MONITOR 🔥 🔥 🔥');
      console.log(`📡 Program: ${PUMP_FUN_PROGRAM_ID.toString()}`);
      console.log(`🌐 Network: Solana Mainnet`);
      console.log(`🎯 Listening for: Token launches, completions (trades disabled)`);
      console.log(`📋 Console: Check here for real-time CA addresses!`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      setIsPumpMonitoringActive(true);
      monitoringStartTimeRef.current = new Date();
      
      // Start uptime counter
      uptimeIntervalRef.current = setInterval(() => {
        if (monitoringStartTimeRef.current) {
          const currentUptime = Math.floor((Date.now() - monitoringStartTimeRef.current.getTime()) / 1000);
          setMonitoringStatistics((prev: PumpMonitoringStats) => ({ ...prev, uptime: currentUptime, isMonitoring: true }));
        }
      }, 1000);

      // Subscribe to program logs
      logsSubscriptionRef.current = solanaConnection.onLogs(
        PUMP_FUN_PROGRAM_ID,
        (logs, context) => {
          try {
            processTransactionLogsForPumpEvents(logs, logs.signature);
          } catch (error) {
            console.error('❌ Error processing logs:', error);
          }
        },
        'confirmed'
      );

      console.log('✅ Monitoring started successfully!');
      console.log('🎯 Waiting for pump.fun activity...');
      
    } catch (error) {
      console.error('❌ Error starting monitoring:', error);
      setIsPumpMonitoringActive(false);
      setMonitoringStatistics((prev: PumpMonitoringStats) => ({ ...prev, isMonitoring: false }));
    }
  }, [solanaConnection, isPumpMonitoringActive, processTransactionLogsForPumpEvents]);

  // Stop monitoring
  const stopPumpFunMonitoring = useCallback(async () => {
    if (!solanaConnection || !isPumpMonitoringActive) return;

    try {
      if (logsSubscriptionRef.current !== null) {
        await solanaConnection.removeOnLogsListener(logsSubscriptionRef.current);
        logsSubscriptionRef.current = null;
      }
      
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
        uptimeIntervalRef.current = null;
      }
      
      setIsPumpMonitoringActive(false);
      setMonitoringStatistics((prev: PumpMonitoringStats) => ({ ...prev, isMonitoring: false }));
      monitoringStartTimeRef.current = null;
      
      console.log('🛑 Monitoring stopped');
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  }, [solanaConnection, isPumpMonitoringActive]);

  // Clear all data
  const clearAllMonitoringData = useCallback(() => {
    setDetectedTokenLaunches([]);
    setDetectedTrades([]);
    setDetectedCompletions([]);
    setActiveBondingCurves([]);
    setQueuedPumpEvents([]);
    setBondingCurvesNearCompletion([]);
    // DISABLED: setHighVolumeBondingCurves([]);
    setMonitoringStatistics((prev: PumpMonitoringStats) => ({
      ...prev,
      uptime: 0,
      lastEventTime: null
      // REMOVED: Manual counter resets - they're now calculated automatically from array lengths
    }));
    bondingCurveMonitorRef.current?.resetAllData();
    console.log('🗑️ All monitoring data cleared');
  }, []);

  // Enhanced utility functions for curve monitoring
  const getBondingCurvesSortedByProgress = useCallback(() => {
    return bondingCurveMonitorRef.current?.getBondingCurvesSortedByProgress() || [];
  }, []);

  // DISABLED: Volume-based sorting since we're not processing trades
  /*
  const getBondingCurvesSortedByVolume = useCallback((limit: number = 10) => {
    return bondingCurveMonitorRef.current?.getBondingCurvesSortedByVolume(limit) || [];
  }, []);
  */

  const getBondingCurvesNearCompletion = useCallback(() => {
    return bondingCurveMonitorRef.current?.getBondingCurvesNearCompletion() || [];
  }, []);

  const getBondingCurveProgressByMint = useCallback((mint: string) => {
    return bondingCurveMonitorRef.current?.getBondingCurveByMint(mint);
  }, []);

  const getAllQueuedEventsAndClear = useCallback(() => {
    return bondingCurveMonitorRef.current?.getAllQueuedEventsAndClear() || [];
  }, []);

  const getHighPriorityQueuedEvents = useCallback(() => {
    return bondingCurveMonitorRef.current?.getHighPriorityQueuedEvents() || [];
  }, []);

  // Process events immediately, queue for MQ async (optimized for minimal latency)
  const processEventImmediatelyForLatency = useCallback((event: PumpFunEvent) => {
    // 1. Log to console immediately (current approach)
    console.log(`🚀 CA: ${event.mint}`);
    
    // 2. Queue for MQ (non-blocking) - this could be used for external integrations
    // eventQueue.push(event);
    
    // 3. Update UI state - already handled by the curve monitor callbacks
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (logsSubscriptionRef.current && solanaConnection) {
        solanaConnection.removeOnLogsListener(logsSubscriptionRef.current);
      }
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
      bondingCurveMonitorRef.current?.resetAllData();
    };
  }, [solanaConnection]);

  return {
    // Connection state
    connection: solanaConnection,
    isConnected: monitoringStatistics.isConnected,
    isMonitoring: isPumpMonitoringActive,
    
    // Program info
    programId: PUMP_FUN_PROGRAM_ID,
    
    // Event data (existing)
    launches: detectedTokenLaunches,
    // DISABLED: Trades since we're not processing them anymore
    // trades: detectedTrades,
    completions: detectedCompletions,
    
    // Enhanced curve monitoring
    activeCurves: activeBondingCurves,
    queuedEvents: queuedPumpEvents,
    nearCompletionCurves: bondingCurvesNearCompletion,
    // DISABLED: Volume-based curves since we're not processing trades
    // hotCurves: highVolumeBondingCurves,
    
    // Stats
    stats: monitoringStatistics,
    
    // Control functions
    startMonitoring: startPumpFunMonitoring,
    stopMonitoring: stopPumpFunMonitoring,
    clearData: clearAllMonitoringData,
    
    // Enhanced curve monitoring functions
    getCurvesByProgress: getBondingCurvesSortedByProgress,
    // DISABLED: Volume-based sorting since we're not processing trades
    // getMostActiveCurves: getBondingCurvesSortedByVolume,
    getNearCompletionCurves: getBondingCurvesNearCompletion,
    getCurveProgress: getBondingCurveProgressByMint,
    getQueuedEvents: getAllQueuedEventsAndClear,
    getHighPriorityEvents: getHighPriorityQueuedEvents,
    processEventImmediate: processEventImmediatelyForLatency,
    
    // Utility functions
    hasDiscriminator: bufferHasExpectedDiscriminator,
    decodeCreateEvent: decodeTokenLaunchEvent,
    decodeTradeEvent: decodeTokenTradeEvent,
    decodeCompleteEvent: decodeBondingCurveCompletionEvent
  };
}; 
