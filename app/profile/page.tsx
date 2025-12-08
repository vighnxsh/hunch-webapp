'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Profile from '../components/Profile';
import { useTheme } from '../components/ThemeProvider';

export default function ProfilePage() {
  
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  // Show loading while Privy initializes or redirecting
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

  // Show loading while redirecting if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)] text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Theme Toggle - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-surface border border-border shadow-lg transition-all duration-200 hover:scale-110"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <Profile />
      </main>
    </div>
  );
}
