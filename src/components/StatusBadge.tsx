import { motion } from 'motion/react';

interface StatusBadgeProps {
  status: 'live' | 'warning' | 'critical' | 'online' | 'offline';
  text?: string;
  pulse?: boolean;
}

export default function StatusBadge({ status, text, pulse = true }: StatusBadgeProps) {
  const configs = {
    live: { color: 'bg-emerald-500', text: text || 'LIVE', glow: 'shadow-emerald-500/50' },
    warning: { color: 'bg-amber-500', text: text || 'WARNING', glow: 'shadow-amber-500/50' },
    critical: { color: 'bg-red-500', text: text || 'CRITICAL', glow: 'shadow-red-500/50' },
    online: { color: 'bg-cyan-500', text: text || 'ONLINE', glow: 'shadow-cyan-500/50' },
    offline: { color: 'bg-slate-500', text: text || 'OFFLINE', glow: 'shadow-slate-500/50' },
  };

  const config = configs[status];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50"
    >
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {pulse && (status === 'live' || status === 'critical') && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute inset-0 w-2 h-2 rounded-full ${config.color}`}
          />
        )}
      </div>
      <span className="text-[10px] font-bold tracking-wider text-slate-300">{config.text}</span>
    </motion.div>
  );
}
