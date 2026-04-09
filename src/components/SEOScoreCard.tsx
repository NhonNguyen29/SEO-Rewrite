import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export interface SEOScoreData {
  overall: number;
  readability: number;
  keywordOptimization: number;
  eeat: number;
  feedback: string[];
}

interface SEOScoreCardProps {
  score: SEOScoreData | null;
  isScoring: boolean;
}

export function SEOScoreCard({ score, isScoring }: SEOScoreCardProps) {
  if (isScoring) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
          <div className="h-6 bg-slate-200 rounded w-48"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!score) return null;

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-500';
    if (value >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Activity size={20} className="text-blue-600" />
          SEO Score Analysis
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Overall Score</span>
          <div className={`text-3xl font-black ${getScoreColor(score.overall)}`}>
            {score.overall}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Readability', value: score.readability },
          { label: 'Keyword Opt.', value: score.keywordOptimization },
          { label: 'E-E-A-T', value: score.eeat }
        ].map((metric) => (
          <div key={metric.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{metric.label}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${getScoreBg(metric.value)}`} 
                  style={{ width: `${metric.value}%` }}
                ></div>
              </div>
              <span className={`text-sm font-bold ${getScoreColor(metric.value)}`}>{metric.value}</span>
            </div>
          </div>
        ))}
      </div>

      {score.feedback && score.feedback.length > 0 && (
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
          <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            Actionable Feedback
          </h4>
          <ul className="space-y-2">
            {score.feedback.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
