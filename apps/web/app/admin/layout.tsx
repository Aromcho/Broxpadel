import type { Metadata } from 'next';
import Shell from '@/admin/Shell';

export const metadata: Metadata = { title: { default: 'Panel', template: '%s · Panel Brox' }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
