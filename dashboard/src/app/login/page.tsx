'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Radio,
  Lock,
  Mail,
  ArrowRight,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, automatically redirect to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectUrl);
    }
  }, [user, isLoading, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your work email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(email.trim(), password);
      router.replace(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-slate-100">Sign in to your account</CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Enter your registered work email and password. Your business tenant is resolved automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="email"
                type="email"
                placeholder="you@yourcompany.com.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-slate-950 text-xs"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9 bg-slate-950 text-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full bg-sky-500 hover:bg-sky-600 font-semibold text-xs h-9 mt-3 cursor-pointer"
          >
            {isSubmitting ? 'Verifying credentials...' : 'Sign In'}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0 pb-4 text-center border-t border-slate-800/60 mt-2">
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-3">
          <Building2 className="h-3 w-3 text-sky-400" />
          <span>Multi-Tenant Cloud Sync • Sydney Region</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Direct Firestore Auth & Dynamic Business Resolution
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Background Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-lg shadow-sky-500/10 mb-1">
            <Radio className="h-7 w-7 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            SmartTradie Office Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Trade operations, field voice note verification & ATO-compliant invoicing.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-slate-500 text-xs">Loading login portal...</div>}>
          <LoginForm />
        </Suspense>

        {/* Feature Pill Footer */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> ATO Tax Compliant
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" /> Edge AI Voice Sync
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" /> Offline Mobile First
          </span>
        </div>
      </div>
    </div>
  );
}
