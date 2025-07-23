import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useState } from 'react'

export default function WalletButton() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium">
        Loading...
      </div>
    )
  }

  return <WalletMultiButton />
} 