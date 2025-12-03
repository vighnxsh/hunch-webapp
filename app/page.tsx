import Navbar from "./components/Navbar";
import SignTransaction from "./components/SignTransaction";
import SendTransaction from "./components/SendTransaction";
import MarketsList from "./components/MarketsList";
import EventsList from "./components/EventsList";
import UserPositions from "./components/UserPositions";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Prediction Markets
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet and interact with prediction markets on Solana
          </p>
        </div>
        <div className="mb-6">
          <UserPositions />
        </div>
        <div className="mb-6">
          <EventsList />
        </div>
        <div className="mb-6">
          <MarketsList />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SignTransaction />
          <SendTransaction />
        </div>
      </main>
    </div>
  );
}
