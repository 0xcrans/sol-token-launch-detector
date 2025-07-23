/**
 * Main Types Export - SIMPLIFIED FOR MINTPARAMS
 * Centralized export of essential application types
 */

// Export Raydium types (MintParams focus)
export type {
  TokenLaunchEvent,
  MonitoringStats as RaydiumMonitoringStats,
  LaunchpadLivePoolState,
  // Launchpad event types (simplified)
  LaunchpadTokenLaunch,
  LaunchpadTradeEvent,
  LaunchpadMigrationEvent,
  LaunchpadEvent,
  LaunchpadPoolStatus,
  LaunchpadMonitoringStats,
  // MintParams types (core focus)
  MintParams,
  CurveParams,
  VestingParams
} from './ray';

// Export essential discriminators and helpers
export {
  RAYDIUM_PROGRAMS,
  RAYDIUM_DISCRIMINATORS,
  CP_SWAP_DISCRIMINATORS,
  LAUNCHPAD_DISCRIMINATORS,
  hasDiscriminator,
  isTokenLaunch,
  COMMON_TOKENS
} from './ray';

// Export pump.fun types
export type {
  MonitoringStats as PumpMonitoringStats,
  PumpFun,
  TokenLaunch,
  TradeEvent,
  CompleteEvent,
  BondingCurveState,
  PumpFunEvent,
  CurveMetrics
} from './pump';

export {
  PUMP_CREATE_EVENT_DISCRIMINATOR,
  PUMP_TRADE_EVENT_DISCRIMINATOR,
  PUMP_COMPLETE_EVENT_DISCRIMINATOR
} from './pump';

// Re-export other pump types (selectively to avoid conflicts)
// Add specific exports as needed