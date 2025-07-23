# 🔥 Blazing Monitor

Real-time monitoring dashboard for pump.fun token launches and trading activity on Solana.

## 🚀 Features

- **Real-time Monitoring**: Live tracking of pump.fun program events
- **Token Launch Detection**: Instant notifications of new token launches
- **Trade Monitoring**: Track all buy/sell transactions in real-time
- **Bonding Curve Completions**: Monitor when tokens graduate to Raydium
- **Beautiful UI**: Modern, responsive dashboard with glassmorphism design
- **Wallet Integration**: Connect with Phantom, Solflare, and other Solana wallets
- **Export Data**: Copy addresses and transaction details to clipboard

## 📦 Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana Web3.js, Anchor
- **Wallet**: Solana Wallet Adapter

## 🛠️ Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Solana wallet (Phantom recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd blazing-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment (REQUIRED)**
   ```bash
   cp .env.example .env.local
   ```
   
   **You MUST set up a Helius API key:**
   ```env
   # Get your free API key from: https://www.helius.dev/
   NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here
   ```
   
   **Optional: Custom RPC endpoints for better performance:**
   ```env
   NEXT_PUBLIC_RPC_URL=https://your-custom-rpc-endpoint
   NEXT_PUBLIC_WS_URL=wss://your-custom-ws-endpoint
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   ```
   http://localhost:3000
   ```

## 🎯 Usage

1. **Connect Wallet**: Click the wallet button to connect your Solana wallet
2. **Start Monitoring**: Click "🚀 Start Monitoring" to begin tracking events
3. **View Events**: Navigate between tabs to see different event types:
   - **Token Launches**: New tokens created on pump.fun
   - **Trades**: All buy/sell transactions
   - **Completions**: Bonding curves that graduated to Raydium
   - **Statistics**: Monitoring stats and instructions

4. **Interact with Data**:
   - Click addresses to copy them to clipboard
   - View real-time event counts and timing
   - Monitor uptime and connection status

## 📊 Event Types

### Token Launches 🚀
- New token creation events
- Contains: name, symbol, mint address, creator, metadata URI
- Real-time detection of fresh launches

### Trades 💰  
- Buy and sell transactions
- Contains: SOL amount, token amount, trader address, reserves
- Color-coded: Green for buys, Red for sells

### Completions 🎯
- Bonding curve graduation events  
- Tokens that successfully moved to Raydium
- Contains: token address, completion user

## 🔧 Configuration

### Custom RPC Endpoints

For better performance, configure custom RPC endpoints in `.env.local`:

```env
# Mainnet RPC (recommended for production)
NEXT_PUBLIC_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/your-key

# WebSocket endpoint
NEXT_PUBLIC_WS_URL=wss://solana-mainnet.g.alchemy.com/v2/your-key
```

### Program Configuration

The monitor targets the official pump.fun program:
```
Program ID: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

## 🚦 Performance Tips

1. **Use Custom RPC**: Public endpoints may rate limit. Use Alchemy, QuickNode, or Helius
2. **Mainnet Only**: pump.fun only exists on mainnet
3. **Stable Connection**: Ensure reliable internet for websocket connections
4. **Browser Performance**: Clear data periodically for optimal performance

## 🛡️ Security Notes

- This application only reads blockchain data
- No private keys are stored or transmitted
- Wallet connections use standard Solana Wallet Adapter
- All data viewing is read-only

## 📝 Development

### Project Structure

```
blazing-monitor/
├── components/          # React components
│   ├── BlazingMonitor.tsx   # Main dashboard
│   └── WalletButton.tsx     # Wallet connection
├── hooks/              # Custom React hooks  
│   └── useBlazingProgram.ts # Program monitoring logic
├── pages/              # Next.js pages
│   ├── _app.tsx            # App wrapper with providers
│   └── index.tsx           # Home page
├── styles/             # CSS styles
│   └── globals.css         # Global styles + Tailwind
├── types/              # TypeScript types
│   └── index.ts            # Shared type definitions
├── utils/              # Utility functions
│   └── connection.ts       # Solana connection helpers
└── idl/                # Program IDL files
    └── pump-fun.json       # pump.fun program interface
```

### Key Components

- **useBlazingProgram**: Main hook for monitoring pump.fun program
- **BlazingMonitor**: Main UI component with tabs and real-time updates  
- **WalletButton**: Wallet connection with loading states
- **Types**: TypeScript interfaces for events and program data

## 📄 License

MIT License - see LICENSE file for details

- pump.fun team for the innovative platform
- Solana Labs for the blockchain infrastructure  
- Wallet Adapter team for wallet integration tools

---

**⚠️ Disclaimer**: This tool is for educational and informational purposes. Always do your own research before making any investment decisions. 