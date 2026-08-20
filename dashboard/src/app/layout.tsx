import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'SmartTradie Office Dashboard | Business Management & ATO Invoicing',
  description:
    'Office management dashboard for tradies and contractors. Real-time project tracking, voice note material approvals, inventory control, and ATO-compliant Tax Invoices.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
