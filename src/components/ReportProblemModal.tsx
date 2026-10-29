import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Send, MessageSquare } from 'lucide-react';
import { triggerActionHaptic } from '../utils/hapticsService';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEventName?: string;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  selectedEventName,
}) => {
  const [category, setCategory] = useState('Data looks incorrect or outdated');
  const [details, setDetails] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerActionHaptic();

    // Log report to localStorage for review
    const reportItem = {
      id: `report-${Date.now()}`,
      category,
      details,
      contactEmail: contactEmail.trim() || 'Anonymous',
      relatedIncident: selectedEventName || 'General',
      timestamp: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem('disaster_app_user_reports') || '[]');
      existing.push(reportItem);
      localStorage.setItem('disaster_app_user_reports', JSON.stringify(existing));
    } catch {
      // Storage unavailable
    }

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setDetails('');
      setContactEmail('');
      onClose();
    }, 2200);
  };

  return (
    <div 
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Report a Problem</h3>
              <p className="text-xs text-slate-400">Help us keep disaster data accurate and accessible</p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerActionHaptic();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-bold text-white text-base">Thank you for your report!</h4>
            <p className="text-xs text-slate-300">
              Your feedback has been logged to ensure our multi-agency feeds remain reliable and accurate.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {selectedEventName && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                <span className="text-[10px] text-amber-400 font-bold uppercase block">Regarding Incident:</span>
                <span className="font-semibold text-white">{selectedEventName}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-slate-300">What is the issue?</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="Data looks incorrect or outdated">Data looks incorrect or outdated</option>
                <option value="My location is not detecting properly">My location is not detecting properly</option>
                <option value="Live feeds are not updating">Live feeds are not updating</option>
                <option value="Map is slow or hard to navigate on phone">Map is slow or hard to navigate on phone</option>
                <option value="Official agency advisory link is broken">Official agency advisory link is broken</option>
                <option value="Other feedback or question">Other feedback or question</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Description (Optional details)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what you see or what went wrong..."
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Your Email (Optional, if you'd like a follow-up)</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. name@example.com"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Report</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
