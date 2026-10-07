import React from 'react';

interface DirectionalArrowProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  targetRect: DOMRect | null;
  tooltipRect?: DOMRect | null;
}

export const DirectionalArrow: React.FC<DirectionalArrowProps> = ({
  position,
  targetRect
}) => {
  if (!targetRect) return null;

  // Render arrow pointing toward target
  // 'right' means tooltip is to the right, arrow points LEFT toward target
  // 'left' means tooltip is to the left, arrow points RIGHT toward target
  // 'bottom' means tooltip is below, arrow points UP toward target
  // 'top' means tooltip is above, arrow points DOWN toward target

  return (
    <div className="pointer-events-none select-none z-50">
      <style>{`
        @keyframes tour-bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        @keyframes tour-bounce-x-rev {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
        @keyframes tour-bounce-y {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes tour-bounce-y-rev {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .tour-arrow-bounce-left { animation: tour-bounce-x 1.2s ease-in-out infinite; }
        .tour-arrow-bounce-right { animation: tour-bounce-x-rev 1.2s ease-in-out infinite; }
        .tour-arrow-bounce-up { animation: tour-bounce-y 1.2s ease-in-out infinite; }
        .tour-arrow-bounce-down { animation: tour-bounce-y-rev 1.2s ease-in-out infinite; }
      `}</style>
      {position === 'right' && (
        <div className="flex items-center -mr-2 tour-arrow-bounce-left">
          <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="drop-shadow-md">
            <path
              d="M38 12 H6 M6 12 L14 4 M6 12 L14 20"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {position === 'left' && (
        <div className="flex items-center -ml-2 tour-arrow-bounce-right">
          <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="drop-shadow-md">
            <path
              d="M2 12 H34 M34 12 L26 4 M34 12 L26 20"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {position === 'bottom' && (
        <div className="flex flex-col items-center -mt-2 tour-arrow-bounce-up">
          <svg width="24" height="40" viewBox="0 0 24 40" fill="none" className="drop-shadow-md">
            <path
              d="M12 38 V6 M12 6 L4 14 M12 6 L20 14"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {position === 'top' && (
        <div className="flex flex-col items-center -mb-2 tour-arrow-bounce-down">
          <svg width="24" height="40" viewBox="0 0 24 40" fill="none" className="drop-shadow-md">
            <path
              d="M12 2 V34 M12 34 L4 26 M12 34 L20 26"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
