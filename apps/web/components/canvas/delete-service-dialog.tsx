"use client";

import React, { useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteServiceDialogProps {
  isOpen: boolean;
  serviceName: string;
  /** Databases permanently delete their data. Other services are stopped. */
  deletesData: boolean;
  isDeleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteServiceDialog({
  isOpen,
  serviceName,
  deletesData,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteServiceDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-service-title"
        className="w-full max-w-[420px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#2A1818] border border-[#442424] flex items-center justify-center text-[#D77D7D] shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-service-title" className="font-sans text-[14px] font-semibold text-[#F1F0ED]">
                Delete {serviceName}?
              </h3>
              <p className="mt-1 text-[12.5px] text-[#A09E98] leading-relaxed">
                {deletesData ? "This permanently deletes the data." : "This stops the service."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-[#77756F] hover:text-[#F1F0ED] p-1 rounded cursor-pointer disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-[6px] border border-[#4A2B24] bg-[#1A1412] px-3 py-2 text-[12px] text-[#E8B29C]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-[6px] bg-[#202020] hover:bg-[#2A2A2A] text-[#F2F0EC] text-[12px] font-sans cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[12px] font-medium font-sans cursor-pointer disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
            {isDeleting ? "Deleting…" : "Delete service"}
          </button>
        </div>
      </div>
    </div>
  );
}
