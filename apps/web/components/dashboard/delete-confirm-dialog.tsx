"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, AlertTriangle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { DashboardProject } from "@/lib/dashboard/types";
import { describeApiError } from "@/lib/platform-api";

interface DeleteConfirmDialogProps {
  project: DashboardProject | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (projectId: string) => Promise<void>;
}

export function DeleteConfirmDialog({
  project,
  isOpen,
  onClose,
  onConfirmDelete,
}: DeleteConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every close path resets the transient state, so the dialog opens fresh.
  const close = useCallback(() => {
    setIsDeleting(false);
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => deleteBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
          onClick={(e) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
              close();
            }
          }}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-[8px] bg-[#2A1818] border border-[#442424] flex items-center justify-center text-[#D77D7D] shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={close}
                className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#75736D] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="font-sans text-[17px] font-semibold text-[#FAF8F5] tracking-tight">
                Delete project?
              </h2>
              <p className="text-[13px] text-[#8E8C86] leading-relaxed mt-1.5">
                Are you sure you want to delete <span className="font-mono text-[#FAF8F5] font-semibold">{project.name}</span>? This will permanently remove the project and its services.
              </p>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-[12px] text-[#D77D7D] mt-3 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </p>
            )}

            <div className="pt-5 mt-5 border-t border-[#222220] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={close}
                className="h-9 px-4 rounded-[6px] text-[13px] text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                ref={deleteBtnRef}
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  setError(null);
                  try {
                    await onConfirmDelete(project.id);
                    close();
                  } catch (err) {
                    setError(describeApiError(err, "Could not delete this project."));
                    setIsDeleting(false);
                  }
                }}
                className="h-9 px-4 rounded-[6px] bg-[#D77D7D] hover:bg-[#E58888] disabled:opacity-60 disabled:cursor-not-allowed text-[#141413] text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                {isDeleting ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

