'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import WalletMultiButton to prevent SSR issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { 
    ssr: false,
    loading: () => (
      <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse" />
    )
  }
);

export default function Navbar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              hunch
            </div>
          </div>
          <div className="flex items-center">
            {mounted && <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />}
          </div>
        </div>
      </div>
    </nav>
  );
}

