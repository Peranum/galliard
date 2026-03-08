"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "@/components/ui/Reveal.module.scss";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.15
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const classNames = [styles.reveal, visible ? styles.isVisible : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} ref={ref} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
