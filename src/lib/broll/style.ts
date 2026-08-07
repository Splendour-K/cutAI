export type StyleProfile = {
  histogram: number[]; // normalized histogram
  motionEnergy: number; // 0..1
};

function createCanvas(width = 160, height = 90) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function computeHistogramFromImageData(data: ImageData, binsPerChannel = 4) {
  const bins = binsPerChannel;
  const totalBins = bins * bins * bins;
  const hist = new Float32Array(totalBins);
  const pixels = data.data;
  const len = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const ri = Math.floor((r / 256) * bins);
    const gi = Math.floor((g / 256) * bins);
    const bi = Math.floor((b / 256) * bins);
    const idx = ri * bins * bins + gi * bins + bi;
    hist[idx] += 1;
  }
  // normalize
  const sum = hist.reduce((s, v) => s + v, 0) || 1;
  return Array.from(hist).map(v => v / sum);
}

export async function computeImageHistogram(imageUrl: string, binsPerChannel = 4): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = createCanvas(160, Math.round((img.height / img.width) * 160));
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hist = computeHistogramFromImageData(data, binsPerChannel);
        resolve(hist);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(new Error('Failed to load image ' + imageUrl));
    img.src = imageUrl;
  });
}

export async function computeVideoStyle(videoUrl: string, samples = 6, binsPerChannel = 4): Promise<StyleProfile> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = videoUrl;

    const canvas = createCanvas(160, 90);
    const ctx = canvas.getContext('2d')!;

    let attempts = 0;

    function onLoadedMetadata() {
      const duration = video.duration || 0;
      const times: number[] = [];
      const margin = Math.min(0.5, duration * 0.01);
      for (let i = 0; i < samples; i++) {
        const t = margin + (i / Math.max(1, samples - 1)) * Math.max(0, duration - 2 * margin);
        times.push(t);
      }

      const histograms: number[][] = [];
      let prevImageData: ImageData | null = null;
      let motionAcc = 0;
      let processed = 0;

      const handleFrame = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hist = computeHistogramFromImageData(data, binsPerChannel);
          histograms.push(hist);
          if (prevImageData) {
            // compute frame diff
            let diff = 0;
            const a = data.data;
            const b = prevImageData.data;
            for (let i = 0; i < a.length; i += 4) {
              diff += Math.abs(a[i] - b[i]);
              diff += Math.abs(a[i+1] - b[i+1]);
              diff += Math.abs(a[i+2] - b[i+2]);
            }
            motionAcc += diff / (a.length / 4) / 255 / 3; // normalized
          }
          prevImageData = data;
        } catch (e) {}

        processed++;
        if (processed < times.length) {
          video.currentTime = times[processed];
        } else {
          // average histograms
          const avg = new Array(histograms[0].length).fill(0);
          for (const h of histograms) {
            for (let i = 0; i < h.length; i++) avg[i] += h[i];
          }
          for (let i = 0; i < avg.length; i++) avg[i] /= histograms.length;
          const motionEnergy = Math.min(1, motionAcc / Math.max(1, histograms.length - 1));
          resolve({ histogram: avg, motionEnergy });
        }
      };

      // start sampling
      video.currentTime = times[0];
      video.addEventListener('seeked', function onSeek() {
        video.removeEventListener('seeked', onSeek);
        handleFrame();
        video.addEventListener('seeked', handleFrame);
      });
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', (e) => reject(new Error('Failed to load video ' + videoUrl)));
  });
}

export function histogramDistance(a: number[], b: number[]) {
  // simple L2 distance
  let sum = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function histogramSimilarity(a: number[], b: number[]) {
  // convert L2 distance to similarity 0..1
  const d = histogramDistance(a, b);
  return 1 / (1 + d);
}
