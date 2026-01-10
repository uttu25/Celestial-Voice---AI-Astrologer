import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import { Mail, Lock, User as UserIcon, ArrowRight, Sparkles } from 'lucide-react';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
        const displayName = name || email.split('@')[0];
        const user = await api.createUser({ name: displayName });
        if(user) onLogin(user);
    } catch (error) {
        alert("Authentication failed");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_50px_rgba(139,92,246,0.15)] backdrop-blur-xl transition-all">
        
        {/* Glowing Orbs */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]"></div>
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px]"></div>

        <div className="relative z-10 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-white/10 shadow-inner">
              <Sparkles className="h-8 w-8 text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]" />
            </div>
            
            <h2 className="mb-2 font-serif text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-200 tracking-wide">
                {isSignUp ? 'Join the Cosmos' : 'Celestial Voice'}
            </h2>
            <p className="mb-8 text-sm text-purple-200/60 font-light tracking-wider">
                {isSignUp ? 'Begin your spiritual journey' : 'Sign in to consult the stars'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                    <div className="relative group">
                        <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50" />
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5" />
                    </div>
                )}
                <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5" />
                </div>
                <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5" />
                </div>
                <button disabled={loading} className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 text-white shadow-lg">
                    <span className="relative flex items-center justify-center gap-2 font-medium tracking-wide">
                        {loading ? 'Aligning...' : (isSignUp ? 'Create Account' : 'Enter the Void')} <ArrowRight className="h-4 w-4" />
                    </span>
                </button>
            </form>
            <div className="mt-8">
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs uppercase tracking-widest text-purple-300/60 hover:text-purple-300 transition-colors">
                    {isSignUp ? 'Sign In' : 'Create Account'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
export default AuthModal;
