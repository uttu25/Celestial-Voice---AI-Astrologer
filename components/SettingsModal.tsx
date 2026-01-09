import React, { useState } from 'react';
import { User, Language } from '../types';
import { X, User as UserIcon, Lock, LogOut, Trash2, CheckCircle, Eraser, Crown, Edit2, Save, Globe } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface SettingsModalProps {
  user: User;
  currentLanguage: Language;
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onDeleteUser: () => void;
  onLanguageChange: (lang: Language) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  user, 
  currentLanguage,
  onClose, 
  onLogout, 
  onUpdateUser,
  onDeleteUser,
  onLanguageChange
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSaveProfile = async () => {
    try {
        // Update in Firestore
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, { name: editName });
        
        // Update local state
        onUpdateUser({ ...user, name: editName });
        
        setIsEditing(false);
        setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (e) {
        console.error(e);
        setMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPass !== user.password) {
      setMessage({ type: 'error', text: 'Incorrect current password' });
      return;
    }
    if (newPass.length < 4) {
      setMessage({ type: 'error', text: 'Password too short' });
      return;
    }

    const updatedUser = { ...user, password: newPass };
    
    // Update local storage simulation for password (in real app, use Firebase Auth updatePassword)
    const storedUsersStr = localStorage.getItem('celestial_users');
    if (storedUsersStr) {
      const users: User[] = JSON.parse(storedUsersStr);
      const newUsers = users.map(u => u.id === user.id ? updatedUser : u);
      localStorage.setItem('celestial_users', JSON.stringify(newUsers));
      localStorage.setItem('celestial_currentUser', JSON.stringify(updatedUser));
    }
    
    onUpdateUser(updatedUser);
    setMessage({ type: 'success', text: 'Password updated successfully' });
    setOldPass('');
    setNewPass('');
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete your celestial identity? This cannot be undone.")) {
      const storedUsersStr = localStorage.getItem('celestial_users');
      if (storedUsersStr) {
        const users: User[] = JSON.parse(storedUsersStr);
        const newUsers = users.filter(u => u.id !== user.id);
        localStorage.setItem('celestial_users', JSON.stringify(newUsers));
        localStorage.removeItem('celestial_currentUser');
      }
      // Also clear history
      localStorage.removeItem(`celestial_history_${user.id}`);
      onDeleteUser();
    }
  };

  const handleClearMemory = () => {
    if (window.confirm("Forget all past conversations? The astrologer will not remember your previous details.")) {
        localStorage.removeItem(`celestial_history_${user.id}`);
        setMessage({ type: 'success', text: 'Memory cleared successfully' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-serif text-white mb-6 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-purple-400" />
          Settings
        </h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700/50 pb-2">
          <button 
            onClick={() => { setActiveTab('profile'); setMessage(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Profile
          </button>
          <button 
            onClick={() => { setActiveTab('password'); setMessage(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'password' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Security
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            
            {/* Subscription Status Card */}
            <div className={`rounded-xl p-4 border ${user.isPremium ? 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Plan Status</div>
                    {user.isPremium ? (
                        <Crown className="w-4 h-4 text-yellow-400" />
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">Free</span>
                    )}
                </div>
                <div className={`font-medium text-lg ${user.isPremium ? 'text-yellow-400' : 'text-white'}`}>
                    {user.isPremium ? 'Premium Soul' : `${user.chatCount ?? 0} / 3 Sessions Used`}
                </div>
                {!user.isPremium && (
                    <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-purple-500 transition-all duration-500" 
                            style={{width: `${Math.min(100, ((user.chatCount ?? 0) / 3) * 100)}%`}}
                        ></div>
                    </div>
                )}
            </div>

            {/* Name Editing */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Name</div>
                  <button 
                    onClick={() => {
                        if(isEditing) handleSaveProfile();
                        else setIsEditing(true);
                    }}
                    className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1"
                  >
                      {isEditing ? <><Save className="w-3 h-3" /> Save</> : <><Edit2 className="w-3 h-3" /> Edit</>}
                  </button>
              </div>
              {isEditing ? (
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-purple-500 outline-none"
                  />
              ) : (
                  <div className="text-white font-medium">{user.name}</div>
              )}
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</div>
              <div className="text-white font-medium">{user.email}</div>
            </div>

            {/* Language Selector */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
               <div className="flex items-center gap-2 mb-2">
                   <Globe className="w-4 h-4 text-purple-400" />
                   <div className="text-xs text-slate-400 uppercase tracking-wider">Preferred Language</div>
               </div>
               <div className="grid grid-cols-2 gap-2 mt-2">
                   {Object.values(Language).map(lang => (
                       <button
                           key={lang}
                           onClick={() => {
                               onLanguageChange(lang);
                               setMessage({ type: 'success', text: `Language set to ${lang}` });
                           }}
                           className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                               currentLanguage === lang 
                               ? 'bg-purple-900/50 border-purple-500 text-white' 
                               : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                           }`}
                       >
                           {lang}
                       </button>
                   ))}
               </div>
            </div>

            {message && message.type === 'success' && (
               <div className="text-xs p-2 rounded flex items-center gap-2 bg-green-900/20 text-green-400">
                <CheckCircle className="w-3 h-3" />
                {message.text}
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button 
                onClick={handleClearMemory}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/30 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2"><Eraser className="w-4 h-4" /> Clear Memory</span>
              </button>

              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/30 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign Out</span>
              </button>
              
              <button 
                onClick={handleDelete}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-900/10 text-red-400 hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-900/30"
              >
                <span className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Current Password</label>
              <input
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">New Password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {message && (
              <div className={`text-xs p-2 rounded flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                {message.type === 'success' && <CheckCircle className="w-3 h-3" />}
                {message.text}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;