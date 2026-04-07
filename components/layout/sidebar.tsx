import Link from 'next/link';
import { LayoutDashboard, Music2 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 flex-col border-r border-border bg-surface/50 p-5 lg:flex">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Music2 className="h-5 w-5 text-brand" /> Harmony
      </div>
      <nav className="space-y-2">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white">
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
