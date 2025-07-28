use anyhow::Result;
use solana_sdk::pubkey::Pubkey;
use std::collections::HashSet;
use tokio::time::{sleep, Duration};
use tracing::{info, error, warn};
use base64::{Engine as _, engine::general_purpose};
use serde_json::{json, Value};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};

use crate::types::{TokenLaunch, Platform, PUMP_CREATE_EVENT_DISCRIMINATOR, PUMP_FUN_PROGRAM_ID};

pub struct PumpFunMonitor {
    ws_url: String,
    processed_signatures: HashSet<String>,
}

impl PumpFunMonitor {
    pub async fn new(ws_url: &str) -> Result<Self> {
        // Convert HTTP URL to WebSocket URL if needed
        let ws_url = if ws_url.starts_with("wss://") || ws_url.starts_with("ws://") {
            ws_url.to_string()
        } else {
            // HTTP URL provided, derive WebSocket URL
            if ws_url.contains("helius-rpc.com") {
                ws_url.replace("https://", "wss://")
            } else {
                ws_url.replace("https://", "wss://").replace("http://", "ws://")
            }
        };
        
        info!("🔥 Pump.fun monitor initialized for WebSocket monitoring");
        
        Ok(Self {
            ws_url,
            processed_signatures: HashSet::new(),
        })
    }

    pub async fn start_monitoring(&mut self) -> Result<()> {
        info!("🎯 Starting Pump.fun WebSocket real-time monitoring");
        
        loop {
            match self.start_websocket_monitoring().await {
                Ok(_) => {
                    info!("🔄 WebSocket connection ended, reconnecting...");
                },
                Err(e) => {
                    error!("❌ WebSocket error: {}", e);
                    info!("🔄 Reconnecting in 5 seconds...");
                    sleep(Duration::from_secs(5)).await;
                }
            }
            
            sleep(Duration::from_secs(1)).await; // Brief pause before reconnect
        }
    }

