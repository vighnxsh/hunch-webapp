'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNavbar() {
  const { ready, authenticated } = usePrivy();
  const pathname = usePathname();

  // Only show when authenticated
  if (!ready || !authenticated) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-[var(--border-color)] bg-[var(--background)] backdrop-blur-xl safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-4 pb-safe">
        {/* Home Link - Left */}
        <Link
          href="/home"
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
            isActive('/home')
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-200 ${
              isActive('/home') ? 'scale-110' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </Link>

        {/* Social Link - Middle */}
        <Link
          href="/social"
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
            isActive('/social')
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span className="text-xl font-bold">Hunch</span>
        </Link>

        {/* Profile Link - Right */}
        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
            isActive('/profile')
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-200 ${
              isActive('/profile') ? 'scale-110' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
