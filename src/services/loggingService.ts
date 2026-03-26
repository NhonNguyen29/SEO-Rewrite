export interface LogEntry {
  id: string;
  timestamp: number;
  modelUsed: string;
  taskType: 'rewrite' | 'audit';
  responseTimeMs: number;
  success: boolean;
  error?: string;
  qualityScore?: number; // 1-5 user rating
}

const LOGS_KEY = 'seo_app_logs';

export const loggingService = {
  getLogs: (): LogEntry[] => {
    try {
      const logs = localStorage.getItem(LOGS_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      console.error('Failed to parse logs', e);
      return [];
    }
  },

  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const logs = loggingService.getLogs();
    const newLog: LogEntry = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    logs.push(newLog);
    // Keep only last 100 logs to prevent localStorage overflow
    if (logs.length > 100) {
      logs.shift();
    }
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    return newLog;
  },

  updateLogQuality: (id: string, score: number) => {
    const logs = loggingService.getLogs();
    const logIndex = logs.findIndex(l => l.id === id);
    if (logIndex !== -1) {
      logs[logIndex].qualityScore = score;
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }
  },

  getBestModelForTask: (taskType: 'rewrite' | 'audit', mode: 'Fast' | 'Quality' | 'Auto'): string => {
    // Basic logic based on mode
    if (mode === 'Fast') return 'gemini-1.5-flash';
    if (mode === 'Quality') return 'gpt-4o';
    
    // Auto mode: analyze logs
    const logs = loggingService.getLogs().filter(l => l.taskType === taskType && l.success);
    if (logs.length === 0) {
      // Default fallback if no logs
      return taskType === 'audit' ? 'gemini-1.5-pro' : 'gpt-4o';
    }

    // Calculate average score and response time per model
    const stats: Record<string, { totalScore: number; count: number; totalTime: number }> = {};
    logs.forEach(log => {
      if (!stats[log.modelUsed]) {
        stats[log.modelUsed] = { totalScore: 0, count: 0, totalTime: 0 };
      }
      stats[log.modelUsed].totalScore += log.qualityScore || 3; // Default to 3 if not rated
      stats[log.modelUsed].count += 1;
      stats[log.modelUsed].totalTime += log.responseTimeMs;
    });

    let bestModel = 'gemini-1.5-flash';
    let bestScore = -1;

    for (const [model, stat] of Object.entries(stats)) {
      const avgScore = stat.totalScore / stat.count;
      const avgTime = stat.totalTime / stat.count;
      
      // A simple heuristic: score heavily weighted, time slightly penalized
      const heuristic = avgScore - (avgTime / 10000); 
      
      if (heuristic > bestScore) {
        bestScore = heuristic;
        bestModel = model;
      }
    }

    return bestModel;
  }
};
