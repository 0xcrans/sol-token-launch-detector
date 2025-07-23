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
    detectedTokens,
    totalTokensDetected,
    totalUniqueTokens,
    launchpadStats,
    launchpadEvents,
    launchpadTrades,
    launchpadMigrations,
    getActiveLaunchpadPools,
    getRecentLaunchpadTrades,
    pendingDetections,
    hasPendingDetections
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
    if (address === 'unknown' || address === 'detecting...' || address === 'pending...' || !address) return address || 'N/A';
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    if (text && text !== 'unknown' && text !== 'detecting...' && text !== 'pending...' && text !== 'N/A' && text.length > 10) {
      navigator.clipboard.writeText(text)
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

  const getPoolTypeLabel = (type: string): string => {
    if (type === 'launchpad_initialize') return '💰 TOKEN DETECTED'
    return type === 'initialize2' ? '💰 TOKEN DETECTED' : '🏊 EMPTY POOL'
  }

  const tokenLaunches = pools.filter(pool => {
    return pool.isTokenLaunch && 
      (pool.program === 'LAUNCHPAD' || pool.type === 'initialize2' || pool.type === 'launchpad_initialize');
  })

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="w-full flex-shrink-0">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Raydium Tokens Monitor</h1>

              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isMonitoring ? (
                <button
                  onClick={startMonitoring}
                  disabled={!isConnected}
                  className="bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-600 hover:via-cyan-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={stopMonitoring}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  Stop
                </button>
              )}
              <button
                onClick={clearData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 mb-4">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {tokenLaunches.length > 0 ? formatTimestamp(tokenLaunches[0].timestamp) : '--:--:--'}
              </div>
              <div className="text-gray-300 text-xs">Last Detection</div>
              {isMonitoring && (
                <div className="text-green-400 text-xs mt-1">🔍 Scanning</div>
              )}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">{stats.rpcCallsThisSession || 0}</div>
              <div className="text-gray-300 text-xs">RPC Calls</div>
              {isMonitoring && (
                stats.rpcQueueSize ? (
                  <div className="text-yellow-400 text-xs mt-1">Queue: {stats.rpcQueueSize}</div>
                ) : (
                  <div className="text-green-400 text-xs mt-1">🔧 Rate Limited</div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Token Detection Section */}
        {tokenLaunches.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  🥇 First Tokens Purchases
                </h2>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {tokenLaunches.slice(0, 10).map((launch: TokenLaunchEvent, index: number) => (
                  <div 
                    key={`${launch.signature}-${index}`} 
                    className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                      </div>
                      
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-blue-500/30 to-cyan-500/30 px-2 py-1 rounded border border-blue-400/40 backdrop-blur-sm">
                          <div className="text-xs text-gray-200">
                            {formatTimestamp(launch.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Token Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg p-3 border border-blue-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-300 font-bold text-xs">💰 Token Address</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.tokenA)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-blue-400/10 hover:bg-blue-400/20 text-blue-300 border-blue-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.tokenA)}</div>
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-green-300 font-bold text-xs">💳 Paired With</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.tokenB)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-green-400/10 hover:bg-green-400/20 text-green-300 border-green-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.tokenB)}</div>
                        </button>
                      </div>
                    </div>

                    {/* Pool State and First Buyer */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg p-2 border border-indigo-400/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-indigo-300 font-bold text-xs">🏛️ Pool</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.poolId)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-indigo-400/10 hover:bg-indigo-400/20 text-indigo-300 border-indigo-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.poolId)}</div>
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-2 border border-yellow-400/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-yellow-300 font-bold text-xs">🥇 First Buyer</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.creator)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border-yellow-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.creator)}</div>
                        </button>
                      </div>
                    </div>
                    
                    {/* Transaction Actions */}
                    <div className="p-2 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded border border-gray-600/30">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 font-bold text-xs">🔗 First Purchase Transaction</span>
                        
                        <div className="flex gap-2">
                          <a
                            href={`https://solscan.io/tx/${launch.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300"
                          >
                            💰 View TX
                          </a>
                          <a
                            href={`https://solscan.io/account/${launch.tokenA}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300"
                          >
                            💎 View Token
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

        {/* No Token Detections Message */}
        {tokenLaunches.length === 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  🥇 First Token Purchase
                </h2>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-center text-gray-400 py-12">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Detection Ready
                </h3>
                <p className="text-sm mb-2">New tokens detected when buy transactions occur.</p>
                
                {isMonitoring && (
                  <div className="mt-4 bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 max-w-sm mx-auto">
                    <p className="text-blue-300 text-xs">
                      💰 Detection active:<br/>
                      🎯 Buy transaction method<br/>
                      📊 Real-time tracking system
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
