'use client';

import { useEffect, useRef } from 'react';

interface PaletteStripProps {
  colors: string[];
  onColorSelect?: (color: string) => void;
}

export function PaletteStrip({ colors, onColorSelect }: PaletteStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollLeft = 0;
  }, [colors]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm uppercase tracking-[0.3em] text-slate-300">Palette</span>
        <span className="text-xs text-slate-400">{colors.length} tones</span>
      </div>
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-3"
      >
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onColorSelect?.(color)}
            className="group flex min-w-[96px] flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-2 transition hover:border-neon-blue/70 hover:shadow-glow"
          >
            <span
              className="h-12 w-full rounded-md"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-mono text-slate-200 group-hover:text-white">
              {color}
            </span>
          </button>
        ))}
        {colors.length === 0 && (
          <div className="flex h-16 w-full items-center justify-center text-xs text-slate-400">
            Generate a palette from an image
          </div>
        )}
      </div>
    </div>
  );
}
