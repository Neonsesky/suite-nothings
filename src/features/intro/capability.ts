/** Should this device get the 3D intro? Low-end devices and reduced motion get the 2D one. */
export function canRun3D(nav: Pick<Navigator, 'hardwareConcurrency'> = navigator): boolean {
  if ((nav.hardwareConcurrency ?? 0) <= 4) return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Average frame time over `frames` animation frames (ms). */
export function probeFrameTime(frames = 6): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    const tick = (now: number) => {
      times.push(now);
      if (times.length > frames) resolve((times[times.length - 1] - times[0]) / frames);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