    async fn start_websocket_monitoring(&mut self) -> Result<()> {
        info!("🔌 Connecting to WebSocket: {}", mask_ws_url(&self.ws_url));
        
        // Use direct string connection to avoid Url parsing compatibility issues
        let (ws_stream, _) = connect_async(&self.ws_url).await?;
        let (mut write, mut read) = ws_stream.split();
        
        // Subscribe to program logs for Pump.fun
        let subscription_request = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "logsSubscribe",
            "params": [
                {
                    "mentions": [PUMP_FUN_PROGRAM_ID]
                },
                {
                    "commitment": "confirmed"
                }
            ]
        });
        
        write.send(Message::Text(subscription_request.to_string())).await?;
        info!("✅ Subscribed to Pump.fun program logs");
        
        // Process incoming messages
        while let Some(message) = read.next().await {
            match message? {
                Message::Text(text) => {
                    if let Err(e) = self.process_websocket_message(&text).await {
                        warn!("⚠️ Error processing WebSocket message: {}", e);
                    }
                },
                Message::Close(_) => {
                    info!("🔌 WebSocket connection closed");
                    break;
                },
                _ => {} // Ignore other message types
            }
        }
        
        Ok(())
    }

    async fn process_websocket_message(&mut self, message: &str) -> Result<()> {
        let data: Value = serde_json::from_str(message)?;
        
        // Handle subscription confirmation
        if let Some(result) = data.get("result") {
            if result.is_number() {
                info!("✅ WebSocket subscription confirmed with ID: {}", result);
                return Ok(());
            }
        }
        
        // Handle log notifications
        if let Some(params) = data.get("params") {
            if let Some(result) = params.get("result") {
                if let Some(value) = result.get("value") {
                    if let Some(signature) = value.get("signature").and_then(|s| s.as_str()) {
                        if let Some(logs) = value.get("logs").and_then(|l| l.as_array()) {
                            
                            // Skip if already processed
                            if self.processed_signatures.contains(signature) {
                                return Ok(());
                            }
                            
                            // Look for Program data in logs (CreateEvent)
                            for log in logs {
                                if let Some(log_str) = log.as_str() {
                                    if let Some(token_launch) = self.parse_create_event_from_log(log_str, signature.to_string())? {
                                        self.handle_token_launch(token_launch).await;
                                        self.processed_signatures.insert(signature.to_string());
                                        
                                        // Keep memory usage manageable
                                        if self.processed_signatures.len() > 1000 {
                                            let recent: Vec<String> = self.processed_signatures
                                                .iter().skip(500).cloned().collect();
                                            self.processed_signatures.clear();
                                            self.processed_signatures.extend(recent);
                                        }
                                        
                                        return Ok(());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    fn parse_create_event_from_log(&self, log: &str, signature: String) -> Result<Option<TokenLaunch>> {
        // Look for "Program data:" in logs
        if log.contains("Program data:") {
            if let Some(data_part) = log.split("Program data: ").nth(1) {
                if let Ok(data) = general_purpose::STANDARD.decode(data_part.trim()) {
                    // Check for CreateEvent discriminator
                    if data.len() >= 8 && data[0..8] == PUMP_CREATE_EVENT_DISCRIMINATOR {
                        return Ok(Some(self.decode_create_event(&data, signature)?));
                    }
                }
            }
        }
        Ok(None)
    }

    fn decode_create_event(&self, data: &[u8], signature: String) -> Result<TokenLaunch> {
        let mut offset = 8; // Skip discriminator

        // Safely read name (string)
        if offset + 4 > data.len() { return Err(anyhow::anyhow!("Invalid data length for name")); }
        let name_length = u32::from_le_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;
        
        if offset + name_length > data.len() { return Err(anyhow::anyhow!("Invalid name length")); }
        let name = String::from_utf8(data[offset..offset + name_length].to_vec())?;
        offset += name_length;

        // Safely read symbol (string)
        if offset + 4 > data.len() { return Err(anyhow::anyhow!("Invalid data length for symbol")); }
        let symbol_length = u32::from_le_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;
        
        if offset + symbol_length > data.len() { return Err(anyhow::anyhow!("Invalid symbol length")); }
        let symbol = String::from_utf8(data[offset..offset + symbol_length].to_vec())?;
        offset += symbol_length;

        // Skip URI
        if offset + 4 > data.len() { return Err(anyhow::anyhow!("Invalid data length for URI")); }
        let uri_length = u32::from_le_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4 + uri_length;

        // Read mint (32 bytes)
        if offset + 32 > data.len() { return Err(anyhow::anyhow!("Invalid data length for mint")); }
        let mint_bytes: [u8; 32] = data[offset..offset + 32].try_into()?;
        let mint = Pubkey::new_from_array(mint_bytes);
        offset += 32;

        // Skip bonding curve (32 bytes)
        offset += 32;

        // Read creator (32 bytes)
        if offset + 32 > data.len() { return Err(anyhow::anyhow!("Invalid data length for creator")); }
        let creator_bytes: [u8; 32] = data[offset..offset + 32].try_into()?;
        let creator = Pubkey::new_from_array(creator_bytes);

        Ok(TokenLaunch {
            contract_address: mint.to_string(),
            name: Some(name),
            symbol: Some(symbol),
            creator: Some(creator.to_string()),
            signature,
            platform: Platform::PumpFun,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs(),
        })
    }

    async fn handle_token_launch(&self, launch: TokenLaunch) {
        // 🎯 MAIN REQUIREMENT: Print CA to console
        println!("CA: {}", launch.contract_address);
        
        // Additional detailed logging
        info!(
            "🚀 [{}] {} ({}) | CA: {} | Creator: {} | TX: {}", 
            launch.platform,
            launch.name.as_deref().unwrap_or("Unknown"),
            launch.symbol.as_deref().unwrap_or("???"),
            launch.contract_address,
            launch.creator.as_deref().unwrap_or("Unknown"),
            &launch.signature[..8]
        );
    }
}

fn mask_ws_url(url: &str) -> String {
    if url.contains("api-key=") {
        let parts: Vec<&str> = url.split("api-key=").collect();
        if parts.len() == 2 {
            return format!("{}api-key=***masked***", parts[0]);
        }
    }
    url.to_string()
}