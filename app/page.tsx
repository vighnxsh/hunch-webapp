'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  // Redirect to home page - the main entry point is now /home
  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] text-sm">Loading...</p>
      </div>
    </div>
  );
}
