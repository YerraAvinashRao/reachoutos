import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, ShieldCheck, Zap, Database, Send, Sparkles } from 'lucide-react';

interface ReachOut3DLoaderProps {
  title?: string;
  subtitle?: string;
  variant?: 'fullscreen' | 'modal' | 'inline';
  steps?: string[];
}

export const ReachOut3DLoader: React.FC<ReachOut3DLoaderProps> = ({
  title = 'ReachOut OS',
  subtitle = 'Initializing Governed Outreach Engine',
  variant = 'fullscreen',
  steps = [
    'Calibrating Communication Matrix...',
    'Establishing Encrypted PostgreSQL Channels...',
    'Synchronizing Audience & Policy Enforcer...',
    'Rendering Autonomous Outreach Workspace...'
  ]
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentStepIdx(prev => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [steps]);

  const content = (
    <div className="relative flex flex-col items-center justify-center select-none text-center p-8 max-w-md w-full">
      {/* Background Volumetric Glow Ambient Aura */}
      <div className="absolute -inset-10 bg-gradient-to-tr from-emerald-500/20 via-blue-500/20 to-purple-600/20 rounded-full blur-3xl opacity-75 pointer-events-none animate-pulse" />

      {/* 3D Stage Container */}
      <div className="relative w-48 h-48 mb-8 flex items-center justify-center [perspective:1000px]">
        {/* Outer Orbital Gyroscope Ring 1 (Emerald / WhatsApp Axis) */}
        <div
          className="absolute inset-0 rounded-full border-2 border-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.35)] animate-[spin_6s_linear_infinite]"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(65deg) rotateY(20deg)'
          }}
        >
          {/* Orbital Satellite Node */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Middle Orbital Gyroscope Ring 2 (Cyber Blue / Delivery Axis) */}
        <div
          className="absolute inset-3 rounded-full border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.35)] animate-[spin_8s_linear_infinite_reverse]"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-55deg) rotateY(45deg)'
          }}
        >
          {/* Orbital Satellite Node */}
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Inner Orbital Gyroscope Ring 3 (Violet / PostgreSQL Security Axis) */}
        <div
          className="absolute inset-7 rounded-full border border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.4)] animate-[spin_10s_linear_infinite]"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateY(75deg) rotateX(15deg)'
          }}
        >
          {/* Orbital Satellite Node */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_10px_#c084fc] flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white" />
          </div>
        </div>

        {/* Central Levitating 3D Isometric Prism Core */}
        <div
          className="relative w-16 h-16 flex items-center justify-center animate-[bounce_3s_easeInOut_infinite]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Core Outer Diamond Frame */}
          <div className="absolute inset-0 rotate-45 rounded-2xl bg-gradient-to-br from-neutral-900/90 via-neutral-950/95 to-neutral-900/90 border border-emerald-400/50 shadow-[0_0_30px_rgba(16,185,129,0.4)] backdrop-blur-md flex items-center justify-center">
            {/* Inner Glowing Core */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-400 shadow-[0_0_20px_#10b981] flex items-center justify-center animate-pulse">
              <Send className="w-4 h-4 text-neutral-950 -rotate-45" />
            </div>
          </div>

          {/* Floating Telemetry Aura Particles */}
          <div className="absolute -top-3 -right-3 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping" />
          <div className="absolute -bottom-2 -left-2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4] animate-pulse" />
        </div>

        {/* Holographic Radar Sweeper Beam */}
        <div className="absolute inset-2 rounded-full border border-emerald-500/10 pointer-events-none">
          <div className="w-full h-full rounded-full border-t border-emerald-400/40 animate-[spin_3s_linear_infinite]" />
        </div>
      </div>

      {/* Futuristic Telemetry Glass Card */}
      <div className="relative z-10 w-full bg-neutral-950/80 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 dark:border-neutral-700/60 rounded-2xl p-5 shadow-2xl space-y-3">
        {/* Header Status Row */}
        <div className="flex items-center justify-between border-b border-neutral-800/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              Quantum Engine Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[10px]">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>54.2 GFLOP/s</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1">
          <h2 className="text-base font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>{title}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              v2.4 PRO
            </span>
          </h2>
          <p className="text-xs text-neutral-400">
            {subtitle}
          </p>
        </div>

        {/* Animated Step Telemetry Stream */}
        <div className="h-6 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 text-[11px] font-mono text-cyan-300/90 font-medium"
            >
              <Zap className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
              <span className="truncate">{steps[currentStepIdx]}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* High-tech Multi-Segment Laser Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800 flex">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500 rounded-full shadow-[0_0_12px_#10b981]"
              initial={{ width: '15%' }}
              animate={{ width: ['15%', '65%', '92%', '45%', '100%'] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
            <span>NODE_READY</span>
            <span className="text-emerald-400/80">LATENCY 4ms</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-[999999] bg-neutral-950/90 backdrop-blur-2xl flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-[99999] bg-neutral-950/70 backdrop-blur-md flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full py-12 flex items-center justify-center">
      {content}
    </div>
  );
};
