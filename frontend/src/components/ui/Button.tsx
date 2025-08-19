'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg active:scale-95',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg active:scale-95',
        outline: 'border-2 border-gray-300 bg-white hover:bg-gray-50 hover:border-primary text-gray-700 hover:text-primary',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:scale-95',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    if (asChild) {
      // When asChild is true, we would normally use a slot/polymorphic component
      // For now, we'll just render a regular button and ignore asChild
      console.warn('asChild prop is not yet implemented in Button component');
    }

    return (
      <button
        className={clsx(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
