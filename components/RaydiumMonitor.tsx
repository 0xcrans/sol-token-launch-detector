import { useState, useEffect } from 'react'
import { useRaydiumProgram } from '../hooks/useRaydiumProgram'
import { TokenLaunchEvent } from '../types/ray'

export default function RaydiumMonitor() {
  const {
    isConnected,
    isMonitoring,
    pools,
    stats,
    startMonitoring,
    stopMonitoring,
    clearData,
    // 🎪 NEW: Enhanced Launchpad functions for real-time detection
    launchpadStats,
    launchpadEvents,
    launchpadTrades,
    launchpadMigrations,
    getActiveLaunchpadPools,
    getRecentLaunchpadTrades
  } = useRaydiumProgram()

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString()
  }

  const formatAddress = (address: string): string => {
    if (address === 'unknown' || address === 'detecting...' || address === 'pending...') return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatLargeNumber = (num: number | bigint): string => {
    const n = typeof num === 'bigint' ? Number(num) : num;
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    return n.toLocaleString();
  }

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.01) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(8)}`;
  }

  const copyToClipboard = (text: string) => {
    if (text !== 'unknown' && text !== 'detecting...' && text !== 'pending...' && text.length > 10) {
      navigator.clipboard.writeText(text)
      console.log(`📋 Copied to clipboard: ${text}`)
      // Visual feedback
      const button = document.activeElement as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 1000);
      }
    }
  }

  const isPlaceholder = (text: string): boolean => {
    return text === 'unknown' || text === 'loading...' || text === 'failed'
  }

  const getPlaceholderMessage = (text: string): string => {
    if (text === 'loading...') return 'Loading data... ⏰'
    if (text === 'failed') return 'Failed to load ❌'
    if (text === 'unknown') return 'Check transaction ↗'
    return text
  }

  const getPoolTypeColor = (type: string): string => {
    return type === 'initialize2' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
  }

  const getPoolTypeLabel = (type: string): string => {
    return type === 'initialize2' ? '🚀 TOKEN LAUNCH' : '🏊 EMPTY POOL'
  }

  // Filter for new token launches and Launchpad tokens
  const tokenLaunches = pools.filter(pool => 
    pool.isTokenLaunch && (pool.program === 'LAUNCHPAD' || pool.type === 'initialize2')
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="w-full flex-shrink-0">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Raydium Launch Monitor</h1>
                <p className="text-gray-300 text-sm">Real-time detection of new token launches with full parameters</p>
                {isMonitoring && (
                  <div className="text-white text-xs mt-1">
                    <span className="text-gray-300">Uptime:</span> {formatUptime(stats.uptime)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isMonitoring ? (
                <button
                  onClick={startMonitoring}
                  disabled={!isConnected}
                  className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 hover:from-purple-600 hover:via-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  🚀 Start Monitoring
                </button>
              ) : (
                <button
                  onClick={stopMonitoring}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  🛑 Stop Monitoring
                </button>
              )}
              <button
                onClick={clearData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>

        {/* Launch Stats Overview */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{tokenLaunches.length}</div>
              <div className="text-gray-300 text-xs">Token Launches</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {tokenLaunches.length > 0 ? formatTimestamp(tokenLaunches[0].timestamp) : '--:--:--'}
              </div>
              <div className="text-gray-300 text-xs">Last Launch</div>
            </div>
          </div>
        </div>

        {/* 🎪 Enhanced Token Launches Section */}
        {tokenLaunches.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                  🎪 New Token Launches with Parameters
                </h2>
                <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="text-white font-bold text-sm">{tokenLaunches.length} Detected</span>
                </div>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {tokenLaunches.slice(0, 10).map((launch: TokenLaunchEvent, index: number) => (
                  <div 
                    key={`${launch.signature}-${index}`} 
                    className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in"
                  >
                    {/* Launch Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-600">
                          🚀 NEW TOKEN
                        </div>
                        <div className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500/30 text-blue-300 border border-blue-400/30">
                          {launch.program}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 px-2 py-1 rounded border border-purple-400/40 backdrop-blur-sm">
                          <div className="text-xs text-gray-200">
                            {formatTimestamp(launch.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 🎯 NEW: Token Parameters Display */}
                    {launch.mintParams && (
                      <div className="mb-3 p-3 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-lg border border-emerald-400/20">
                        <div className="text-emerald-300 font-bold text-xs mb-2">📊 Token Parameters</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">Name:</span>
                            <div className="text-emerald-300 font-semibold truncate">{launch.mintParams.name}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Symbol:</span>
                            <div className="text-emerald-300 font-semibold">{launch.mintParams.symbol}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Decimals:</span>
                            <div className="text-emerald-300 font-semibold">{launch.mintParams.decimals}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Metadata:</span>
                            {launch.mintParams.uri ? (
                              <a 
                                href={launch.mintParams.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline truncate block"
                              >
                                View JSON
                              </a>
                            ) : (
                              <div className="text-gray-500">No URI</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Token Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                      {/* Token Mint */}
                      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-purple-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-purple-300 font-bold text-xs">💰 Token Address</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.tokenA)}
                          className="w-full text-left px-2 py-1 rounded bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 text-xs transition-all duration-300 border border-purple-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.tokenA)}</div>
                        </button>
                      </div>
                      
                      {/* Quote Token */}
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-green-300 font-bold text-xs">💳 Paired With</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.tokenB)}
                          className="w-full text-left px-2 py-1 rounded bg-green-400/10 hover:bg-green-400/20 text-green-300 text-xs transition-all duration-300 border border-green-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.tokenB)}</div>
                        </button>
                      </div>
                    </div>

                    {/* Pool State and Creator */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                      {/* Pool State */}
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg p-2 border border-blue-400/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-blue-300 font-bold text-xs">🏛️ Pool</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.poolId)}
                          className="w-full text-left px-2 py-1 rounded bg-blue-400/10 hover:bg-blue-400/20 text-blue-300 text-xs transition-all duration-300 border border-blue-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.poolId)}</div>
                        </button>
                      </div>
                      
                      {/* Creator */}
                      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-2 border border-yellow-400/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-yellow-300 font-bold text-xs">👤 Creator</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.creator)}
                          className="w-full text-left px-2 py-1 rounded bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 text-xs transition-all duration-300 border border-yellow-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.creator)}</div>
                        </button>
                      </div>
                    </div>
                    
                    {/* Transaction Actions */}
                    <div className="p-2 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded border border-gray-600/30">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 font-bold text-xs">🔗 Transaction</span>
                        
                        <div className="flex gap-2">
                          <a
                            href={`https://solscan.io/tx/${launch.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300"
                          >
                            🎪 View Launch
                          </a>
                          <a
                            href={`https://solscan.io/account/${launch.tokenA}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300"
                          >
                            💰 View Token
                          </a>
                          <button
                            onClick={() => copyToClipboard(launch.signature)}
                            className="text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-600/70 px-2 py-1 rounded transition-all duration-300 text-xs border border-gray-600/50"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Token Launches Message */}
        {tokenLaunches.length === 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden flex-1 flex flex-col">
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                  🎪 New Token Launches with Parameters
                </h2>
                <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="text-white font-bold text-sm">0 Detected</span>
                </div>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-center text-gray-400 py-12">
                <div className="text-4xl mb-4">🎪</div>
                <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  No Token Launches Detected
                </h3>
                <p className="text-sm mb-2">New token launches with full parameters will appear here in real-time.</p>
                <p className="text-xs">Start monitoring to detect new launches!</p>
                
                {isMonitoring && (
                  <div className="mt-4 bg-purple-500/20 border border-purple-400/30 rounded-lg p-3 max-w-sm mx-auto">
                    <p className="text-purple-300 text-xs">
                      🔍 Enhanced monitoring active:<br/>
                      • Real-time new token detection<br/>
                      • Full token parameters (name, symbol, decimals)<br/>
                      • Metadata URI extraction
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
