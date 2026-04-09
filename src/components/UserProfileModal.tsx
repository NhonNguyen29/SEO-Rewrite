import React, { useState, useEffect } from 'react';
import { X, LogOut, Key, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth, db, logOut } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(1000000);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user || !isOpen) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setApiKey(data.geminiApiKey || '');
        setTokensUsed(data.tokensUsed || 0);
        setQuotaLimit(data.quotaLimit || 1000000);
      }
    });

    return () => unsubscribe();
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        geminiApiKey: apiKey
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save API key", error);
    } finally {
      setIsSaving(false);
    }
  };

  const percentageUsed = Math.min(100, (tokensUsed / quotaLimit) * 100);
  const isNearLimit = percentageUsed > 80;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full" />
            {user.displayName || 'User Profile'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Quota Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Database size={16} className="text-blue-500" />
              Token Usage & Quota
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tokens Used</span>
                <span className="font-semibold text-slate-700">{tokensUsed.toLocaleString()} / {quotaLimit.toLocaleString()}</span>
              </div>
              
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${isNearLimit ? 'bg-red-500' : 'bg-blue-500'}`} 
                  style={{ width: `${percentageUsed}%` }}
                ></div>
              </div>
              
              {isNearLimit && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                  <AlertCircle size={12} />
                  You are approaching your quota limit. Please add your own API key below.
                </p>
              )}
            </div>
          </div>

          {/* API Key Section */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Key size={16} className="text-amber-500" />
              Personal Gemini API Key
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              If you exceed the free quota, you can use your own Gemini API key. It will be stored securely in your account.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
            />
            <div className="mt-3 flex items-center justify-between">
              {saveSuccess ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Saved successfully
                </span>
              ) : <span></span>}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
          <button
            onClick={() => {
              logOut();
              onClose();
            }}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
