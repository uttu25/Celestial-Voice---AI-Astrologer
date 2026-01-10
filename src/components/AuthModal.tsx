import React, { useState } from 'react';
import { User } from '../types';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, Loader, Ghost } from 'lucide-react';
import { api } from '../api';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGuestLogin = () => {
    const guestUser: User = {
      id: 'guest_' + Date.now(),
      name: 'Guest Seeker',
      email: 'guest@local',
      password: '',
      chatCount: 0,
      isPremium: false
    };
    onLogin(guestUser);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        const user = await api.login({ email, password });
        if (user) {
          onLogin(user);
        } else {
          setError("Invalid credentials");
        }
      } else {
        if (!name) {
          throw new Error("Name is required");
        }
        
        const user = await api.register({ email, password, name });
        if (user) {
          onLogin(user);
        } else {
          setError("Registration failed");
        }
      }
    } catch (err: any) {
      console.error(err);
      let msg = "An error occurred";
      
      if (err.message?.includes('Invalid login credentials')) {
        msg = "Invalid email or password.";
      } else if (err.message?.includes('already registered')) {
        msg = "Email already in use.";
      } else if (err.message?.includes('Password')) {
        msg = "Password should be at least 6 characters.";
      } else if (err.message) {
        msg = err.message;
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-3 animate-pulse" />
            <h2 className="text-2xl font-serif text-white mb-1">
              {isLogin ? 'Welcome Back' : 'Join the Cosmos'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isLogin ? 'Sign in to consult the stars' : 'Create your celestial identity'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative group">
                <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center bg-red-900/20 p-2 rounded-lg border border-red-900/50">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
              ) : (
                  <>
                    <span>{isLogin ? 'Enter' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
              <div className="h-px bg-slate-700 flex-1"></div>
              <span className="text-slate-500 text-xs">OR</span>
              <div className="h-px bg-slate-700 flex-1"></div>
          </div>

          <button 
            onClick={handleGuestLogin}
            className="w-full border border-slate-600 hover:bg-slate-800 text-slate-300 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Ghost className="w-4 h-4" />
            Continue as Guest
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-slate-400 text-sm hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
