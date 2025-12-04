'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import SocialFeed from '../components/SocialFeed';

export default function SocialPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  // Show loading while Privy initializes or redirecting
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Social Feed Component */}
        <div className="mb-8">
          <SocialFeed />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-2xl font-black text-white tracking-tighter">
              hunch
            </div>
            <p className="text-gray-600 text-sm">
              © 2024 Hunch. Built on Solana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

