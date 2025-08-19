'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success';
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-background text-foreground border',
      destructive: 'bg-destructive text-destructive-foreground',
      success: 'bg-green-600 text-white',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md p-6 pr-8 shadow-lg transition-all',
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Toast.displayName = 'Toast';
