import React from 'react';
import { 
  ArrowRight, 
  ChevronLeft, 
  X, 
  Play, 
  Pause, 
  Lightbulb, 
  MousePointerClick,
  Sparkles
} from 'lucide-react';
import { TourStep } from './tourSteps';
import { DirectionalArrow } from './DirectionalArrow';

interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  mode: 'interactive' | 'demo';
  onToggleMode: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const TourTooltip: React.FC<TourTooltipProps> = ({
  step,
  currentIndex,
  totalSteps,
  targetRect,
  mode,
  onToggleMode,
  onNext,
  onPrev,
  onClose
}) => {
  if (!targetRect) return null;

  // Calculate position relative to target element
  const margin = 16;
  const tooltipWidth = 360;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let placement = step.position || 'bottom';

  // Smart flip if near screen edges
  if (placement === 'right' && targetRect.right + tooltipWidth + margin > windowWidth) {
    placement = targetRect.left > tooltipWidth + margin ? 'left' : 'bottom';
  } else if (placement === 'left' && targetRect.left - tooltipWidth - margin < 0) {
    placement = windowWidth - targetRect.right > tooltipWidth + margin ? 'right' : 'bottom';
  } else if (placement === 'bottom' && targetRect.bottom + 220 + margin > windowHeight) {
    placement = 'top';
  } else if (placement === 'top' && targetRect.top - 220 - margin < 0) {
    placement = 'bottom';
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'right':
      top = Math.max(margin, Math.min(windowHeight - 260, targetRect.top + targetRect.height / 2 - 100));
      left = targetRect.right + margin;
      break;
    case 'left':
      top = Math.max(margin, Math.min(windowHeight - 260, targetRect.top + targetRect.height / 2 - 100));
      left = Math.max(margin, targetRect.left - tooltipWidth - margin);
      break;
    case 'top':
      top = Math.max(margin, targetRect.top - 240 - margin);
      left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, targetRect.left + targetRect.width / 2 - tooltipWidth / 2));
      break;
    case 'bottom':
    default:
      top = Math.min(windowHeight - 260, targetRect.bottom + margin);
      left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, targetRect.left + targetRect.width / 2 - tooltipWidth / 2));
      break;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        zIndex: 50
      }}
      className="pointer-events-auto transition-all duration-300 ease-out flex flex-col"
    >
      {/* Directional Arrow between tooltip and target */}
      {placement === 'bottom' && (
        <div className="flex justify-center">
          <DirectionalArrow position="bottom" targetRect={targetRect} />
        </div>
      )}

      {/* Main Tooltip Card */}
      <div className="bg-neutral-900 dark:bg-neutral-900 text-white rounded-2xl border-2 border-emerald-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.3)] p-4 space-y-3.5 backdrop-blur-xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
              Step {currentIndex + 1} of {totalSteps}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-[11px] text-neutral-400 font-medium">
              {step.badge || 'Guided Tour'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Mode switch */}
            <button
              onClick={onToggleMode}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                mode === 'demo'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
              title={mode === 'demo' ? 'Switch to Interactive Mode' : 'Switch to Auto Demo'}
            >
              {mode === 'demo' ? (
                <>
                  <Pause className="w-2.5 h-2.5" />
                  <span>Auto Demo</span>
                </>
              ) : (
                <>
                  <MousePointerClick className="w-2.5 h-2.5" />
                  <span>Interactive</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-md transition cursor-pointer"
              title="Exit Tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title and Instruction */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{step.title}</span>
          </h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {step.instruction}
          </p>
        </div>

        {/* Pro Tip */}
        {step.tip && (
          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300/90 flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{step.tip}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 transition cursor-pointer"
            >
              Exit
            </button>
            <button
              onClick={onNext}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{currentIndex === totalSteps - 1 ? 'Finish' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {placement === 'top' && (
        <div className="flex justify-center">
          <DirectionalArrow position="top" targetRect={targetRect} />
        </div>
      )}
    </div>
  );
};
