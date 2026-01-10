import React, { useState } from 'react';
import { X, FileText, MessageSquare, Loader } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  transcript: string;
  isLoading: boolean;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  summary, 
  transcript, 
  isLoading 
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-serif text-white mb-4">Session Reading</h2>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'summary' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Summary
            </button>
            <button 
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'transcript' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Transcript
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-8 h-8 text-purple-500 animate-spin mb-4" />
              <p className="text-slate-400">Consulting the cosmic archives...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-purple max-w-none">
              {activeTab === 'summary' ? (
                <div 
                  className="text-slate-300 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: summary.replace(/###\s+(.+)/g, '<h3 class="text-purple-400 mt-6 mb-3">$1</h3>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {transcript.split('\n').map((line, i) => {
                    const isUser = line.startsWith('User:');
                    const isAstrologer = line.startsWith('Astrologer:');
                    
                    if (!line.trim()) return null;
                    
                    return (
                      <div 
                        key={i} 
                        className={`p-4 rounded-xl ${
                          isUser 
                            ? 'bg-slate-800 border-l-4 border-purple-500' 
                            : isAstrologer 
                            ? 'bg-indigo-900/30 border-l-4 border-yellow-500'
                            : 'bg-slate-800/50'
                        }`}
                      >
                        <p className="text-sm font-medium text-purple-300 mb-1">
                          {isUser ? 'You' : isAstrologer ? 'Astrologer' : ''}
                        </p>
                        <p className="text-slate-200">
                          {line.replace(/^(User:|Astrologer:)\s*/, '')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
