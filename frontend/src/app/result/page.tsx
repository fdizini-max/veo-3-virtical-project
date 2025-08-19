import { VideoPreview } from '@/components/VideoPreview';
import { ExportOptions } from '@/components/ExportOptions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Share2 } from 'lucide-react';

// This is a demo page showing the layout
// In production, use the dynamic [id] route
export default function ResultPageDemo() {
  // Demo data
  const demoVideoData = {
    id: 'demo-123',
    videoUrl: '/api/placeholder-video.mp4',
    mode: 'VERTICAL' as const,
    status: 'COMPLETED',
    originalDimensions: { width: 1920, height: 1080 },
    prompt: 'A chef cooking pasta in a modern kitchen, vertical composition',
    createdAt: new Date().toISOString()
  };

  const handleExport = async (_options: any): Promise<void> => {
    console.log('Export requested:', _options);
    // Simulate export process
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, exportId: 'export-456' });
      }, 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/generation">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Generator
                </Link>
              </Button>
              <span className="text-gray-400">|</span>
              <span className="font-medium">Video Result</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Side by Side Layout */}
      <div className="container mx-auto p-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Video Preview */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Video Preview</h2>
            <VideoPreview 
              videoUrl={demoVideoData.videoUrl}
              mode={demoVideoData.mode}
              jobId={demoVideoData.id}
              onExport={handleExport}
            />
          </div>

          {/* Right Column - Export Options */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Export Options</h2>
            <ExportOptions
              videoUrl={demoVideoData.videoUrl}
              jobId={demoVideoData.id}
              mode={demoVideoData.mode}
              originalDimensions={demoVideoData.originalDimensions}
              onExport={handleExport}
            />
          </div>
        </div>

        {/* Generation Details */}
        <Card className="mt-8 p-6">
          <h3 className="text-lg font-semibold mb-4">Generation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Original Prompt</p>
              <p className="font-medium">{demoVideoData.prompt}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Video Mode</p>
              <p className="font-medium">{demoVideoData.mode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Created At</p>
              <p className="font-medium">{new Date(demoVideoData.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/generation">
              Generate Another Video
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/library">
              View My Library
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/templates">
              Browse Templates
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
