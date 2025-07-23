import { useState, useEffect } from 'react'
import { usePumpProgram } from '../hooks/usePumpProgram'

export default function PumpMonitor() {
  const {
    isConnected,
    isMonitoring,
    launches: detectedTokenLaunches,
    stats: monitoringStatistics,
    startMonitoring: startPumpFunMonitoring,
    stopMonitoring: stopPumpFunMonitoring,
    clearData: clearAllMonitoringData
  } = usePumpProgram()

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatTimestamp = (timestamp: Date | undefined): string => {
    if (!timestamp) return '--:--:--'
    return timestamp.toLocaleTimeString()
  }

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    if (text && text.length > 10) {
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

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="w-full flex-shrink-0">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Pump.Fun Tokens Monitor</h1>

              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isMonitoring ? (
                <button
                  onClick={startPumpFunMonitoring}
                  disabled={!isConnected}
                  className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:from-purple-600 hover:via-pink-600 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={stopPumpFunMonitoring}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  Stop
                </button>
              )}
              <button
                onClick={clearAllMonitoringData}
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
                {detectedTokenLaunches.length > 0 ? formatTimestamp(detectedTokenLaunches[0].timestamp) : '--:--:--'}
              </div>
              <div className="text-gray-300 text-xs">Last Launch</div>
              {isMonitoring && (
                <div className="text-green-400 text-xs mt-1">🔍 Monitoring</div>
              )}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">{formatUptime(monitoringStatistics.uptime)}</div>
              <div className="text-gray-300 text-xs">Uptime</div>
              {isMonitoring && (
                <div className="text-green-400 text-xs mt-1">🔥 Active</div>
              )}
            </div>
          </div>
        </div>

        {/* Token Launches Section */}
        {detectedTokenLaunches.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                  🔥 Tokens Launches
                </h2>
              </div>
          </div>

            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {detectedTokenLaunches.slice(0, 10).map((launch, index) => (
                  <div 
                    key={`${launch.mint}-${index}`} 
                    className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                      </div>
                      
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 px-2 py-1 rounded border border-purple-400/40 backdrop-blur-sm">
                          <div className="text-xs text-gray-200">
                            {formatTimestamp(launch.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Launch Detection Info */}
                    <div className="mb-3 p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-400/20">
                      <div className="text-purple-300 font-bold text-xs mb-2">
                        🔥 Token Launch Detected
                  </div>
                      <div className="text-xs text-purple-200">
                        🚀 New token launched on Pump.fun platform
                      </div>
                    </div>
                    
                    {/* Token Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-purple-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-purple-300 font-bold text-xs">🏷️ Token Info</span>
                        </div>
                        <div className="text-white font-medium text-sm mb-1">
                          {launch.name} ({launch.symbol})
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.mint)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 border-purple-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.mint)}</div>
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-400/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-green-300 font-bold text-xs">👤 Creator</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(launch.creator)}
                          className="w-full text-left px-2 py-1 rounded text-xs transition-all duration-300 border bg-green-400/10 hover:bg-green-400/20 text-green-300 border-green-400/30"
                        >
                          <div className="truncate">{formatAddress(launch.creator)}</div>
                        </button>
                      </div>
                    </div>
                    
                    {/* Transaction Actions */}
                    <div className="p-2 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded border border-gray-600/30">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 font-bold text-xs">🔗 Launch Transaction</span>
                        
                        <div className="flex gap-2">
                          <a
                            href={`https://solscan.io/tx/${launch.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-2 py-1 rounded text-xs font-medium transition-all duration-300"
                          >
                            🔥 View TX
                          </a>
                          <a
                            href={`https://solscan.io/account/${launch.mint}`}
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

        {/* No Data Message */}
        {detectedTokenLaunches.length === 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 px-4 py-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                  🔥 Token Launches
                </h2>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-center text-gray-400 py-12">
                <div className="text-4xl mb-4">🔥</div>
                <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Monitoring Ready
                </h3>
                <p className="text-sm mb-2">New token launches detected when they occur.</p>
                
                {isMonitoring && (
                  <div className="mt-4 bg-purple-500/20 border border-purple-400/30 rounded-lg p-3 max-w-sm mx-auto">
                    <p className="text-purple-300 text-xs">
                      🔥 Monitoring active:<br/>
                      🚀 Pump.fun launch detection<br/>
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
