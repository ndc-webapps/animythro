// components/ui/ScrollRow.tsx
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <div className="relative group/row">
      {/* Left arrow */}
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className={`absolute left-0 top-0 bottom-3 z-10 w-12 hidden sm:flex items-center justify-center
          bg-gradient-to-r from-[#060610] via-[#060610]/80 to-transparent
          transition-opacity duration-200 ${
            canLeft ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <span className="p-2 bg-black/70 hover:bg-purple-600 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </span>
      </button>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className={`absolute right-0 top-0 bottom-3 z-10 w-12 hidden sm:flex items-center justify-center
          bg-gradient-to-l from-[#060610] via-[#060610]/80 to-transparent
          transition-opacity duration-200 ${
            canRight ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <span className="p-2 bg-black/70 hover:bg-purple-600 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5" />
        </span>
      </button>

      <div ref={ref} className="scroll-row">
        {children}
      </div>
    </div>
  );
}
