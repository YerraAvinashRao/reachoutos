import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TourStep, TOUR_STEPS } from './tourSteps';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TourTooltip } from './TourTooltip';

interface TourEngineProps {
  isActive: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (tab: any) => void;
  steps?: TourStep[];
  onComplete?: () => void;
}

export const TourEngine: React.FC<TourEngineProps> = ({
  isActive,
  onClose,
  activeTab,
  onNavigate,
  steps = TOUR_STEPS,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mode, setMode] = useState<'interactive' | 'demo'>('interactive');
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = steps[currentStepIndex];

  // Helper to find and measure element in the real DOM
  const measureTarget = useCallback(() => {
    if (!isActive || !currentStep) return;

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Scroll into view if not in viewport
      const isInViewport = 
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isInViewport) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }

      setTargetRect(el.getBoundingClientRect());
      setIsSearchingTarget(false);
    } else {
      // Element not yet mounted
      setIsSearchingTarget(true);
    }
  }, [isActive, currentStep]);

  // Navigate tab if step requires it, then locate target
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (currentStep.tab && currentStep.tab !== activeTab) {
      onNavigate(currentStep.tab);
    }

    // Poll until element mounts (max 2 seconds)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        measureTarget();
        clearInterval(interval);
      } else if (attempts > 20) {
        clearInterval(interval);
        setIsSearchingTarget(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, currentStepIndex, currentStep, activeTab, onNavigate, measureTarget]);

  // Keep targetRect locked during window resize or scroll
  useEffect(() => {
    if (!isActive) return;

    const handleUpdate = () => {
      measureTarget();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isActive, measureTarget]);

  // Auto demo timer
  useEffect(() => {
    if (!isActive || mode !== 'demo') {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setTimeout(() => {
      handleNext();
    }, 5500);

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [isActive, mode, currentStepIndex]);

  // Keyboard navigation (Escape to exit)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      try {
        localStorage.setItem('reachout_tour_dismissed', 'true');
      } catch {}
      onComplete?.();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleTargetClick = () => {
    // If the target element is clickable, trigger its real click event
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`) as HTMLElement;
    if (el) {
      el.click();
    }
    // Advance to next step
    handleNext();
  };

  if (!isActive || !currentStep) return null;

  return (
    <>
      {/* 1. Contextual Spotlight Mask */}
      <SpotlightOverlay
        targetRect={targetRect}
        interactive={mode === 'interactive'}
        onTargetClick={handleTargetClick}
      />

      {/* 2. Floating Guidance Tooltip & Directional Arrow */}
      {targetRect && (
        <TourTooltip
          step={currentStep}
          currentIndex={currentStepIndex}
          totalSteps={steps.length}
          targetRect={targetRect}
          mode={mode}
          onToggleMode={() => setMode(m => m === 'interactive' ? 'demo' : 'interactive')}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={onClose}
        />
      )}
    </>
  );
};
