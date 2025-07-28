use anyhow::Result;
use std::collections::HashSet;
use tokio::time::{sleep, Duration, timeout, Instant};
use tracing::{info, error, warn, debug};
use serde_json::{json, Value};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;

use crate::types::{RAYDIUM_PROGRAM_ID};

// ONLY BUY instructions discriminators
const BUY_EXACT_IN_DISCRIMINATOR: [u8; 8] = [250, 234, 13, 123, 213, 156, 19, 236];
const BUY_EXACT_OUT_DISCRIMINATOR: [u8; 8] = [24, 211, 116, 40, 105, 3, 153, 56];

// Raydium LaunchPad Authority
const RAYDIUM_LAUNCHPAD_AUTHORITY: &str = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";

// 🎯 OPTIMIZED SETTINGS - Less aggressive monitoring
const FETCH_DELAY_MS: u64 = 800;  // Increased from 200ms to 800ms
const REQUEST_TIMEOUT_SECS: u64 = 5;  // Reduced from 10s to 5s  
const MIN_TIME_BETWEEN_FETCHES_MS: u64 = 500;  // Minimum time between any HTTP requests
const MAX_PENDING_FETCHES: usize = 3;  // Limit concurrent fetches

pub struct RaydiumBuyMonitor {
    ws_url: String,
    rpc_url: String,
    http_client: Client,
    processed_signatures: HashSet<String>,
    seen_mints: HashSet<String>,
    last_fetch_time: Option<Instant>,
    pending_fetches: usize,
}

impl RaydiumBuyMonitor {
    pub async fn new(ws_url: &str) -> Result<Self> {
        let ws_url = if ws_url.starts_with("wss://") || ws_url.starts_with("ws://") {
            ws_url.to_string()
        } else {
            if ws_url.contains("helius-rpc.com") {
                ws_url.replace("https://", "wss://")
            } else {
                ws_url.replace("https://", "wss://").replace("http://", "ws://")
            }
        };
        
        let rpc_url = ws_url
            .replace("wss://", "https://")
            .replace("ws://", "http://");
        
        let http_client = Client::builder()
            .pool_max_idle_per_host(3)  // Reduced from 5 to 3
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()?;
        
        info!("🛒 Raydium LaunchPad BUY Monitor - OPTIMIZED for lower resource usage");
        info!("📍 Program: {}", RAYDIUM_PROGRAM_ID);
        info!("🔑 Authority: {}", RAYDIUM_LAUNCHPAD_AUTHORITY);
        info!("⚡ Fetch delay: {}ms | Timeout: {}s | Max concurrent: {}", 
              FETCH_DELAY_MS, REQUEST_TIMEOUT_SECS, MAX_PENDING_FETCHES);
        
        Ok(Self {
            ws_url,
            rpc_url,
            http_client,
            processed_signatures: HashSet::new(),
            seen_mints: HashSet::new(),
            last_fetch_time: None,
            pending_fetches: 0,
        })
    }

    pub async fn start_monitoring(&mut self) -> Result<()> {
        info!("🚀 Starting Raydium LaunchPad BUY Monitor (Optimized)");
        
        loop {
            match self.start_websocket_monitoring().await {
                Ok(_) => {
                    info!("🔄 Reconnecting...");
                },
                Err(e) => {
                    error!("❌ WebSocket error: {}", e);
                    sleep(Duration::from_secs(10)).await;  // Increased reconnect delay
                }
            }
            
            sleep(Duration::from_secs(2)).await;  // Increased from 1s to 2s
        }
    }

