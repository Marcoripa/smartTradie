'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase,
  Package,
  FileText,
  Users,
  LayoutDashboard,
  Radio,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Wifi,
} from 'lucide-react';
import { Badge } from '../ui/badge';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  const navigation = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: Briefcase,
      adminOnly: false,
    },
    {
      name: 'Materials',
      href: '/dashboard/inventory',
      icon: Package,
      adminOnly: false,
    },
    {
      name: 'Invoices',
      href: '/dashboard/invoices',
      icon: FileText,
      adminOnly: true, // Hidden from Tradies / Subcontractors
    },
    {
      name: 'Staff',
      href: '/dashboard/users',
      icon: Users,
      adminOnly: true, // Hidden from Tradies / Subcontractors
    },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-slate-950 border-r border-slate-800 text-slate-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm text-slate-100 leading-tight">SmartTradie</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Office Hub
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Management
        </div>

        {navigation.map((item) => {
          if (item.adminOnly && !isAdmin) {
            return null; // Hidden from non-admin users per RBAC specs
          }

          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span className="flex-1">{item.name}</span>
              {item.adminOnly && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  ADMIN
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400 shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-100 truncate">{user?.name || ''}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.business_name || ''}</p>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            router.push('/login');
          }}
          title="Sign out"
          className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
