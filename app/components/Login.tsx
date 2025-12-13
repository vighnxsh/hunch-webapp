'use client';

import { useLogin, usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const { login } = useLogin({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated }) => {
      console.log('Login completed', { user, isNewUser, wasAlreadyAuthenticated });
      // Redirect to home after successful login
      router.push('/home');
    },
    onError: (error) => {
      console.error('Login error:', error);
      const errorMessage = String(error);
      if (errorMessage.includes('Redirect URL is not allowed') || errorMessage.includes('401')) {
        alert('Configuration Error: Please add http://localhost:3000 to your Privy app\'s allowed redirect URLs in the dashboard (Settings → OAuth → Redirect URLs)');
      } else {
        alert(`Login failed: ${errorMessage || 'Unknown error'}`);
      }
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login({ loginMethods: ['google'] });
    } catch (err: any) {
      setError(err.message || 'Failed to login with Google');
      console.error('Google login error:', err);
    } finally {
      // Don't set loading to false immediately - let Privy handle the flow
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const handleTwitterLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login({ loginMethods: ['twitter'] });
    } catch (err: any) {
      setError(err.message || 'Failed to login with X');
      console.error('Twitter login error:', err);
    } finally {
      // Don't set loading to false immediately - let Privy handle the flow
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-900/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-fuchsia-900/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and branding */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black tracking-tighter text-[var(--text-primary)] mb-3" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            hunch
          </h1>
          <p className="text-[var(--text-secondary)] text-lg font-light tracking-wide">
            Predict the future. Own your outcomes.
          </p>
        </div>

        {/* Login card */}
        <div className="bg-gradient-to-b from-[var(--surface)]/80 to-[var(--surface)]/40 backdrop-blur-xl border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Welcome back</h2>
            <p className="text-[var(--text-tertiary)] text-sm">Sign in to access prediction markets</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading && (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
              <span className="text-[var(--text-tertiary)] text-sm font-medium">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
            </div>

            {/* X (Twitter) Login Button */}
            <button
              onClick={handleTwitterLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-black hover:bg-gray-900 text-white font-semibold rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-800 hover:border-gray-700 shadow-lg hover:shadow-xl"
            >
              {isLoading && (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Continue with X
            </button>
          </div>

          {/* Terms notice */}
          <p className="text-center text-[var(--text-tertiary)] text-xs mt-8 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="#" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-[var(--text-tertiary)] text-sm">
            Powered by{' '}
            <span className="text-violet-400 font-medium">Solana</span>
          </p>
        </div>
      </div>
    </div>
  );
}
