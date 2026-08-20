'use client';

import React from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Header } from '../../components/layout/Header';
import { AuthGuard } from '../../components/auth/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-950 text-slate-100">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
