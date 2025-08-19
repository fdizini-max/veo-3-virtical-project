const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed with ${res.status}`;
    try {
      const data = JSON.parse(text);
      message = data?.error || data?.message || message;
    } catch (_) {
      // fall through
    }
    throw new Error(message);
  }
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Bad JSON payload:', text);
    throw e;
  }
}

export class APIClient {
  /**
   * Create generation job
   * @param {string} prompt
   * @param {('VERTICAL'|'HORIZONTAL'|'vertical'|'horizontal')} mode
   * @param {File=} imageFile
   * @param {Object=} options { duration, fps, resolution, backgroundMode, useFastModel }
   */
  async createGenerationJob(prompt, mode, imageFile, options = {}) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    // Map legacy 'VERTICAL' to backend's 'VERTICAL_FIRST'
    const normalizedMode = (mode || 'VERTICAL').toString().toUpperCase();
    formData.append('mode', normalizedMode === 'VERTICAL' ? 'VERTICAL_FIRST' : normalizedMode);

    if (options.duration) formData.append('duration', String(options.duration));
    if (options.fps) formData.append('fps', String(options.fps));
    if (options.resolution) formData.append('resolution', options.resolution);
    if (options.backgroundMode) formData.append('backgroundMode', options.backgroundMode);
    if (typeof options.useFastModel === 'boolean') formData.append('useFastModel', String(options.useFastModel));

    if (imageFile) {
      // Backend expects 'referenceImage'
      formData.append('referenceImage', imageFile);
      // Also add 'image' for compatibility with other clients
      formData.append('image', imageFile);
    }

    const res = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  }

  /**
   * Get job status
   * @param {string} jobId
   */
  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/v1/generate/${jobId}`);
    return handleResponse(res);
  }

  /**
   * Request export
   * @param {string} jobId
   * @param {('METADATA_ROTATE'|'GUARANTEED_UPRIGHT'|'SCALE_PAD'|'HORIZONTAL')} exportType
   * @param {{ x?:number, y?:number }=} cropOptions
   * @param {{ resolution?:string, fps?:number, preset?:string }=} options
   */
  async exportVideo(jobId, exportType, cropOptions = {}, options = {}) {
    const payload = {
      exportType,
      resolution: options.resolution || '1080x1920',
      fps: options.fps ?? 30,
      preset: options.preset,
      cropX: cropOptions.x,
      cropY: cropOptions.y,
    };

    const res = await fetch(`${API_BASE}/v1/generate/${jobId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  }
}

export const api = new APIClient();


