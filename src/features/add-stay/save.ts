/**
 * "Save our stay": hotel (if new) → visit → photos, all through the store so every write lands in
 * IndexedDB and the outbox first and syncs later (works offline).
 */
import { addPhoto, getState, upsertHotel, upsertVisit } from '@/data/store';
import { buildStays } from '@/data/stays';
import type { PersonId } from '@/config/couple';
import type { Stay, Visit } from '@/data/types';
import { requestEnrichment } from '@/enrichment';
import { buildSavePlan, type AddStayDraft } from './draft';

export interface SaveResult {
  visit: Visit;
  hotelIsNew: boolean;
  /** Stays before and after the save, for the milestone check and the counter. */
  before: Stay[];
  after: Stay[];
}

function currentStays(): Stay[] {
  const s = getState();
  return buildStays([...s.visits.values()], s.hotels, [...s.photos.values()]).filter((x) => !x.visit.deleted);
}

export async function saveStay(draft: AddStayDraft, me: PersonId | null, existing: Visit | null): Promise<SaveResult> {
  const before = currentStays();
  let plan = buildSavePlan(draft, { me, existing });
  let hotelIsNew = false;
  if (plan.hotel) {
    const hotel = await upsertHotel({ ...plan.hotel, enrichment_status: 'pending' });
    hotelIsNew = true;
    plan = buildSavePlan(draft, { me, existing, hotelId: hotel.hotel_id });
    // Background enrichment (SPEC §11); never blocks the save.
    void requestEnrichment(hotel.hotel_id).catch(() => undefined);
  }
  let visit = await upsertVisit(plan.visit);
  const created: string[] = [];
  for (const p of plan.newPhotos) {
    if (!p.full || !p.thumb) continue;
    const photo = await addPhoto(visit.visit_id, p.full, {
      caption: p.caption.trim() || undefined,
      processed: { thumb: p.thumb, full: p.full, width: p.width, height: p.height, taken_at: p.taken_at },
    });
    created.push(photo.photo_id);
  }
  if (created.length > 0 || existing) {
    const ids = plan.order.map((id) => (id.startsWith('new:') ? created[Number(id.slice(4))] : id)).filter(Boolean);
    const latest = getState().visits.get(visit.visit_id) ?? visit;
    if (latest.photo_ids_json !== JSON.stringify(ids)) visit = await upsertVisit({ ...latest, photo_ids_json: JSON.stringify(ids) });
    else visit = latest;
  }
  return { visit, hotelIsNew, before, after: currentStays() };
}
