import { GoogleGenerativeAI } from '@google/generative-ai';
import { Storage } from '@google-cloud/storage';
import { config } from '@/config';

async function checkBasicGemini(): Promise<{ ok: boolean; message: string }> {
  try {
    console.log('Testing API key:', config.gemini.apiKey?.slice(0, 10) + '...');
    
    // Test basic Gemini API access first
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.gemini.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }]
      })
    });

    if (response.status === 401) {
      return { ok: false, message: 'API key is invalid or expired' };
    }
    
    if (response.status === 403) {
      return { ok: false, message: 'API key lacks basic Gemini access' };
    }
    
    if (response.ok || response.status === 400) {
      return { ok: true, message: 'Basic Gemini API access working' };
    }
    
    const text = await response.text();
    return { ok: false, message: `Gemini API error: ${response.status} - ${text.slice(0, 100)}` };
  } catch (e: any) {
    return { ok: false, message: `Gemini check failed: ${e?.message}` };
  }
}

async function checkVeo(): Promise<{ ok: boolean; message: string }> {
  try {
    // First, try to list available models to see what's accessible
    const listResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.gemini.apiKey}`,
      },
    });

    if (listResponse.ok) {
      const models = await listResponse.json();
      const allModels = models.models || [];
      const veoModels = allModels.filter((m: any) => m.name.includes('veo'));
      const videoModels = allModels.filter((m: any) => 
        m.name.includes('video') || 
        m.name.includes('veo') || 
        m.supportedGenerationMethods?.includes('generateVideo')
      );
      console.log('All available models:', allModels.map((m: any) => m.name));
      console.log('Veo models:', veoModels.map((m: any) => m.name));
      console.log('Video models:', videoModels.map((m: any) => m.name));
    } else {
      console.log('Failed to list models:', await listResponse.text());
    }

    // Test the actual Veo 3 video generation endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.veo3.model}:generateVideo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.gemini.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test video',
        aspectRatio: '16:9',
        duration: '3s',
        quality: 'high'
      })
    });

    const text = await response.text();
    
    if (response.status === 401) {
      return { ok: false, message: `Veo 3 API key invalid or missing permissions: ${text.slice(0, 200)}` };
    }
    
    if (response.status === 403) {
      return { ok: false, message: `Veo 3 access forbidden - API key may not have Veo 3 access: ${text.slice(0, 200)}` };
    }
    
    if (response.status === 404) {
      return { ok: false, message: `Veo 3 model not found - may not be available in your region: ${text.slice(0, 200)}` };
    }
    
    // Any 2xx or even 4xx (like quota exceeded) means the API is reachable
    if (response.status < 500) {
      return { ok: true, message: `Veo 3 API reachable (status: ${response.status})` };
    }
    
    return { ok: false, message: `Veo 3 server error: ${response.status} - ${text.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, message: `Veo 3 check failed: ${e?.message}` };
  }
}

async function checkGCS(): Promise<{ ok: boolean; message: string }> {
  try {
    if (config.storage.type !== 'gcs') {
      return { ok: true, message: `Storage type is '${config.storage.type}', skipping GCS check` };
    }
    const storageOptions: any = { projectId: config.gcp.projectId };
    if (config.gcp.credentialsPath) storageOptions.keyFilename = config.gcp.credentialsPath;
    const storage = new Storage(storageOptions);
    const [exists] = await storage.bucket(config.gcp.storageBucket).exists();
    if (!exists) return { ok: false, message: `Bucket '${config.gcp.storageBucket}' does not exist or is not accessible` };
    // Try a signed URL on a non-existent object to validate permissions shape
    const file = storage.bucket(config.gcp.storageBucket).file(`diagnostics_${Date.now()}.txt`);
    try {
      await file.getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
      return { ok: true, message: `GCS reachable, bucket '${config.gcp.storageBucket}' accessible` };
    } catch (e: any) {
      return { ok: false, message: `GCS signed URL failed: ${e?.message}` };
    }
  } catch (e: any) {
    return { ok: false, message: `GCS check failed: ${e?.message}` };
  }
}

(async () => {
  const gemini = await checkBasicGemini();
  const veo = await checkVeo();
  const gcs = await checkGCS();
  console.log(JSON.stringify({ gemini, veo, gcs }, null, 2));
})();


