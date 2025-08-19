import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Play, Download, Trash2, Clock, Film } from 'lucide-react';

// Mock data for demonstration
const mockVideos = [
  {
    id: '1',
    thumbnail: '/api/placeholder-thumb-1.jpg',
    title: 'Chef Cooking Pasta',
    mode: 'VERTICAL',
    duration: '5s',
    createdAt: '2024-01-15T10:30:00Z',
    status: 'COMPLETED'
  },
  {
    id: '2',
    thumbnail: '/api/placeholder-thumb-2.jpg',
    title: 'Sunset Time-lapse',
    mode: 'HORIZONTAL',
    duration: '10s',
    createdAt: '2024-01-14T15:20:00Z',
    status: 'COMPLETED'
  },
  {
    id: '3',
    thumbnail: '/api/placeholder-thumb-3.jpg',
    title: 'Product Showcase',
    mode: 'VERTICAL',
    duration: '7s',
    createdAt: '2024-01-13T09:15:00Z',
    status: 'PROCESSING'
  }
];

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Video Library</h1>
              <p className="text-gray-600 mt-1">Manage and export your generated videos</p>
            </div>
            
            <Button size="lg" asChild>
              <Link href="/generation">
                <Plus className="w-5 h-5 mr-2" />
                Generate New Video
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">All Videos</Button>
          <Button variant="outline" size="sm">Vertical</Button>
          <Button variant="outline" size="sm">Horizontal</Button>
          <Button variant="outline" size="sm">Processing</Button>
          <Button variant="outline" size="sm">Completed</Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-200">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="w-12 h-12 text-gray-400" />
                </div>
                
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`
                    px-2 py-1 text-xs font-medium rounded-full
                    ${video.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'}
                  `}>
                    {video.status}
                  </span>
                </div>

                {/* Duration */}
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 bg-black/70 text-white text-xs rounded">
                    {video.duration}
                  </span>
                </div>

                {/* Mode Badge */}
                <div className="absolute bottom-2 right-2">
                  <span className="px-2 py-1 bg-black/70 text-white text-xs rounded">
                    {video.mode === 'VERTICAL' ? '9:16' : '16:9'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2 truncate">{video.title}</h3>
                
                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <Clock className="w-4 h-4 mr-1" />
                  {new Date(video.createdAt).toLocaleDateString()}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {video.status === 'COMPLETED' ? (
                    <>
                      <Button size="sm" className="flex-1" asChild>
                        <Link href={`/result/${video.id}`}>
                          <Play className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="flex-1" disabled>
                      Processing...
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {mockVideos.length === 0 && (
          <div className="text-center py-16">
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
            <p className="text-gray-600 mb-6">Start by generating your first video</p>
            <Button asChild>
              <Link href="/generation">
                <Plus className="w-5 h-5 mr-2" />
                Generate Video
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
