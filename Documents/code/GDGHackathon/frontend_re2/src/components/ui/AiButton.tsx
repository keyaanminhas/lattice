"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "border-transparent bg-gradient-to-r from-violet-600 to-lattice-electric text-white shadow-sm hover:opacity-95",
  ghost:
    "border-violet-200 bg-violet-50/80 text-violet-900 hover:bg-violet-100",
  danger:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
};

export function AiButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      <span className="text-[10px]" aria-hidden>
        ✦
      </span>
      {children}
    </button>
  );
}
