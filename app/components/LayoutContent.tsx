'use client';

import { usePrivy } from '@privy-io/react-auth';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LayoutContent({ children }: { children: React.ReactNode }) {
    const { authenticated } = usePrivy();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch by not applying conditional class until mounted
    if (!mounted) {
        return <div>{children}</div>;
    }

    // Don't apply padding on login page or when not authenticated
    const shouldApplyPadding = authenticated && pathname !== '/';

    return (
        <div className={shouldApplyPadding ? 'md:pl-36' : ''}>
            {children}
        </div>
    );
}
