"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.classList.add("dialog-open");
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onOpenChange(false);
      };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.classList.remove("dialog-open");
        window.removeEventListener("keydown", handleEsc);
      };
    } else {
      document.body.classList.remove("dialog-open");
    }
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false);
      }}
    >
      <div className="dialog-content relative">
        <button
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-white/10 transition-colors"
          onClick={() => onOpenChange(false)}
        >
          <X size={18} className="text-zinc-400" />
        </button>
        {children}
      </div>
    </div>
  );
}
