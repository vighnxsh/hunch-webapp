'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useParams } from 'next/navigation';
import UserProfileView from '../../components/UserProfileView';

export default function UserPage() {
    const { ready, authenticated } = usePrivy();
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;

    // Redirect to login if not authenticated
    useEffect(() => {
        if (ready && !authenticated) {
            router.push('/');
        }
    }, [ready, authenticated, router]);

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

    // Show loading while redirecting if not authenticated
    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--text-secondary)] text-sm">Redirecting...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <main className="w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                <UserProfileView userId={userId} />
            </main>
        </div>
    );
}
