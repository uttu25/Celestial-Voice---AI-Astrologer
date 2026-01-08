import React, { useState } from 'react';
import { Crown, Star, CheckCircle, Loader } from 'lucide-react';

interface SubscriptionModalProps {
  onSubscribe: () => void;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onSubscribe, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribeClick = () => {
    setIsLoading(true);
    // Simulate payment processing delay
    setTimeout(() => {
      setIsLoading(false);
      onSubscribe();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-purple-900/40 border border-yellow-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-yellow-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 mb-6 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
            <Crown className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl font-serif text-white mb-2">Unlock Your Destiny</h2>
          <p className="text-yellow-100/80 mb-8">
            You have used your 3 free consultations. The stars have more to reveal, but deep wisdom requires commitment.
          </p>

          <div className="bg-white/5 rounded-2xl p-6 mb-8 text-left border border-white/10">
            <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-4">Premium Membership</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-200 text-sm">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                Unlimited Cosmic Conversations
              </li>
              <li className="flex items-center gap-3 text-slate-200 text-sm">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                Detailed Vedic Remedies & Rituals
              </li>
              <li className="flex items-center gap-3 text-slate-200 text-sm">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                Personalized Kundali Analysis
              </li>
            </ul>
          </div>

          <div className="mb-8">
            <span className="text-4xl font-bold text-white">$9.99</span>
            <span className="text-slate-400"> / month</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSubscribeClick}
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold text-lg hover:shadow-[0_0_25px_rgba(234,179,8,0.4)] transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5 fill-white" />
                  Subscribe Now
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;