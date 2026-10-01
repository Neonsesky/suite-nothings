/**
 * Journey video recorder: composites the WebGL map canvas and the overlay into an offscreen
 * 1080×1920 canvas and records it with MediaRecorder (WebM where possible, MP4 on Safari).
 * Call `frame()` from the map's 'render' event so the WebGL buffer is still readable
 * without `preserveDrawingBuffer`.
 */
import { coverTransform, drawOverlay, type OverlayState } from './overlay';
import { COLORS } from './paint';

const MIME_PREFERENCE: { mime: string; ext: 'webm' | 'mp4' }[] = [
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
];

/** First supported recording type, WebM before MP4; null when the browser can't record. */
export function pickVideoMime(isTypeSupported?: (m: string) => boolean): { mime: string; ext: 'webm' | 'mp4' } | null {
  const check =
    isTypeSupported ??
    (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? (m: string) => MediaRecorder.isTypeSupported(m)
      : null);
  if (!check) return null;
  for (const option of MIME_PREFERENCE) {
    try {
      if (check(option.mime)) return { ...option };
    } catch {
      /* treat a throwing probe as unsupported */
    }
  }
  return null;
}

/** True when this browser can record a canvas to a video file. */
export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickVideoMime() !== null
  );
}

export interface JourneyRecorder {
  readonly mime: string;
  readonly ext: 'webm' | 'mp4';
  start(): void;
  /** Composite one frame: paper, the map (cover-fitted), then the overlay. */
  frame(state: OverlayState): void;
  /** Stops recording and resolves the finished video. */
  stop(): Promise<Blob>;
  /** Stops and discards everything. */
  cancel(): void;
}

/** If the map hasn't rendered for this long, repaint the last composition so the stream keeps moving. */
const STALL_MS = 100;

export function createJourneyRecorder(opts: {
  /** The WebGL map canvas. */
  source: HTMLCanvasElement;
  width?: number;
  height?: number;
  fps?: number;
  bitsPerSecond?: number;
}): JourneyRecorder {
  const { source, width = 1080, height = 1920, fps = 30, bitsPerSecond = 6_000_000 } = opts;
  const picked = pickVideoMime();
  if (!picked) throw new Error('Video recording is not supported in this browser');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available');

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: picked.mime, videoBitsPerSecond: bitsPerSecond });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let done = false;
  let hasFrame = false;
  let lastFrameAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const paintPaper = () => {
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, width, height);
  };

  const cleanup = () => {
    done = true;
    if (timer !== null) clearInterval(timer);
    timer = null;
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    mime: picked.mime,
    ext: picked.ext,

    start() {
      if (done || recorder.state !== 'inactive') return;
      if (!hasFrame) paintPaper();
      recorder.start(1000);
      timer = setInterval(() => {
        // Holds at stops can have no map renders: touch the canvas (self-copy, no visible change)
        // so captureStream keeps emitting frames instead of stalling.
        if (done || now() - lastFrameAt <= STALL_MS) return;
        ctx.drawImage(canvas, 0, 0);
      }, Math.max(16, Math.round(1000 / fps)));
    },

    frame(state) {
      if (done) return;
      paintPaper();
      const cssW = source.clientWidth || source.width;
      const cssH = source.clientHeight || source.height;
      const t = coverTransform(cssW, cssH, width, height);
      if (source.width > 0 && source.height > 0 && cssW > 0 && cssH > 0) {
        // the whole device-px buffer maps onto the CSS-px rect the transform describes
        ctx.drawImage(source, 0, 0, source.width, source.height, t.dx, t.dy, cssW * t.scale, cssH * t.scale);
      }
      drawOverlay(ctx, state, t, width, height);
      hasFrame = true;
      lastFrameAt = now();
    },

    stop() {
      const type = picked.mime.split(';')[0];
      return new Promise<Blob>((resolve, reject) => {
        if (recorder.state === 'inactive') {
          cleanup();
          if (chunks.length) resolve(new Blob(chunks, { type }));
          else reject(new Error('Nothing was recorded'));
          return;
        }
        recorder.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type }));
        };
        recorder.onerror = () => {
          cleanup();
          reject(new Error('Recording failed'));
        };
        done = true;
        recorder.stop();
      });
    },

    cancel() {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* already stopping */
        }
      }
      chunks.length = 0;
      cleanup();
    },
  };
}
