import React from 'react';

export function Card({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-xl shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Metric({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={`text-3xl font-semibold text-[var(--text-primary)] ${className}`}>
      {children}
    </p>
  );
}

export function Text({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={`text-sm text-[var(--text-secondary)] ${className}`}>
      {children}
    </p>
  );
}

export function ProgressBar({ value, label, subLabel, className = "" }: { value: number, label?: string, subLabel?: string, className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || subLabel) && (
        <div className="flex justify-between items-center text-sm font-medium">
          {label && <span className="text-[var(--text-primary)]">{label}</span>}
          {subLabel && <span className="text-[var(--text-secondary)]">{subLabel}</span>}
        </div>
      )}
      <div className="h-2 w-full bg-[var(--border-color)] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
        />
      </div>
    </div>
  );
}

export function Badge({ children, color = "primary", className = "" }: { children: React.ReactNode, color?: "primary" | "secondary" | "warm" | "success" | "warning" | "error" | "info" | "neutral", className?: string }) {
  const colorMap = {
    primary: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)] border-[var(--accent-primary)]/20",
    secondary: "bg-[var(--accent-secondary-light)] text-[var(--accent-secondary)] border-[var(--accent-secondary)]/20",
    warm: "bg-[var(--accent-warm-light)] text-[var(--accent-warm)] border-[var(--accent-warm)]/20",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/20",
    warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/20",
    error: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/20",
    info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/20",
    neutral: "bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border-color)]"
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorMap[color]} ${className}`}>
      {children}
    </span>
  );
}

export function BarList({ data, className = "", valueFormatter = (val: number) => val.toString() }: { data: { name: string, value: number, color?: string }[], className?: string, valueFormatter?: (val: number) => string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {data.map((item, i) => (
        <div key={i} className="flex items-center justify-between group">
          <div className="flex-1 flex items-center h-8">
            <div className="relative w-full h-full flex items-center">
              <div 
                className={`absolute left-0 h-full rounded bg-[var(--accent-primary-light)] transition-all duration-500`}
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
              <span className="relative z-10 px-2 text-sm text-[var(--text-primary)] truncate">
                {item.name}
              </span>
            </div>
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)] ml-4">
            {valueFormatter(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function List({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <ul className={`divide-y divide-[var(--border-color)] ${className}`}>
      {children}
    </ul>
  );
}

export function ListItem({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <li className={`flex items-center justify-between py-3 ${className}`}>
      {children}
    </li>
  );
}

export function Tracker({ data, className = "" }: { data: { color?: string, tooltip?: string, tooltipPosition?: "left" | "right" }[], className?: string }) {
  return (
    <div className={`flex items-center h-8 w-full gap-1 ${className}`}>
      {data.map((item, i) => (
        <div 
          key={i} 
          className={`h-full flex-1 rounded-sm ${item.color || 'bg-[var(--border-color)]'} hover:opacity-80 transition-opacity`}
          title={item.tooltip}
        />
      ))}
    </div>
  );
}
