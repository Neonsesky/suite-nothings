/**
 * Share a stay (SPEC §12). A later wave replaces this with 1080×1920 share cards; for now it
 * shares a short text through the Web Share API, falling back to the clipboard.
 */
import { getState } from '@/data/store';
import { formatDate } from '@/lib/dates';
import { toast } from '@/lib/toast';

export async function shareStay(visitId: string): Promise<'shared' | 'copied' | 'cancelled' | 'unavailable'> {
  const visit = getState().visits.get(visitId) ?? null;
  const hotel = visit ? getState().hotels.get(visit.hotel_id) ?? null : null;
  if (!visit || !hotel) return 'unavailable';
  const text = `We checked into ${hotel.name}${hotel.city ? ` in ${hotel.city}` : ''} on ${formatDate(visit.date)}.`;
  const data = { title: hotel.name, text };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    toast.show({ message: 'Copied, ready to paste', tone: 'success' });
    return 'copied';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    toast.show({ message: "Couldn't share from this browser. Try a screenshot instead.", tone: 'error' });
    return 'unavailable';
  }
}
