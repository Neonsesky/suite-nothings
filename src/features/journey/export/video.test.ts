import { describe, expect, it } from 'vitest';
import { pickVideoMime } from './video';

describe('pickVideoMime', () => {
  it('prefers VP9 WebM when everything is supported', () => {
    expect(pickVideoMime(() => true)).toEqual({ mime: 'video/webm;codecs=vp9', ext: 'webm' });
  });

  it('walks the preference order', () => {
    const seen: string[] = [];
    pickVideoMime((m) => {
      seen.push(m);
      return false;
    });
    expect(seen).toEqual(['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4']);
  });

  it('falls back to VP8 and plain WebM', () => {
    expect(pickVideoMime((m) => m === 'video/webm;codecs=vp8' || m === 'video/webm')?.mime).toBe('video/webm;codecs=vp8');
    expect(pickVideoMime((m) => m === 'video/webm')).toEqual({ mime: 'video/webm', ext: 'webm' });
  });

  it('picks MP4 on Safari, which only records MP4', () => {
    expect(pickVideoMime((m) => m.startsWith('video/mp4'))).toEqual({ mime: 'video/mp4;codecs=avc1', ext: 'mp4' });
    expect(pickVideoMime((m) => m === 'video/mp4')).toEqual({ mime: 'video/mp4', ext: 'mp4' });
  });

  it('returns null when nothing is supported', () => {
    expect(pickVideoMime(() => false)).toBeNull();
  });

  it('treats a throwing probe as unsupported', () => {
    expect(
      pickVideoMime((m) => {
        if (m.startsWith('video/webm')) throw new Error('nope');
        return true;
      })?.ext,
    ).toBe('mp4');
  });
});
