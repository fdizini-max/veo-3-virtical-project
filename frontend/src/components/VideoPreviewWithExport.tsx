'use client';

import { VideoPreview } from '@/components/VideoPreview';

type Props = {
  videoUrl: string;
  mode: 'VERTICAL' | 'HORIZONTAL';
  jobId: string;
};

export function VideoPreviewWithExport({ videoUrl, mode, jobId }: Props) {
  const handleExport = async (exportType: string, options?: any) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiBase}/generate/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType, ...options }),
      });

      const ct = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      if (!ct.includes('application/json')) throw new Error(`Non-JSON response: ${ct} -> ${text.slice(0, 200)}`);
      const result = JSON.parse(text);
      // Optional UX hook; replace with a toast if desired
      // eslint-disable-next-line no-alert
      alert(`Export started! Job ID: ${result.id}`);
    } catch (error: any) {
      console.error('Export failed:', error);
      // eslint-disable-next-line no-alert
      alert(error?.message || 'Export failed. Please try again.');
    }
  };

  return (
    <VideoPreview
      videoUrl={videoUrl}
      mode={mode}
      jobId={jobId}
      onExport={handleExport}
    />
  );
}


