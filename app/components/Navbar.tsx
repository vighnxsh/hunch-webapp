'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { clearAuthCache } from '../lib/authSync';

export default function Navbar() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter wallets to only Solana wallets
  const solanaWallets = wallets.filter((wallet) => {
    if (wallet.walletClientType === 'privy') return true;
    if (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32) {
      return true;
    }
    return false;
  });

  const solanaWallet = solanaWallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  ) || solanaWallets[0];

  const walletAddress = solanaWallet?.address;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getUserDisplayName = () => {
    if (user?.twitter?.username) {
      return `@${user.twitter.username}`;
    }
    if (user?.google?.email) {
      return user.google.email.split('@')[0];
    }
    if (walletAddress) {
      return truncateAddress(walletAddress);
    }
    return 'User';
  };

  const getUserAvatar = () => {
    if (user?.twitter?.profilePictureUrl) {
      return user.twitter.profilePictureUrl;
    }
    return null;
  };

  const isActive = (path: string) => pathname === path;

  if (!mounted) {
    return (
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-6 bg-[var(--nav-bg)] border-r border-[var(--border-color)] z-50">
        <div className="w-10 h-10 flex items-center justify-center">
          <img src="/image.png" alt="Hunch" className="w-full h-full object-contain" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-6 bg-[var(--nav-bg)] backdrop-blur-xl border-r border-[var(--border-color)] z-50">
      {/* Logo */}
      <Link
        href={authenticated ? '/home' : '/'}
        className="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity mb-8"
      >
        <img src="/image.png" alt="Hunch" className="w-full h-full object-contain" />
      </Link>

      {/* Navigation Links */}
      {authenticated && (
        <div className="flex-1 flex flex-col items-center gap-4">
          {/* Home */}
          <Link
            href="/home"
            className={`p-3 rounded-xl transition-all duration-200 ${isActive('/home')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Home"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </Link>

          {/* Social Feed */}
          <Link
            href="/social"
            className={`p-3 rounded-xl transition-all duration-200 ${isActive('/social')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Social Feed"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </Link>

          {/* Profile */}
          <Link
            href="/profile"
            className={`p-3 rounded-xl transition-all duration-200 ${isActive('/profile')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Profile"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </Link>
        </div>
      )}

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-4 mt-auto">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* User Menu */}
        {ready && authenticated && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] transition-all duration-200"
              title={getUserDisplayName()}
            >
              {getUserAvatar() ? (
                <img
                  src={getUserAvatar()!}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute left-full bottom-0 ml-2 w-72 bg-[var(--dropdown-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-20 overflow-hidden">
                  <div className="p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      {getUserAvatar() ? (
                        <img
                          src={getUserAvatar()!}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {getUserDisplayName().charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-[var(--text-primary)] font-medium text-sm">
                          {getUserDisplayName()}
                        </p>
                        {walletAddress && (
                          <p className="text-[var(--text-tertiary)] text-xs font-mono">
                            {truncateAddress(walletAddress)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {walletAddress && (
                    <div className="p-4 border-b border-[var(--border-color)]">
                      <p className="text-[var(--text-tertiary)] text-xs mb-2 uppercase tracking-wider font-medium">
                        Wallet Address
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-[var(--text-secondary)] text-xs font-mono bg-[var(--input-bg)] px-3 py-2 rounded-lg flex-1 truncate">
                          {walletAddress}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(walletAddress)}
                          className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                          title="Copy address"
                        >
                          <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-2 space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setShowDropdown(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </Link>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        clearAuthCache(); // Clear cached auth data
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
