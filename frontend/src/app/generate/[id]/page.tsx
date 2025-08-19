import { VideoPreview } from '@/components/VideoPreview';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Share2, Clock } from 'lucide-react';

// This would normally be fetched from API based on the ID
async function getGenerationResult(id: string) {
  // Mock data - in real app, this would fetch from API
  return {
    id,
    status: 'COMPLETED',
    mode: 'VERTICAL',
    prompt: 'A chef cooking pasta in a modern kitchen, close-up shots of hands kneading dough',
    videoUrl: '/api/placeholder-video.mp4', // This would be the actual video URL
    duration: 5,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

export default async function GenerationResultPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const result = await getGenerationResult(params.id);

  const handleExport = async (exportType: string, options?: any) => {
    try {
      const response = await fetch(`/api/v1/generate/${params.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportType,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const exportJob = await response.json();
      console.log('Export started:', exportJob);
      
      // TODO: Redirect to export status page or show progress
      alert(`Export started! Job ID: ${exportJob.id}`);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/generate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Generate
            </Link>
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">Generation Complete</h1>
            <p className="text-muted-foreground">Job ID: {result.id}</p>
          </div>
        </div>

        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Generation details */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">Original Prompt</h3>
            <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded border">
              {result.prompt}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Video Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Mode:</span>
                <span className="font-medium">{result.mode}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{result.duration}s</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium text-green-600">{result.status}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Timing</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Created: {new Date(result.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-green-500" />
                <span>Completed: {new Date(result.completedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Video Preview Component */}
      <VideoPreview
        videoUrl={result.videoUrl}
        mode={result.mode as 'VERTICAL' | 'HORIZONTAL'}
        jobId={result.id}
        onExport={handleExport}
      />

      {/* Additional actions */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto p-4 text-left" asChild>
            <Link href="/generate">
              <div>
                <div className="font-medium">Generate Another</div>
                <div className="text-xs text-muted-foreground mt-1">Create a new video</div>
              </div>
            </Link>
          </Button>
          
          <Button variant="outline" className="h-auto p-4 text-left" asChild>
            <Link href="/library">
              <div>
                <div className="font-medium">View Library</div>
                <div className="text-xs text-muted-foreground mt-1">See all your videos</div>
              </div>
            </Link>
          </Button>
          
          <Button variant="outline" className="h-auto p-4 text-left">
            <div>
              <div className="font-medium">Edit & Enhance</div>
              <div className="text-xs text-muted-foreground mt-1">Coming soon</div>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
