import React, { useState } from 'react';
import { Search, X, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { triggerActionHaptic } from '../utils/hapticsService';

interface NaturalLanguageSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  appliedSummary?: string;
  noDataMessage?: string;
  totalResultsCount: number;
}

export const NaturalLanguageSearchBar: React.FC<NaturalLanguageSearchBarProps> = ({
  query,
  onQueryChange,
  appliedSummary,
  noDataMessage,
  totalResultsCount,
}) => {
  const [inputValue, setInputValue] = useState(query);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerActionHaptic();
    onQueryChange(inputValue);
  };

  const handleClear = () => {
    triggerActionHaptic();
    setInputValue('');
    onQueryChange('');
  };

  const handleSampleClick = (sample: string) => {
    triggerActionHaptic();
    setInputValue(sample);
    onQueryChange(sample);
  };

  const sampleQuestions = [
    'earthquakes this week',
    'fires near me',
    'biggest today',
    'floods in Spain',
    'hurricanes this month',
  ];

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-amber-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            // Instant update if empty
            if (e.target.value.trim().length === 0) {
              onQueryChange('');
            }
          }}
          placeholder="Ask a question in plain English (e.g. 'earthquakes this week', 'fires near me')..."
          className="w-full pl-10 pr-24 py-3 bg-slate-900 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 shadow-inner"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      {/* Suggested question chips for mobile users */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">Try asking:</span>
        {sampleQuestions.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => handleSampleClick(sample)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-700/60 cursor-pointer active:scale-95"
          >
            "{sample}"
          </button>
        ))}
      </div>

      {/* Filter interpretation or No Data Notice */}
      {query.trim().length > 0 && (
        <div className="pt-1">
          {noDataMessage ? (
            <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <p className="font-bold">I don't have data for that.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No verified disaster reports found matching "{query}" in the live feeds from USGS or NASA.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Showing: <strong className="text-slate-200">{appliedSummary}</strong></span>
              </span>
              <span className="font-mono text-amber-300 font-bold shrink-0 ml-2">
                {totalResultsCount} found
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
