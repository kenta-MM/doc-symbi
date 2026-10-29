import { useRef, useState } from 'react';

export function SidebarResizeHandle({ width, resize, label = 'フォルダビューの幅', edge = 'right' }: { width: number; resize: (width: number) => void; label?: string; edge?: 'left' | 'right' }) {
  const direction = edge === 'left' ? -1 : 1;
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (value: number) => Math.round(Math.max(180, Math.min(value, window.innerWidth / 2, 600)));
  return <div className={`sidebar-resize-handle resize-${edge}${dragging ? ' dragging' : ''}`} role="separator"
    aria-label={label} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={600}
    aria-valuenow={width} tabIndex={0}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const actualWidth = event.currentTarget.parentElement!.getBoundingClientRect().width;
      drag.current = { pointer: event.pointerId, x: event.clientX, width: actualWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      if (drag.current?.pointer !== event.pointerId) return;
      resize(clamp(drag.current.width + direction * (event.clientX - drag.current.x)));
    }}
    onPointerUp={event => {
      if (drag.current?.pointer !== event.pointerId) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      drag.current = null; setDragging(false);
    }}
    onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
    onPointerCancel={() => { drag.current = null; setDragging(false); }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const actualWidth = event.currentTarget.parentElement!.getBoundingClientRect().width;
      resize(clamp(event.key === 'Home' ? 180 : event.key === 'End' ? 600 : actualWidth + direction * (event.key === 'ArrowLeft' ? -10 : 10)));
    }} />;
}
