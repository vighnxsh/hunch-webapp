'use client';

import { usePrivy } from '@privy-io/react-auth';
import SocialFeed from '../components/SocialFeed';

export default function SocialPage() {
  const { ready } = usePrivy();

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show social feed - accessible to both authenticated and unauthenticated users
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 space-y-8">
        {/* Activity Feed Section */}
        <section>
          <SocialFeed />
        </section>
      </main>
    </div>
  );
}
