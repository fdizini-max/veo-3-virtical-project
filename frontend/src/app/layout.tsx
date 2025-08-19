import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Header } from '@/components/layout/Header'
import { Toaster } from '@/components/ui/Toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vertical Veo 3 - AI Video Generation Tool',
  description: 'Generate vertical-first videos with Veo 3 API, optimized for social media platforms',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Header />
          <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
