import { ThemeToggle } from '../theme-toggle';
import { notFound } from 'next/navigation';
import { currentHost, isAdminHost } from '@/lib/tenant';

export const metadata = { title: 'Platform admin' };

// proxy.ts already 404s /platform on other hosts; this keeps the guarantee if the matcher ever changes.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminHost(await currentHost())) notFound();
  return (
    <main className="main">
      <ThemeToggle corner />
      {children}
    </main>
  );
}
