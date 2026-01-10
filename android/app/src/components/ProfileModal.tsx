import React from 'react';
import { X, Crown, Edit, Sparkles } from 'lucide-react';
import { User } from '../types';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onEdit: () => void;
  onSubscribe: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onEdit, onSubscribe }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-3xl font-serif text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* User Info */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif text-white mb-2">{user.name}</h2>
            <p className="text-slate-400 text-sm mb-4">{user.email}</p>
            
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              user.isPremium 
                ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30' 
                : 'bg-slate-800 border border-slate-700'
            }`}>
              {user.isPremium ? (
                <>
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">Premium Soul</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400">Free Seeker</span>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          {!user.isPremium && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-2">Sessions Used</p>
                <p className="text-3xl font-bold text-white">{user.chatCount || 0} / 3</p>
                <div className="mt-3 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500" 
                    style={{width: `${Math.min(100, ((user.chatCount || 0) / 3) * 100)}%`}}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button 
              onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>

            {!user.isPremium && (
              <button 
                onClick={onSubscribe}
                className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
