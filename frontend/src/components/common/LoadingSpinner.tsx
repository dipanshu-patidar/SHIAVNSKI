import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  inline?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
  inline,
}) => {
  // If explicitly inline or sm size, render compact without disruptive padding
  const isInline = inline ?? (size === 'sm');

  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }[size];

  if (isInline) {
    return (
      <span className={`inline-flex items-center justify-center gap-2 p-0 m-0 shrink-0 ${className}`}>
        <span
          className={`${sizeMap} border-current/25 border-t-current rounded-full animate-spin shrink-0`}
          aria-hidden="true"
        />
        {text && <span className="text-xs sm:text-sm font-medium leading-none">{text}</span>}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div
        className={`${sizeMap} border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shrink-0`}
        aria-hidden="true"
      />
      {text && <p className="mt-3 text-sm text-slate-400 font-medium">{text}</p>}
    </div>
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="glass-card rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
    <div className="h-8 bg-slate-850 rounded w-1/2 mb-2" />
    <div className="h-3 bg-slate-800 rounded w-3/4" />
  </div>
);

export default LoadingSpinner;
