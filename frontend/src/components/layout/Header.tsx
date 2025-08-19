'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Sparkles, User, LogOut } from 'lucide-react';

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Vertical Veo 3</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-6">
          <Link 
            href="/generate" 
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Generate
          </Link>
          <Link 
            href="/library" 
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Library
          </Link>
          <Link 
            href="/import" 
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Import
          </Link>
        </nav>

        {/* User section */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">{user?.firstName || user?.username}</span>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                  {user?.subscriptionTier}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
