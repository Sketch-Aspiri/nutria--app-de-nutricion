'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useAppState } from '@/store/app-state';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { hydrated, loggedIn } = useAppState();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !loggedIn) router.replace('/login');
  }, [hydrated, loggedIn, router]);

  if (!hydrated || !loggedIn) {
    return <div className="min-h-screen bg-stone-50" />;
  }

  return (
    <div className="flex h-screen bg-stone-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}
