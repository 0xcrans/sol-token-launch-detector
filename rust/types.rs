use serde::{Deserialize, Serialize};

// ========================================================================
// BASIC TOKEN LAUNCH TYPES
// ========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenLaunch {
    pub contract_address: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub creator: Option<String>,
    pub signature: String,
    pub platform: Platform,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Platform {
    PumpFun,
    Raydium,
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Platform::PumpFun => write!(f, "PUMP"),
            Platform::Raydium => write!(f, "RAYDIUM"),
        }
    }
}

// ========================================================================
// ESSENTIAL DISCRIMINATORS & PROGRAM IDS
// ========================================================================

// Pump.fun discriminator
pub const PUMP_CREATE_EVENT_DISCRIMINATOR: [u8; 8] = [27, 114, 169, 77, 222, 235, 99, 118];

// Program IDs
pub const PUMP_FUN_PROGRAM_ID: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Raydium LaunchLab program ID (poprawny!)
pub const RAYDIUM_PROGRAM_ID: &str = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";