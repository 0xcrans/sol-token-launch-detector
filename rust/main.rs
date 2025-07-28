use anyhow::Result;
use std::env;
use tokio;
use tracing::info;
use tracing_subscriber;

mod types;
mod pump_monitor;
mod raydium_launchpad_monitor;

use pump_monitor::PumpFunMonitor;
use raydium_launchpad_monitor::RaydiumBuyMonitor;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if it exists
    let _ = dotenv::dotenv();
    
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    // Get WebSocket URL from environment variable
    let ws_url = env::var("SOLANA_WS_URL")
        .unwrap_or_else(|_| "wss://api.mainnet-beta.solana.com".to_string());
    
    info!("🚀 Starting Blazing Monitor - Enhanced Edition (Optimized)");
    info!("🔗 WebSocket URL: {}", mask_url(&ws_url));
    
    // Show which API provider we're using
    if ws_url.contains("helius-rpc.com") {
        info!("🚀 Using Helius WebSocket for enhanced performance");
    } else if ws_url.contains("api.mainnet-beta.solana.com") {
        info!("⚠️  Using public Solana WebSocket (consider upgrading to Helius for better performance)");
    } else {
        info!("🔗 Using custom WebSocket endpoint");
    }
    
    info!("🔥 Starting dual monitoring (OPTIMIZED VERSION):");
    info!("🎯 Pump.fun: Listening for CreateEvent");
    info!("🛒 Raydium LaunchPad: Listening for BUY transactions ONLY (Lower resource usage)");
    
    // Create both monitors
    let mut pump_monitor = PumpFunMonitor::new(&ws_url).await?;
    let mut raydium_monitor = RaydiumBuyMonitor::new(&ws_url).await?;
    
    // Run both monitors concurrently
    let pump_handle = tokio::spawn(async move {
        if let Err(e) = pump_monitor.start_monitoring().await {
            tracing::error!("❌ Pump.fun monitor error: {}", e);
        }
    });
    
    let raydium_handle = tokio::spawn(async move {
        if let Err(e) = raydium_monitor.start_monitoring().await {
            tracing::error!("❌ Raydium LaunchPad monitor error: {}", e);
        }
    });
    
    // Wait for both tasks (they run indefinitely unless there's an error)
    tokio::select! {
        _ = pump_handle => {
            info!("🔥 Pump.fun monitor task completed");
        }
        _ = raydium_handle => {
            info!("🌟 Raydium LaunchPad monitor task completed");
        }
    }
    
    Ok(())
}

fn mask_url(url: &str) -> String {
    if url.contains("api-key=") {
        let parts: Vec<&str> = url.split("api-key=").collect();
        if parts.len() == 2 {
            return format!("{}api-key=***masked***", parts[0]);
        }
    }
    url.to_string()
}