    async fn start_websocket_monitoring(&mut self) -> Result<()> {
        info!("🔌 Connecting to WebSocket");
        
        let (ws_stream, _) = connect_async(&self.ws_url).await?;
        let (mut write, mut read) = ws_stream.split();
        
        // Subscribe to Raydium LaunchPad program ONLY
        let subscription_request = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "logsSubscribe",
            "params": [
                {
                    "mentions": [RAYDIUM_PROGRAM_ID]
                },
                {
                    "commitment": "confirmed"
                }
            ]
        });
        
        write.send(Message::Text(subscription_request.to_string())).await?;
        info!("✅ Subscribed to Raydium LaunchPad: {}", RAYDIUM_PROGRAM_ID);
        
        while let Some(message) = read.next().await {
            match message? {
                Message::Text(text) => {
                    if let Err(e) = self.process_websocket_message(&text).await {
                        warn!("⚠️ Error: {}", e);
                    }
                },
                Message::Close(_) => break,
                _ => {}
            }
        }
        
        Ok(())
    }

    async fn process_websocket_message(&mut self, message: &str) -> Result<()> {
        let data: Value = serde_json::from_str(message)?;
        
        if let Some(result) = data.get("result") {
            if result.is_number() {
                info!("✅ Subscription confirmed");
                return Ok(());
            }
        }
        
        if let Some(params) = data.get("params") {
            if let Some(result) = params.get("result") {
                if let Some(value) = result.get("value") {
                    if let Some(signature) = value.get("signature").and_then(|s| s.as_str()) {
                        if let Some(logs) = value.get("logs").and_then(|l| l.as_array()) {
                            
                            if self.processed_signatures.contains(signature) {
                                return Ok(());
                            }
                            
                            // 🎯 OPTIMIZED: More strict filtering before processing
                            if self.is_buy_transaction_optimized(logs) {
                                // 🎯 THROTTLING: Check if we should process this transaction
                                if self.should_process_transaction().await {
                                    info!("🛒 Found BUY transaction: {}", signature);
                                    self.fetch_and_extract_mint_throttled(signature).await;
                                    self.processed_signatures.insert(signature.to_string());
                                } else {
                                    debug!("⏸️ Skipping transaction due to throttling: {}", signature);
                                    // Still mark as processed to avoid reprocessing
                                    self.processed_signatures.insert(signature.to_string());
                                }
                                
                                // Memory management - more aggressive cleanup
                                if self.processed_signatures.len() > 300 {  // Reduced from 500
                                    let recent: Vec<String> = self.processed_signatures
                                        .iter().skip(150).cloned().collect();  // Keep only 150
                                    self.processed_signatures.clear();
                                    self.processed_signatures.extend(recent);
                                    debug!("🧹 Cleaned up processed signatures");
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    // 🎯 OPTIMIZED: More strict filtering to reduce false positives
    fn is_buy_transaction_optimized(&self, logs: &[Value]) -> bool {
        let mut has_buy_indicator = false;
        let mut has_raydium_invoke = false;
        
        for log in logs {
            if let Some(log_str) = log.as_str() {
                // Look for BUY activity indicators
                if log_str.contains("buy_exact_in") || log_str.contains("buy_exact_out") {
                    has_buy_indicator = true;
                }
                
                // Verify it's actually Raydium program
                if log_str.contains("invoke [1]") && log_str.contains(RAYDIUM_PROGRAM_ID) {
                    has_raydium_invoke = true;
                }
                
                // Early exit if both conditions met
                if has_buy_indicator && has_raydium_invoke {
                    return true;
                }
            }
        }
        
        false
    }

    // 🎯 THROTTLING: Determine if we should process this transaction
    async fn should_process_transaction(&mut self) -> bool {
        // Check if too many pending fetches
        if self.pending_fetches >= MAX_PENDING_FETCHES {
            return false;
        }
        
        // Check minimum time between fetches
        if let Some(last_time) = self.last_fetch_time {
            let elapsed = last_time.elapsed();
            if elapsed < Duration::from_millis(MIN_TIME_BETWEEN_FETCHES_MS) {
                return false;
            }
        }
        
        true
    }

    async fn fetch_and_extract_mint_throttled(&mut self, signature: &str) {
        self.pending_fetches += 1;
        self.last_fetch_time = Some(Instant::now());
        
        // Longer rate limiting delay
        sleep(Duration::from_millis(FETCH_DELAY_MS)).await;
        
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [
                signature,
                {
                    "encoding": "jsonParsed",
                    "commitment": "confirmed",
                    "maxSupportedTransactionVersion": 0
                }
            ]
        });
        
        let result = timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS), 
            self.http_client.post(&self.rpc_url).json(&request).send()
        ).await;
        
        match result {
            Ok(Ok(response)) => {
                if let Ok(response_json) = response.json::<Value>().await {
                    if let Some(result) = response_json.get("result") {
                        if !result.is_null() {
                            self.extract_mint_from_buy_transaction(result, signature).await;
                        }
                    } else if let Some(error) = response_json.get("error") {
                        if let Some(code) = error.get("code").and_then(|c| c.as_i64()) {
                            if code == 429 {
                                warn!("⚠️ Rate limited - increasing delay");
                                sleep(Duration::from_secs(5)).await;  // Longer penalty
                            }
                        }
                    }
                }
            },
            _ => {
                debug!("⚠️ Failed to fetch transaction {}", signature);
            }
        }
        
        self.pending_fetches = self.pending_fetches.saturating_sub(1);
    }

    async fn extract_mint_from_buy_transaction(&mut self, transaction_data: &Value, signature: &str) {
        if let Some(transaction) = transaction_data.get("transaction") {
            if let Some(message) = transaction.get("message") {
                if let Some(instructions) = message.get("instructions").and_then(|i| i.as_array()) {
                    
                    // First, verify this is a BUY transaction
                    let mut is_buy = false;
                    
                    for instruction in instructions {
                        if let Some(program_id) = instruction.get("programId").and_then(|p| p.as_str()) {
                            if program_id == RAYDIUM_PROGRAM_ID {
                                if let Some(data) = instruction.get("data").and_then(|d| d.as_str()) {
                                    if self.is_buy_instruction(data) {
                                        is_buy = true;
                                        debug!("✅ Confirmed BUY instruction in {}", signature);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    if !is_buy {
                        debug!("❌ Not a BUY transaction: {}", signature);
                        return;
                    }
                    
                    // Now find the mint from transferChecked with LaunchPad Authority
                    for instruction in instructions {
                        if let Some(program) = instruction.get("program").and_then(|p| p.as_str()) {
                            if program == "spl-token" {
                                if let Some(parsed) = instruction.get("parsed") {
                                    if let Some(instruction_type) = parsed.get("type").and_then(|t| t.as_str()) {
                                        if instruction_type == "transferChecked" {
                                            if let Some(info) = parsed.get("info") {
                                                if let Some(authority) = info.get("authority").and_then(|a| a.as_str()) {
                                                    if authority == RAYDIUM_LAUNCHPAD_AUTHORITY {
                                                        if let Some(mint) = info.get("mint").and_then(|m| m.as_str()) {
                                                            self.handle_buy_mint(mint, signature).await;
                                                            return; // Found the mint, stop looking
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    debug!("⚠️ No LaunchPad transferChecked found in BUY transaction: {}", signature);
                }
            }
        }
    }

    fn is_buy_instruction(&self, data: &str) -> bool {
        use base64::{Engine as _, engine::general_purpose};
        
        if let Ok(decoded_data) = general_purpose::STANDARD.decode(data) {
            if decoded_data.len() >= 8 {
                let discriminator = &decoded_data[0..8];
                return discriminator == BUY_EXACT_IN_DISCRIMINATOR || 
                       discriminator == BUY_EXACT_OUT_DISCRIMINATOR;
            }
        }
        false
    }

    async fn handle_buy_mint(&mut self, mint_address: &str, signature: &str) {
        // 🎯 MAIN REQUIREMENT: Print CA to console
        println!("CA: {}", mint_address);
        
        let is_new_mint = !self.seen_mints.contains(mint_address);
        if is_new_mint {
            self.seen_mints.insert(mint_address.to_string());
        }
        
        info!(
            "🛒 [BUY{}] Mint: {} | TX: {}", 
            if is_new_mint { " - NEW" } else { "" },
            mint_address,
            &signature[..8]
        );
        
        // More aggressive memory management for seen_mints
        if self.seen_mints.len() > 2000 {  // Reduced from 3000
            let recent: Vec<String> = self.seen_mints
                .iter().skip(1000).cloned().collect();  // Keep only 1000
            self.seen_mints.clear();
            self.seen_mints.extend(recent);
            debug!("🧹 Cleaned up seen mints cache");
        }
    }
} 