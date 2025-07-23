import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js'

// Default configuration
export const DEFAULT_COMMITMENT: Commitment = 'confirmed'
export const DEFAULT_NETWORK = 'mainnet-beta'

// RPC endpoints (add your custom ones here)
export const RPC_ENDPOINTS = {
  mainnet: {
    http: process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('mainnet-beta'),
    ws: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.mainnet-beta.solana.com'
  },
  devnet: {
    http: clusterApiUrl('devnet'),
    ws: 'wss://api.devnet.solana.com'
  }
}

/**
 * Create a Solana connection with optimal settings for monitoring
 */
export function createConnection(
  network: 'mainnet' | 'devnet' = 'mainnet',
  commitment: Commitment = DEFAULT_COMMITMENT
): Connection {
  const endpoints = RPC_ENDPOINTS[network]
  
  return new Connection(endpoints.http, {
    commitment,
    wsEndpoint: endpoints.ws,
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000,
  })
}

/**
 * Test connection health
 */
export async function testConnection(connection: Connection): Promise<{
  success: boolean
  slot?: number
  error?: string
}> {
  try {
    const slot = await connection.getSlot()
    return { success: true, slot }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get connection performance metrics
 */
export async function getConnectionMetrics(connection: Connection) {
  try {
    const start = Date.now()
    const slot = await connection.getSlot()
    const latency = Date.now() - start
    
    const epochInfo = await connection.getEpochInfo()
    const blockHeight = await connection.getBlockHeight()
    
    return {
      slot,
      latency,
      epochInfo,
      blockHeight,
      timestamp: new Date()
    }
  } catch (error) {
    throw new Error(`Failed to get connection metrics: ${error}`)
  }
} 