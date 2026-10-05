import type { Metadata } from 'next';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: '50-50',
  description: 'Split expenses with friends, the lightweight way.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegister />
        <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
