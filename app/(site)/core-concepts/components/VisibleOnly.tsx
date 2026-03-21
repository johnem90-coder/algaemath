"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Renders children only when the container is near the viewport.
 * When off-screen, shows a placeholder of the same height so the
 * page layout stays stable.  This stops requestAnimationFrame loops
 * inside heavy visualizers when they scroll out of view.
 */
export default function VisibleOnly({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const heightRef = useRef(400); // default placeholder height
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Capture height before unmounting so the placeholder matches
        if (!entry.isIntersecting && el.offsetHeight > 0) {
          heightRef.current = el.offsetHeight;
        }
        setVisible(entry.isIntersecting);
      },
      { rootMargin: "200px" } // mount slightly before entering viewport
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? children : <div style={{ minHeight: heightRef.current }} />}
    </div>
  );
}
