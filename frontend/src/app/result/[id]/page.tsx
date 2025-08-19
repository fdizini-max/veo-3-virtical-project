import { VideoPreview } from '@/components/VideoPreview';
import { ExportOptions } from '@/components/ExportOptions';

interface ResultPageProps {
  params: {
    id: string;
  };
}

// Mock function to get video data - in production this would fetch from API
async function getVideoData(id: string) {
  // This would normally fetch from your API
  return {
    id,
    videoUrl: `/api/videos/${id}/preview.mp4`,
    mode: 'VERTICAL' as const,
    status: 'COMPLETED',
    originalDimensions: { width: 1920, height: 1080 }
  };
}

export default async function ResultPage({ params }: ResultPageProps) {
  const videoData = await getVideoData(params.id);
  
  const handleExport = async (options: any) => {
    // This would call your export API
    console.log('Export requested with options:', options);
    
    try {
      const response = await fetch(`/api/v1/generate/${params.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const result = await response.json();
      console.log('Export started:', result);
      
      // Handle export success (e.g., show download link)
      return result;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4">
      <div className="flex-1">
        <VideoPreview 
          videoUrl={videoData.videoUrl}
          mode={videoData.mode}
          jobId={videoData.id}
          onExport={handleExport}
        />
      </div>
      <div className="flex-1 lg:max-w-xl">
        <ExportOptions
          videoUrl={videoData.videoUrl}
          jobId={videoData.id}
          mode={videoData.mode}
          originalDimensions={videoData.originalDimensions}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
