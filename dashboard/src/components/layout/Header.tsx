'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/badge';
import { ShieldCheck, UserCheck, Radio, Plus, Building2 } from 'lucide-react';
import { Button } from '../ui/button';

export const Header: React.FC = () => {
  const { user, isAdmin } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Mobile branding + business identity */}
      <div className="flex items-center gap-3">
        <div className="flex lg:hidden items-center gap-2">
          <div className="h-7 w-7 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Radio className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm text-slate-100">SmartTradie</span>
        </div>

        {user?.business_name && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <Building2 className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-semibold text-slate-200">{user.business_name}</span>
          </div>
        )}
      </div>

      {/* Right: Authenticated User Status & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* User Identity & Role Badge */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-sky-400">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-slate-200 leading-tight">{user?.name || 'Logged User'}</p>
          </div>
          <Badge
            variant={isAdmin ? 'default' : 'secondary'}
            className="text-[10px] py-0 px-2 font-bold"
          >
            {isAdmin ? (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                ADMIN
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                TRADIE
              </span>
            )}
          </Badge>
        </div>
      </div>
    </header>
  );
};
