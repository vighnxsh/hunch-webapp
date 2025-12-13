'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from './components/Login';

export default function LoginPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  // Redirect authenticated users to /home
  useEffect(() => {
    if (ready && authenticated) {
      router.push('/home');
    }
  }, [ready, authenticated, router]);

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!authenticated) {
    return <Login />;
  }

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
