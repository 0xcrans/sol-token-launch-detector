/**
 * UPDATED: Raydium Launchpad Types z dwoma discriminatorami
 * Focus: Hybrid approach - program logs + selective getTransaction
 */

// ========================================================================
// RAYDIUM PROGRAM IDS
// ========================================================================

export const RAYDIUM_PROGRAMS = {
  // Classic AMM V4
  AMM_V4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  
  // Constant Product AMM (CP)
  CP_SWAP: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  
  // Raydium Launchpad - NEW TOKEN LAUNCHES
  LAUNCHPAD: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"
} as const;

// ========================================================================
// UPDATED: Dual discriminator strategy - initialize + buy_exact_in
// ========================================================================

// Raydium AMM V4 discriminators (dla referencji)
export const RAYDIUM_DISCRIMINATORS = {
  initialize2: new Uint8Array([95, 180, 51, 37, 242, 152, 191, 43]),
  initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237])
} as const;

// CP Swap discriminators (dla referencji)
export const CP_SWAP_DISCRIMINATORS = {
  createPool: new Uint8Array([233, 146, 209, 142, 207, 104, 64, 188])
} as const;

// 🎯 UPDATED: Launchpad discriminators z dwoma kluczowymi instrukcjami
export const LAUNCHPAD_DISCRIMINATORS = {
  // 🎯 GŁÓWNY TARGET - nowy token launch (tworzenie poola z tokenem)
  initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
  
  // 🎯 AKTYWNOŚĆ - pierwsze zakupy mogą sygnalizować nowe tokeny
  buy_exact_in: new Uint8Array([250, 234, 13, 123, 213, 156, 19, 236]),
  
  // Dodatkowe instrukcje trading (dla kompletności)
  sell_exact_in: new Uint8Array([149, 39, 222, 155, 211, 124, 152, 26]),
  buy_exact_out: new Uint8Array([24, 211, 116, 40, 105, 3, 153, 56]),
  sell_exact_out: new Uint8Array([164, 192, 149, 89, 202, 47, 54, 152])
} as const;

// ========================================================================
// TOKEN CONSTANTS
// ========================================================================

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export const COMMON_TOKENS = {
  SOL: SOL_MINT,
  USDC: USDC_MINT,
  USDT: USDT_MINT
} as const;

export const COMMON_TOKENS_SET = new Set([SOL_MINT, USDC_MINT, USDT_MINT]);

// ========================================================================
// MINT PARAMS - CORE FOCUS
// ========================================================================

// MintParams structure from Raydium Launchpad IDL
export interface MintParams {
  decimals: number;    // u8 - Number of decimal places for the token
  name: string;        // Token name
  symbol: string;      // Token symbol/ticker
  uri: string;         // URI pointing to token metadata (JSON)
}

// Optional curve parameters
export interface CurveParams {
  curveType: number;   // 0: ConstantProduct, etc.
  virtualBase: bigint; // Virtual base amount
  virtualQuote: bigint; // Virtual quote amount
  supply: bigint;      // Total token supply
}

// Optional vesting parameters
export interface VestingParams {
  startTime: bigint;   // When vesting starts
  endTime: bigint;     // When vesting ends
  totalAmount: bigint; // Total amount to vest
}

// ========================================================================
// ENHANCED: Hybrid detection types
// ========================================================================

export interface LaunchpadActivity {
  signature: string;
  timestamp: Date;
  activityType: 'initialize' | 'buy_exact_in' | 'sell_exact_in' | 'first_trade';
  tokenAddress?: string;
  poolAddress?: string;
  userAddress?: string;
  amount?: number;
  mintParams?: MintParams;
  detectionMethod: 'program_logs' | 'full_transaction';
}

export interface TokenLaunchDetection {
  signature: string;
  timestamp: Date;
  detectionMethod: 'initialize_logs' | 'buy_exact_in_logs' | 'full_transaction';
  hasCompleteData: boolean;
  tokenAddress?: string;
  mintParams?: MintParams;
  needsFollowUp: boolean; // czy potrzeba getTransaction dla pełnych danych
  priority: 'high' | 'medium' | 'low'; // priorytet dla RPC queue
}

// ========================================================================
// TOKEN LAUNCH EVENT - ENHANCED FOR HYBRID APPROACH
// ========================================================================

export interface TokenLaunchEvent {
  poolId: string;
  tokenA: string;       // New token (może być 'detecting...' initially)
  tokenB: string;       // SOL/USDC
  lpMint: string;
  creator: string;      // może być 'detecting...' initially
  timestamp: Date;
  signature: string;
  type: 'initialize2' | 'createPool' | 'launchpad_initialize';
  program: 'AMM_V4' | 'CP_SWAP' | 'LAUNCHPAD';
  isTokenLaunch: boolean;
  initialLiquiditySOL?: number;
  
  // 🎯 MAIN FOCUS: Token parameters from MintParams (available immediately from logs)
  mintParams?: MintParams;
  curveParams?: CurveParams;
  vestingParams?: VestingParams;
  
