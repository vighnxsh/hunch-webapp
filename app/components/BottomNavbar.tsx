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
    <div className="fixed bottom-6 left-0 right-0 z-50 md:hidden flex justify-center safe-area-bottom">
      <nav className="flex items-center gap-2 py-3 bg-[var(--background)] border-2 border-[var(--border-color)] rounded-full shadow-xl">
        {/* Home Link */}
        <Link
          href="/home"
          className={`p-3 rounded-full transition-all duration-200 ${
            isActive('/home')
              ? 'bg-[var(--text-primary)] text-[var(--background)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </Link>

        {/* Logo - Center */}
        <Link
          href="/social"
          className={`px-2 mx-5 py-2 rounded-full transition-all duration-200 ${
            isActive('/social')
              ? 'bg-[var(--text-primary)]'
              : ''
          }`}
        >
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        </Link>

        {/* Profile Link */}
        <Link
          href="/profile"
          className={`p-3 rounded-full transition-all duration-200 ${
            isActive('/profile')
              ? 'bg-[var(--text-primary)] text-[var(--background)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </Link>
      </nav>
    </div>
  );
}
