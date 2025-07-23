import { useState, useEffect } from 'react'
import { usePumpProgram } from '../hooks/usePumpProgram'

interface NavigationTabType {
  id: 'launches' | 'completions' | 'curves' | 'hot' | 'active' | 'stats'
  label: string
  count?: number
}

export default function PumpMonitor() {
  const {
    isConnected,
    isMonitoring,
    launches: detectedTokenLaunches,
    // trades: detectedTrades, // Disabled trades monitoring
    completions: detectedCompletions,
    activeCurves: activeBondingCurves,
    nearCompletionCurves: bondingCurvesNearCompletion,
    // DISABLED: hotCurves since we're not processing volume data
    // hotCurves: highVolumeBondingCurves,
    stats: monitoringStatistics,
    startMonitoring: startPumpFunMonitoring,
    stopMonitoring: stopPumpFunMonitoring,
    clearData: clearAllMonitoringData
  } = usePumpProgram()

  const [currentActiveTab, setCurrentActiveTab] = useState<NavigationTabType['id']>('launches')

  const navigationTabs: NavigationTabType[] = [
    { id: 'launches', label: 'Token Launches', count: detectedTokenLaunches.length },
    // { id: 'trades', label: 'Trades', count: detectedTrades.length }, // Disabled trades tab
    { id: 'completions', label: 'Completions', count: detectedCompletions.length },
    { id: 'active', label: 'Active Curves', count: activeBondingCurves.filter(c => c.isActive && !c.isCompleted).length },
    { id: 'curves', label: 'Near Completion', count: bondingCurvesNearCompletion.length },
    { id: 'hot', label: 'Hot Curves', count: 0 }, // Disabled but kept for future use
    { id: 'stats', label: 'Statistics' }
  ]

  const formatUptimeDisplay = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  }

  const formatTimestampDisplay = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString()
  }

  const formatAddressForDisplay = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyAddressToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getProgressDisplayColor = (progress: number): string => {
    if (progress >= 80) return 'text-pump-red'
    if (progress >= 60) return 'text-yellow-400'
    if (progress >= 40) return 'text-pump-blue'
    return 'text-pump-green'
  }

  const getProgressBarBackgroundColor = (progress: number): string => {
    if (progress >= 80) return 'bg-pump-red'
    if (progress >= 60) return 'bg-yellow-400'
    if (progress >= 40) return 'bg-pump-blue'
    return 'bg-pump-green'
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="w-full flex-shrink-0">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pump-purple to-pump-blue rounded-lg flex items-center justify-center">
                <span className="text-xl">🔥</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Pump.fun Monitor</h1>
                <p className="text-gray-300 text-sm">Real-time pump.fun token launch tracker with enhanced curve monitoring</p>
                {isMonitoring && (
                  <div className="text-white text-xs mt-1">
                    <span className="text-gray-300">Uptime:</span> {formatUptimeDisplay(monitoringStatistics.uptime)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isMonitoring ? (
                <button
                  onClick={startPumpFunMonitoring}
                  disabled={!isConnected}
                  className="bg-pump-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 pulse-glow text-sm"
                >
                  🚀 Start Monitoring
                </button>
              ) : (
                <button
                  onClick={stopPumpFunMonitoring}
                  className="bg-pump-red hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  🛑 Stop Monitoring
                </button>
              )}
              <button
                onClick={clearAllMonitoringData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
              >
                🗑️ Clear Data
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-pump-purple">{monitoringStatistics.launchesDetected}</div>
              <div className="text-gray-300 text-xs">Launches</div>
            </div>
          </div>
          {/* Disabled trades stats
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-pump-blue">{monitoringStatistics.tradesDetected}</div>
              <div className="text-gray-300 text-xs">Trades</div>
            </div>
          </div>
          */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-pump-green">{monitoringStatistics.completionsDetected}</div>
              <div className="text-gray-300 text-xs">Completions</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-pump-orange">{activeBondingCurves.filter(c => c.isActive && !c.isCompleted).length}</div>
              <div className="text-gray-300 text-xs">Active Curves</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-pump-red">{bondingCurvesNearCompletion.length}</div>
              <div className="text-gray-300 text-xs">Near Complete</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {monitoringStatistics.lastEventTime ? formatTimestampDisplay(monitoringStatistics.lastEventTime) : '--:--:--'}
              </div>
              <div className="text-gray-300 text-xs">Last Event</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden flex-1 flex flex-col">
          <div className="flex border-b border-white/20 overflow-x-auto custom-scrollbar scrollbar-thin scroll-smooth">
            {navigationTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 py-2 text-center font-medium transition-all duration-200 text-xs whitespace-nowrap hover:scale-105 ${
                  currentActiveTab === tab.id
                    ? 'bg-pump-purple text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 bg-white/20 px-1 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
            {/* Token Launches Tab */}
            {currentActiveTab === 'launches' && (
              <div className="space-y-4">
                {detectedTokenLaunches.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-4xl mb-4">🚀</div>
                    <p>No token launches detected yet.</p>
                    <p className="text-sm mt-2">Start monitoring to see new launches!</p>
                  </div>
                ) : (
                  detectedTokenLaunches.map((launchEvent, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2">
                            {launchEvent.name} ({launchEvent.symbol})
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Mint:</span>
                              <button
                                onClick={() => copyAddressToClipboard(launchEvent.mint)}
                                className="ml-2 text-pump-blue hover:text-blue-300 transition-colors"
                              >
                                {formatAddressForDisplay(launchEvent.mint)}
                              </button>
                            </div>
                            <div>
                              <span className="text-gray-400">Creator:</span>
                              <button
                                onClick={() => copyAddressToClipboard(launchEvent.creator)}
                                className="ml-2 text-pump-purple hover:text-purple-300 transition-colors"
                              >
                                {formatAddressForDisplay(launchEvent.creator)}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-400">
                          {formatTimestampDisplay(launchEvent.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Trades Tab - DISABLED */}
            {/* 
            {currentActiveTab === 'trades' && (
              <div className="space-y-4">
                {detectedTrades.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-4xl mb-4">💰</div>
                    <p>No trades detected yet.</p>
                  </div>
                ) : (
                  detectedTrades.map((tradeEvent, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            tradeEvent.isBuy ? 'bg-pump-green text-white' : 'bg-pump-red text-white'
                          }`}>
                            {tradeEvent.isBuy ? 'BUY' : 'SELL'}
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {tradeEvent.solAmount.toFixed(4)} SOL
                            </div>
                            <div className="text-gray-400 text-sm">
                              {tradeEvent.tokenAmount.toLocaleString()} tokens
                            </div>
                            <div className="text-gray-400 text-xs">
                              Real SOL: {tradeEvent.realSolReserves.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400 text-sm">
                            {formatTimestampDisplay(tradeEvent.timestamp)}
                          </div>
                          <button
                            onClick={() => copyAddressToClipboard(tradeEvent.user)}
                            className="text-pump-blue hover:text-blue-300 text-sm transition-colors"
                          >
                            {formatAddressForDisplay(tradeEvent.user)}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            */}

            {/* Completions Tab */}
            {currentActiveTab === 'completions' && (
              <div className="space-y-4">
                {detectedCompletions.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-4xl mb-4">🎯</div>
                    <p>No bonding curve completions detected yet.</p>
                  </div>
                ) : (
                  detectedCompletions.map((completionEvent, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-pump-green mb-2">
                            🎯 Bonding Curve Completed
                          </div>
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="text-gray-400">Token:</span>
                              <button
                                onClick={() => copyAddressToClipboard(completionEvent.mint)}
                                className="ml-2 text-pump-blue hover:text-blue-300 transition-colors"
                              >
                                {formatAddressForDisplay(completionEvent.mint)}
                              </button>
                            </div>
                            <div>
                              <span className="text-gray-400">Completed by:</span>
                              <button
                                onClick={() => copyAddressToClipboard(completionEvent.user)}
                                className="ml-2 text-pump-purple hover:text-purple-300 transition-colors"
                              >
                                {formatAddressForDisplay(completionEvent.user)}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-400">
                          {formatTimestampDisplay(completionEvent.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Near Completion Curves Tab */}
            {currentActiveTab === 'curves' && (
              <div className="space-y-4">
                {bondingCurvesNearCompletion.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-4xl mb-4">⚠️</div>
                    <p>No curves near completion.</p>
                    <p className="text-sm mt-2">Curves with &gt;80% progress will appear here!</p>
                  </div>
                ) : (
                  bondingCurvesNearCompletion.map((bondingCurve, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {bondingCurve.name || 'Unknown'} ({bondingCurve.symbol || formatAddressForDisplay(bondingCurve.mint)})
                          </h3>
                          <button
                            onClick={() => copyAddressToClipboard(bondingCurve.mint)}
                            className="text-pump-blue hover:text-blue-300 text-sm transition-colors"
                          >
                            {formatAddressForDisplay(bondingCurve.mint)}
                          </button>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getProgressDisplayColor(bondingCurve.completionProgress)}`}>
                            {bondingCurve.completionProgress.toFixed(1)}%
                          </div>
                          <div className="text-gray-400 text-sm">
                            {bondingCurve.estimatedTimeToCompletion ? `~${bondingCurve.estimatedTimeToCompletion}m` : 'Unknown'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarBackgroundColor(bondingCurve.completionProgress)}`}
                            style={{ width: `${bondingCurve.completionProgress}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">SOL Raised:</span>
                          <div className="text-white font-medium">{bondingCurve.realSolReserves.toFixed(2)}/85</div>
                        </div>
                        <div>
                          <span className="text-gray-400">24h Volume:</span>
                          <div className="text-white font-medium">{bondingCurve.recentVolume24h.toFixed(2)} SOL</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Buy Pressure:</span>
                          <div className="text-white font-medium">{bondingCurve.buyPressure.toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Active Curves Tab */}
            {currentActiveTab === 'active' && (
              <div className="space-y-4">
                {activeBondingCurves.filter(c => c.isActive && !c.isCompleted).length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-4xl mb-4">🔄</div>
                    <p>No active curves found.</p>
                    <p className="text-sm mt-2">Curves with active monitoring will appear here.</p>
                  </div>
                ) : (
                  activeBondingCurves.filter(c => c.isActive && !c.isCompleted).map((activeCurve, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10 fade-in">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {activeCurve.name || 'Unknown'} ({activeCurve.symbol || formatAddressForDisplay(activeCurve.mint)})
                          </h3>
                          <button
                            onClick={() => copyAddressToClipboard(activeCurve.mint)}
                            className="text-pump-blue hover:text-blue-300 text-sm transition-colors"
                          >
                            {formatAddressForDisplay(activeCurve.mint)}
                          </button>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getProgressDisplayColor(activeCurve.completionProgress)}`}>
                            {activeCurve.completionProgress.toFixed(1)}%
                          </div>
                          <div className="text-gray-400 text-sm">
                            {activeCurve.estimatedTimeToCompletion ? `~${activeCurve.estimatedTimeToCompletion}m` : 'Unknown'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarBackgroundColor(activeCurve.completionProgress)}`}
                            style={{ width: `${activeCurve.completionProgress}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">SOL Raised:</span>
                          <div className="text-white font-medium">{activeCurve.realSolReserves.toFixed(2)}/85</div>
                        </div>
                        <div>
                          <span className="text-gray-400">24h Volume:</span>
                          <div className="text-white font-medium">{activeCurve.recentVolume24h.toFixed(2)} SOL</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Buy Pressure:</span>
                          <div className="text-white font-medium">{activeCurve.buyPressure.toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Hot Curves Tab - Temporarily disabled but kept for future */}
            {currentActiveTab === 'hot' && (
              <div className="space-y-4">
                <div className="text-center text-gray-400 py-12">
                  <div className="text-4xl mb-4">🔥</div>
                  <p>Hot curves feature temporarily disabled.</p>
                  <p className="text-sm mt-2">Volume tracking is paused to optimize performance.</p>
                  <p className="text-xs mt-1 text-gray-500">This feature can be re-enabled when needed.</p>
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {currentActiveTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4">Monitoring Stats</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={isMonitoring ? 'text-pump-green' : 'text-pump-red'}>
                          {isMonitoring ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Uptime:</span>
                        <span className="text-white">{formatUptimeDisplay(monitoringStatistics.uptime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Last Event:</span>
                        <span className="text-white">
                          {monitoringStatistics.lastEventTime ? formatTimestampDisplay(monitoringStatistics.lastEventTime) : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Active Curves:</span>
                        <span className="text-white">{activeBondingCurves.filter(c => c.isActive && !c.isCompleted).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4">Event Counts</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Launches:</span>
                        <span className="text-pump-purple font-bold">{monitoringStatistics.launchesDetected}</span>
                      </div>
                      {/* Disabled trades in stats
                      <div className="flex justify-between">
                        <span className="text-gray-400">Trades:</span>
                        <span className="text-pump-blue font-bold">{monitoringStatistics.tradesDetected}</span>
                      </div>
                      */}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completions:</span>
                        <span className="text-pump-green font-bold">{monitoringStatistics.completionsDetected}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Near Complete:</span>
                        <span className="text-pump-red font-bold">{bondingCurvesNearCompletion.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 