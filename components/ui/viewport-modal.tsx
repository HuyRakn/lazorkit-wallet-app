'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

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
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md',
            'flex items-center justify-center',
            'p-4', // Add padding for mobile
            overlayClassName
          )}
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 350,
            }}
            className={cn(
              'bg-slate-950/80 backdrop-blur-2xl relative w-full max-w-md max-h-[85vh]',
              'rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(22,255,187,0.1)]',
              'flex flex-col overflow-hidden', // Make it a flex container
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 bg-slate-950/20">
                <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
                {showCloseButton && (
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </button>
                )}
              </div>
            )}

            {/* Content - No scroll, compact layout */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
