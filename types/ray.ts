/**
 * Raydium Launchpad Types - SIMPLIFIED FOR MINTPARAMS
 * Focus: New token launches with full parameters
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
// DISCRIMINATORS - SIMPLIFIED
// ========================================================================

// Raydium AMM V4 discriminators
export const RAYDIUM_DISCRIMINATORS = {
  initialize2: new Uint8Array([95, 180, 51, 37, 242, 152, 191, 43]),
  initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237])
} as const;

// CP Swap discriminators
export const CP_SWAP_DISCRIMINATORS = {
  createPool: new Uint8Array([233, 146, 209, 142, 207, 104, 64, 188])
} as const;

// Raydium Launchpad discriminators - ONLY WHAT WE NEED
export const LAUNCHPAD_DISCRIMINATORS = {
  // 🎯 MAIN TARGET - New token launches
  initialize: new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
  
  // Trading (for silent ignoring)
  buy_exact_in: new Uint8Array([250, 234, 13, 123, 213, 156, 19, 236]),
  sell_exact_in: new Uint8Array([149, 39, 222, 155, 211, 124, 152, 26])
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
// TOKEN LAUNCH EVENT - SIMPLIFIED
// ========================================================================

export interface TokenLaunchEvent {
  poolId: string;
  tokenA: string;       // New token
  tokenB: string;       // SOL/USDC
  lpMint: string;
  creator: string;
  timestamp: Date;
  signature: string;
  type: 'initialize2' | 'createPool' | 'launchpad_initialize';
  program: 'AMM_V4' | 'CP_SWAP' | 'LAUNCHPAD';
  isTokenLaunch: boolean;
  initialLiquiditySOL?: number;
  
  // 🎯 MAIN FOCUS: Token parameters from MintParams
  mintParams?: MintParams;
  curveParams?: CurveParams;
  vestingParams?: VestingParams;
  
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
// MONITORING STATS - SIMPLIFIED
// ========================================================================

export interface MonitoringStats {
  isConnected: boolean;
  isMonitoring: boolean;
  poolsDetected: number;
  tokenLaunchesDetected: number;
  uptime: number;
  lastTokenLaunch: Date | null;
}

// ========================================================================
// LAUNCHPAD EVENT TYPES - MINIMAL
// ========================================================================

// Basic launchpad types (keep for compatibility)
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
// HELPER FUNCTIONS
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