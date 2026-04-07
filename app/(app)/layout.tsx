import { Sidebar } from '@/components/layout/sidebar';
import type { ReactNode } from 'react';
import { Topbar } from '@/components/layout/topbar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
