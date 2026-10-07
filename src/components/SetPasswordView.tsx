import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, User, Mail, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface SetPasswordViewProps {
  initialFullName: string;
  userEmail: string;
  onSuccess: (updatedName: string) => void;
}

export const SetPasswordView: React.FC<SetPasswordViewProps> = ({
  initialFullName,
  userEmail,
  onSuccess
}) => {
  const [fullName, setFullName] = useState(initialFullName || userEmail.split('@')[0] || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      // 1. Update Supabase Auth user password and metadata
      const { data, error } = await supabase.auth.updateUser({
        password: password,
        data: {
          full_name: trimmedName,
          has_password_set: true
        }
      });

      if (error) {
        throw error;
      }

      // 2. Persist updated name to public.users table if accessible
      try {
        const userId = data.user?.id;
        if (userId) {
          await supabase
            .from('users')
            .upsert({
              id: userId,
              email: userEmail,
              name: trimmedName
            });
        }
      } catch (dbErr) {
        console.warn('[SetPasswordView] Direct profile upsert warning (handled by auth trigger):', dbErr);
      }

      setSuccessMsg('Password successfully created! Your full name is linked.');
      setTimeout(() => {
        onSuccess(trimmedName);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-neutral-100 selection:bg-white selection:text-neutral-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white text-neutral-950 font-bold text-xl shadow-lg mb-4">
          RO
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Create Account Password
        </h2>
        <p className="mt-1.5 text-xs text-neutral-400 max-w-sm mx-auto">
          You connected via Google OAuth. Set a password and link your full name so you can sign in directly with email & password anytime.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-950 py-8 px-6 shadow-2xl rounded-2xl border border-neutral-800 sm:px-10 space-y-6">
          {/* Google Connected Badge */}
          <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-neutral-200">Google OAuth Connected</span>
                <span className="text-[10px] text-neutral-400 font-mono">{userEmail}</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900 font-medium">
              Verified
            </span>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Full Name (Linked to Account)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Avinash Rao"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-800 bg-neutral-900 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                This full name will appear across your workspace, dashboard, and outreach logs.
              </p>
            </div>

            {/* Email (Readonly) */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Account Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  disabled
                  value={userEmail}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-800/80 bg-neutral-900/50 text-neutral-400 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Create Password
                </label>
                <span className="text-[10px] text-neutral-500">Min. 6 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-neutral-800 bg-neutral-900 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-800 bg-neutral-900 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-white text-neutral-950 font-semibold text-xs rounded-lg hover:bg-neutral-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Setting password & profile...</span>
                </>
              ) : (
                <>
                  <span>Save Password & Enter Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="pt-2 border-t border-neutral-900 text-center flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Enables dual sign-in: Google OAuth or Email & Password</span>
          </div>
        </div>
      </div>
    </div>
  );
};
