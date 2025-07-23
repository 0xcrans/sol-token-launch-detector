import { NextPage } from 'next'
import Head from 'next/head'
import PumpMonitor from '../components/PumpMonitor'
import RaydiumMonitor from '../components/RaydiumMonitor'

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Blazing Monitor - Real-time DEX Tracker</title>
        <meta name="description" content="Real-time monitoring of pump.fun and Raydium DEX activities" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="min-h-screen p-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-[calc(100vh-2rem)] max-w-full mx-auto">
          <div className="h-full flex flex-col">
            <PumpMonitor />
          </div>
          <div className="h-full flex flex-col">
            <RaydiumMonitor />
          </div>
        </div>
      </main>
    </>
  )
}

export default Home 