import React from 'react';

interface SpotlightOverlayProps {
  targetRect: DOMRect | null;
  padding?: number;
  interactive?: boolean;
  onTargetClick?: () => void;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  targetRect,
  padding = 8,
  interactive = true,
  onTargetClick
}) => {
  if (!targetRect) {
    return (
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 pointer-events-none" />
    );
  }

  const x = Math.max(0, targetRect.left - padding);
  const y = Math.max(0, targetRect.top - padding);
  const width = targetRect.width + padding * 2;
  const height = targetRect.height + padding * 2;
  const radius = 12;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden transition-all duration-300">
      <svg className="w-full h-full block">
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White covers entire viewport */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight area */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={radius}
              ry={radius}
              fill="black"
              className="transition-all duration-300 ease-out"
            />
          </mask>
        </defs>

        {/* Dimming overlay with cutout */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(8, 10, 15, 0.72)"
          mask="url(#tour-spotlight-mask)"
          className="transition-all duration-300 ease-out"
        />

        {/* Glowing border ring around target */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          fill="none"
          stroke="url(#emerald-glow)"
          strokeWidth="2.5"
          className="transition-all duration-300 ease-out"
        />

        {/* Animated pulse halo */}
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          rx={radius + 2}
          ry={radius + 2}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          opacity="0.6"
          className="animate-pulse"
        />

        <defs>
          <linearGradient id="emerald-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>

      {/* Interactive click zone over target if user clicks the real element */}
      {interactive && (
        <div
          onClick={onTargetClick}
          style={{
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            borderRadius: `${radius}px`,
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
          className="hover:bg-emerald-500/10 transition-colors"
          title="Click to perform action and advance"
        />
      )}
    </div>
  );
};
