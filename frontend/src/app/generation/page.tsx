import { GenerationForm } from '@/components/GenerationForm';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export default function GenerationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Link>
              </Button>
              <span className="text-gray-400">/</span>
              <span className="font-medium">Generate Video</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/library">My Videos</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto p-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3">
              Vertical-first Veo 3 Generator
            </h1>
            <p className="text-lg text-gray-600">
              Create AI-powered videos optimized for vertical viewing
            </p>
          </div>

          {/* Generation Form */}
          <GenerationForm />
          
          {/* Tips Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-gray-600">
                Use specific details in your prompts for better results. Include camera angles, lighting, and mood.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2">🎬 Best Practices</h3>
              <p className="text-sm text-gray-600">
                Vertical videos perform 90% better on social media. Keep action in the center frame.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold mb-2">⚡ Quick Mode</h3>
              <p className="text-sm text-gray-600">
                Enable fast generation for quick previews. Perfect for testing different prompts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
