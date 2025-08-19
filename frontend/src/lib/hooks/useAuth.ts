'use client';

import { useContext } from 'react';
import { useAuth as useAuthProvider } from '@/components/providers/AuthProvider';

// Re-export the useAuth hook from the provider for consistency
export const useAuth = useAuthProvider;
