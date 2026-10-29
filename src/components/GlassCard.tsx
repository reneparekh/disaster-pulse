import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export default function GlassCard({ children, className = '', hover = true, glow = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { scale: 1.02, y: -2 } : {}}
      className={`
        relative overflow-hidden rounded-xl
        bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80
        backdrop-blur-xl border border-slate-700/50
        shadow-2xl
        ${glow ? 'shadow-cyan-500/20' : ''}
        ${hover ? 'transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10' : ''}
        ${className}
      `}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Shine effect */}
      {hover && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
        </div>
      )}
    </motion.div>
  );
}
