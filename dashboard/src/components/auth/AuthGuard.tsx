'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Radio, ShieldAlert } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      console.log(`[AuthGuard] Unauthenticated access to ${pathname}. Redirecting to /login...`);
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, pathname, router]);

  // Handle Admin-only route protection (RBAC)
  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      const adminOnlyRoutes = ['/dashboard/invoices', '/dashboard/users'];
      const isRestricted = adminOnlyRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      if (isRestricted) {
        console.warn(`[AuthGuard] Role '${role}' denied access to ${pathname}. Redirecting to /dashboard...`);
        router.replace('/dashboard');
      }
    }
  }, [isLoading, user, isAdmin, role, pathname, router]);

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <Radio className="h-8 w-8 animate-pulse" />
          </div>
        </div>
        <h2 className="text-base font-bold text-slate-100">SmartTradie</h2>
        <p className="text-xs text-slate-400 mt-1">Verifying secure session & business tenant...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Block non-admins from admin routes while redirecting
  if (!isAdmin) {
    const adminOnlyRoutes = ['/dashboard/invoices', '/dashboard/users'];
    const isRestricted = adminOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (isRestricted) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
          <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100">Access Restricted</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            This module is reserved for Office Administrators. Redirecting to your tradie overview...
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
};
