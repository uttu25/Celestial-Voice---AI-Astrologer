// --- DELETE THIS LINE BELOW ---
// import { Blob } from '@google/genai'; 

// --- KEEP THE REST OF THE FILE AS IS ---
export function base64ToUint8Array(base64: string): Uint8Array {
  // ... (keep existing code)
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ... (keep arrayBufferToBase64 and decodeAudioData)

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  // This object literal is compatible with Blob structure expected by Gemini
  return {
    data: arrayBufferToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  } as any; 
}
