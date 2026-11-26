import React from "react";

interface VizoLogoProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
}

const SIZE_MAP = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-lg" },
  md: { box: "h-9 w-9 rounded-xl", icon: "h-5 w-5", text: "text-xl" },
  lg: { box: "h-11 w-11 rounded-2xl", icon: "h-6 w-6", text: "text-2xl" },
};

export function VizoLogo({
  size = "md",
  showSubtitle = false,
}: VizoLogoProps) {
  const styles = SIZE_MAP[size];

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${styles.box} bg-brand text-white flex items-center justify-center shadow-xs shrink-0`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={styles.icon}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Moldura arquitetônica + marca V de vistoria */}
          <path d="M4 7.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5" />
          <path d="M20 16.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5" />
          <path d="m7.5 9.5 4.5 7 4.5-7" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`${styles.text} font-bold tracking-tight text-slate-900`}
        >
          Vizo
        </span>
        {showSubtitle && (
          <span className="text-[11px] font-medium text-slate-500 mt-0.5">
            Ocorrências &amp; Vistorias
          </span>
        )}
      </div>
    </div>
  );
}
