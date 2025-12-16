'use client';

import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const { ready, authenticated, user, logout } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const { login } = useLogin({
    onComplete: () => {
      router.push('/home');
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => pathname === path;

  // Get user display info
  const getUserInfo = () => {
    if (!user) return { name: 'Guest', email: '', avatar: null };

    const email = user.email?.address || '';
    const googleAccount = user.linkedAccounts?.find((acc: any) => acc.type === 'google_oauth') as any;
    const twitterAccount = user.linkedAccounts?.find((acc: any) => acc.type === 'twitter_oauth') as any;

    const name = googleAccount?.name || twitterAccount?.name || email.split('@')[0] || 'User';
    const avatar = googleAccount?.picture_url || twitterAccount?.profile_picture_url || null;

    return { name, email, avatar };
  };

  const { name, email, avatar } = getUserInfo();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowProfileMenu(false);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!mounted) {
    return (
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-36 flex-col items-center py-6 bg-[var(--nav-bg)] border-r border-[var(--border-color)] z-50">
        <div className="w-14 h-14 relative logo-glow">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain relative z-10" />
        </div>
      </nav>
    );
  }

  // Hide sidebar on login page
  if (pathname === '/') {
    return null;
  }

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-36 flex-col items-center py-6 bg-[var(--nav-bg)] backdrop-blur-xl border-r border-[var(--border-color)] z-50">
      {/* Logo */}
      <Link
        href={authenticated ? '/home' : '/'}
        className="w-14 h-14 hover:opacity-80 transition-opacity mb-8 relative logo-glow"
      >
        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain relative z-10" />
      </Link>

      {/* Navigation Links */}
      {authenticated && (
        <div className="flex-1 flex flex-col items-center gap-4">
          {/* Home */}
          <Link
            href="/home"
            className={`p-4 rounded-xl transition-all duration-200 ${isActive('/home')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Home"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`p-4 rounded-xl transition-all duration-200 ${isActive('/social')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Social Feed"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`p-4 rounded-xl transition-all duration-200 ${isActive('/profile')
              ? 'bg-[var(--surface)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            title="Profile"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </nav>
  );
}
