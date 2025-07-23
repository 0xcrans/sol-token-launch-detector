import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo } from 'react'
import type { AppProps } from 'next/app'
import '../styles/globals.css'

// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css')

export default function App({ Component, pageProps }: AppProps) {
  // Use mainnet for real pump.fun monitoring
  const network = WalletAdapterNetwork.Mainnet
  const endpoint = useMemo(() => {
    // Use custom RPC if provided, otherwise fallback to public mainnet
    return process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(network)
  }, [network])

  const wallets = useMemo(
    () => {
      const adapters = []
      
      // Only add adapters if they're loaded (client-side)
      if (typeof window !== 'undefined') {
        try {
          // Import wallet adapters dynamically to avoid SSR issues
          const walletAdapters = require('@solana/wallet-adapter-wallets')
          
          if (walletAdapters.PhantomWalletAdapter) {
            adapters.push(new walletAdapters.PhantomWalletAdapter())
          }
          
          if (walletAdapters.SolflareWalletAdapter) {
            adapters.push(new walletAdapters.SolflareWalletAdapter({ network }))
          }
          
          if (walletAdapters.TorusWalletAdapter) {
            adapters.push(new walletAdapters.TorusWalletAdapter())
          }
          
        } catch (error) {
          console.warn('Failed to load wallet adapters:', error)
          // Fallback: app will work without wallet adapters
        }
      }
      
      return adapters
    },
    [network]
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <Component {...pageProps} />
            </div>
            <footer className="bg-black/20 backdrop-blur-sm border-t border-white/10 py-3 px-4 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm text-gray-300">
                  Made by{' '}
                  <a 
                    href="https://crans.xyz/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                  >
                    Crans
                  </a>
                </p>
              </div>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 
