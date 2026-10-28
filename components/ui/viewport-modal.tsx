'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ViewportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
}

export const ViewportModal = ({
  open,
  onOpenChange,
  children,
  title,
  className,
  overlayClassName,
  showCloseButton = true,
}: ViewportModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when modal is open without resetting scroll position
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            'fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md',
            'flex items-center justify-center',
            'p-4 sm:p-6',
            overlayClassName
          )}
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 360,
            }}
            className={cn(
              'bg-[#0b0d15]/95 backdrop-blur-2xl relative w-full max-w-md max-h-[88vh]',
              'rounded-2xl border border-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(22,255,187,0.08)]',
              'flex flex-col overflow-hidden',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-accent/40 to-transparent shrink-0" />

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-white/[0.01] shrink-0">
                <h2 className="text-base font-extrabold tracking-tight text-white">{title}</h2>
                {showCloseButton && (
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
