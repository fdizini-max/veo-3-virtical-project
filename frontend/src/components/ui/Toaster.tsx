'use client';

import React from 'react';

export interface ToasterProps {
  // Toast container props
}

export const Toaster: React.FC<ToasterProps> = () => {
  return (
    <div
      className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
      role="region"
      aria-label="Notifications"
    >
      {/* Toasts will be rendered here by a toast provider */}
    </div>
  );
};
