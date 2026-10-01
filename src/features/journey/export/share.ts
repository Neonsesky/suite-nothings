/** Hand an exported file to the system share sheet, or download it where sharing files isn't possible. */

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Shares `blob` as a file via the Web Share API when the browser can share files;
 * a dismissed sheet is 'cancelled'. Anything else falls back to an `<a download>`.
 * Call from a user gesture (Safari requires transient activation for `share`).
 */
export async function shareOrDownload(blob: Blob, filename: string, meta: { title: string; text: string }): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && typeof File !== 'undefined') {
    const file = new File([blob], filename, { type: blob.type });
    let shareable: boolean;
    try {
      shareable = nav.canShare({ files: [file] });
    } catch {
      shareable = false;
    }
    if (shareable) {
      try {
        await nav.share({ files: [file], title: meta.title, text: meta.text });
        return 'shared';
      } catch (err) {
        if ((err as { name?: unknown } | null)?.name === 'AbortError') return 'cancelled';
        // e.g. NotAllowedError after the gesture expired: fall back to a download
      }
    }
  }
  return download(blob, filename);
}

function download(blob: Blob, filename: string): ShareOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    // WebKit can drop the download if the URL is revoked synchronously
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** `suite-nothings-journey-2026-10-01.webm` */
export function journeyFilename(ext: string, today: string): string {
  return `suite-nothings-journey-${today}.${ext.replace(/^\.+/, '')}`;
}
