import React from 'react';
import { X, Clock, FileText, Trash2 } from 'lucide-react';

export interface HistoryItem {
  id: string;
  date: string;
  keyword: string;
  content: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryModal({ isOpen, onClose, history, onSelect, onClear }: HistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Article History
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p>No history yet. Your generated articles will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-md transition-all cursor-pointer bg-white group"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {item.keyword || 'Untitled Article'}
                    </h3>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                      {new Date(item.date).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {item.content.replace(/#/g, '').substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button 
              onClick={onClear}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
