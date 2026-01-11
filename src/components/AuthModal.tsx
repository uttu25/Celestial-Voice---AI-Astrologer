import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import { Mail, Lock, User as UserIcon, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
        let user;
        
        if (isSignUp) {
           // REAL SIGN UP
           if (!name) {
             setErrorMsg('Please enter your name.');
             setLoading(false);
             return;
           }
           user = await api.register({ email, password, name });
        } else {
           // REAL LOGIN
           user = await api.login({ email, password });
        }

        if (user) {
            onLogin(user);
        } else {
            setErrorMsg('Invalid credentials. Please try again.');
        }

    } catch (error: any) {
        console.error("Auth Error:", error);
        // Clean error message for user
        const msg = error.message || "Authentication failed. Please check your connection.";
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Background Dim */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_0_50px_rgba(139,92,246,0.2)] backdrop-blur-xl transition-all">
        
        {/* Decorative Glows */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]"></div>
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px]"></div>

        <div className="relative z-10 text-center">
            {/* Header Icon */}
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-white/10 shadow-inner ring-1 ring-white/5">
              <Sparkles className="h-8 w-8 text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]" />
            </div>
            
            <h2 className="mb-2 font-serif text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-200 tracking-wide">
                {isSignUp ? 'Join the Cosmos' : 'Celestial Voice'}
            </h2>
            <p className="mb-8 text-sm text-purple-200/60 font-light tracking-wider">
                {isSignUp ? 'Begin your spiritual journey' : 'Sign in to consult the stars'}
            </p>

            {/* Error Message Display */}
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                    <div className="relative group">
                        <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50 group-focus-within:text-purple-300 transition-colors" />
                        <input 
                          type="text" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          placeholder="Your Name" 
                          className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5 focus:ring-1 focus:ring-purple-500/20" 
                        />
                    </div>
                )}
                
                <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50 group-focus-within:text-purple-300 transition-colors" />
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="Email Address" 
                      className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5 focus:ring-1 focus:ring-purple-500/20" 
                    />
                </div>
                
                <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-purple-300/50 group-focus-within:text-purple-300 transition-colors" />
                    <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="Password" 
                      className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-white placeholder-white/20 outline-none backdrop-blur-md transition-all focus:border-purple-500/50 focus:bg-white/5 focus:ring-1 focus:ring-purple-500/20" 
                    />
                </div>

                <button 
                  disabled={loading} 
                  type="submit"
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-purple-500/25"
                >
                    <span className="relative flex items-center justify-center gap-2 font-medium tracking-wide">
                        {loading ? 'Connecting to Stars...' : (isSignUp ? 'Create Account' : 'Enter the Void')} 
                        {!loading && <ArrowRight className="h-4 w-4" />}
                    </span>
                </button>
            </form>

            <div className="mt-8">
                <button onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }} className="text-xs uppercase tracking-widest text-purple-300/60 hover:text-purple-300 transition-colors hover:underline underline-offset-4">
                    {isSignUp ? 'Already have an account? Sign In' : 'New User? Create Account'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
