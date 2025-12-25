import React from "react";

export type SectionCardVariant = "default" | "muted" | "dark";

export type SectionCardProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  variant?: SectionCardVariant;
  className?: string;
};

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  variant = "default",
  className,
}) => {
  let base =
    "rounded-lg border px-3 py-2 text-xs shadow-sm ";
  if (variant === "muted") {
    base += "border-slate-200 bg-slate-50 ";
  } else if (variant === "dark") {
    base += "border-slate-800 bg-slate-900 text-slate-100 ";
  } else {
    base += "border-slate-200 bg-white ";
  }
  if (className) {
    base += className;
  }

  return (
    <section className={base}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-1">{actions}</div>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
};

export default SectionCard;
