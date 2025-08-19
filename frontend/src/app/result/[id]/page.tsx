import { VideoPreviewWithExport } from '@/components/VideoPreviewWithExport';
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4">
      <div className="flex-1">
        <VideoPreviewWithExport 
          videoUrl={videoData.videoUrl}
          mode={videoData.mode}
          jobId={videoData.id}
        />
      </div>
      <div className="flex-1 lg:max-w-xl">
        <ExportOptions
          videoUrl={videoData.videoUrl}
          jobId={videoData.id}
          mode={videoData.mode}
          originalDimensions={videoData.originalDimensions}
        />
      </div>
    </div>
  );
}