  // 🎯 NEW: Detection metadata
  detectionMethod?: 'program_logs' | 'full_transaction' | 'hybrid';
  hasCompleteData?: boolean; // czy wszystkie dane są wypełnione
  isUpdating?: boolean; // czy czeka na async update z getTransaction
  
  // Legacy compatibility fields
  tokenMint?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  tokenUri?: string;
  isNewToken?: boolean;
  createdAt?: Date;
  lifetime?: number;
}

// ========================================================================
// MONITORING STATS - ENHANCED
// ========================================================================

export interface MonitoringStats {
  isConnected: boolean;
  isMonitoring: boolean;
  poolsDetected: number;
  tokenLaunchesDetected: number;
  uptime: number;
  lastTokenLaunch: Date | null;
  
  // 🎯 NEW: Performance stats
  rpcCallsThisSession?: number;
  rpcQueueSize?: number;
  successfulDetections?: number;
  failedDetections?: number;
}

// ========================================================================
// LAUNCHPAD EVENT TYPES - MINIMAL (zachowane dla compatibility)
// ========================================================================

export interface LaunchpadTokenLaunch {
  poolState: string;
  baseMint: string;
  quoteMint: string;
  creator: string;
  timestamp: Date;
  signature: string;
  type: 'launchpad_initialize';
  program: 'LAUNCHPAD';
  isTokenLaunch: boolean;
  isNewToken: boolean;
}

export interface LaunchpadTradeEvent {
  poolState: string;
  trader: string;
  tokenMint: string;
  isBuy: boolean;
  timestamp: Date;
  signature: string;
}

export interface LaunchpadMigrationEvent {
  poolState: string;
  tokenMint: string;
  timestamp: Date;
  signature: string;
}

export interface LaunchpadPoolStatus {
  poolState: string;
  tokenMint: string;
  status: 'active' | 'completed' | 'migrated';
  launchedAt: Date;
}

export interface LaunchpadLivePoolState {
  poolId: string;
  baseTokenReserve: bigint;
  quoteTokenReserve: bigint;
  timestamp: Date;
  signature: string;
  isHighLiquidity?: boolean;
  isLargeSupply?: boolean;
}

export interface LaunchpadMonitoringStats {
  launchesDetected: number;
  tradesDetected: number;
  migrationsDetected: number;
  activePools: number;
  nearMigrationPools: number;
  totalVolumeSOL: number;
  volume24hSOL: number;
  avgTimeToFirstTrade: number;
  avgTimeToMigration: number;
}

// Union type for events
export type LaunchpadEvent = 
  | LaunchpadTokenLaunch 
  | LaunchpadTradeEvent 
  | LaunchpadMigrationEvent 
  | LaunchpadLivePoolState;

// ========================================================================
// ENHANCED HELPER FUNCTIONS
// ========================================================================

export function hasDiscriminator(data: Buffer | Uint8Array, discriminator: Uint8Array): boolean {
  if (data.length < discriminator.length) return false;
  
  for (let i = 0; i < discriminator.length; i++) {
    if (data[i] !== discriminator[i]) return false;
  }
  return true;
}

export function isTokenLaunch(tokenA: string, tokenB: string): boolean {
  // Check if one token is common (SOL/USDC), other is new
  const aIsCommon = COMMON_TOKENS_SET.has(tokenA);
  const bIsCommon = COMMON_TOKENS_SET.has(tokenB);
  
  // Token launch = one token is common, other is not
  return (aIsCommon && !bIsCommon) || (!aIsCommon && bIsCommon);
}

/**
 * 🎯 NEW: Determine if instruction is token-related
 */
export function isTokenRelatedInstruction(discriminator: Uint8Array): boolean {
  return (
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.initialize) ||
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.buy_exact_in) ||
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.sell_exact_in)
  );
}

/**
 * 🎯 NEW: Get instruction type from discriminator
 */
export function getInstructionType(discriminator: Uint8Array): string {
  if (hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.initialize)) {
    return 'initialize';
  }
  if (hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.buy_exact_in)) {
    return 'buy_exact_in';
  }
  if (hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.sell_exact_in)) {
    return 'sell_exact_in';
  }
  if (hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.buy_exact_out)) {
    return 'buy_exact_out';
  }
  if (hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.sell_exact_out)) {
    return 'sell_exact_out';
  }
  return 'unknown';
}

/**
 * 🎯 NEW: Check if discriminator indicates new token launch
 */
export function isNewTokenLaunchInstruction(discriminator: Uint8Array): boolean {
  return hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.initialize);
}

/**
 * 🎯 NEW: Check if discriminator indicates trading activity
 */
export function isTradingInstruction(discriminator: Uint8Array): boolean {
  return (
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.buy_exact_in) ||
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.sell_exact_in) ||
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.buy_exact_out) ||
    hasDiscriminator(discriminator, LAUNCHPAD_DISCRIMINATORS.sell_exact_out)
  );
} 
