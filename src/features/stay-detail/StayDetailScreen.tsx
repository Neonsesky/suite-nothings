/**
 * Stay detail (SPEC §8.4): shared-element header photo, ink-outlined photo panels, our notes and
 * both ratings (rate in place), our visits to this hotel, hotel info with enrichment states, a
 * mini map, directions, edit, share and soft delete with undo.
 */
import { useEffect, useState } from 'react';
import { href, navigate, useParams } from '@/app/router';
import { MoodStamp, isMoodId } from '@/components/brand/MoodStamps';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconBack, IconEdit, IconExternal, IconPhone, IconPin, IconShare, IconStar, IconSync, IconTrash } from '@/components/icons';
import { Skeleton } from '@/components/Skeleton';
import { StayArt } from '@/components/StayArt';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { personName, PEOPLE, type PersonId } from '@/config/couple';
import { parseJsonArray } from '@/data/stays';
import { softDeleteVisit, undoDeleteVisit, upsertVisit, useMe, usePhotoUrl, useStay, useStoreReady, useVisitsForHotel } from '@/data/store';
import type { Photo, Stay } from '@/data/types';
import { requestEnrichment, useEnrichmentStatus } from '@/enrichment';
import { shareStay } from '@/features/share';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { MiniMap } from '@/map/MiniMap';
import { closeStay, photoTransitionName } from '@/features/stays/transition';
import { PhotoViewer, type ViewerItem } from './PhotoViewer';
import s from './StayDetail.module.css';

export function directionLinks(lat: number, lng: number, name: string) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    apple: `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

const ART_MOTIFS = ['window', 'pool', 'skyline'] as const;

function HeaderPhoto({ stay }: { stay: Stay }) {
  const url = usePhotoUrl(stay.photos[0]?.photo_id ?? null, 'full');
  return url ? <img src={url} alt="" /> : <StayArt seed={stay.hotel.hotel_id} />;
}

function Panel({ photo, seed, index, onOpen }: { photo: Photo | null; seed: string; index: number; onOpen(): void }) {
  const url = usePhotoUrl(photo?.photo_id ?? null, 'thumb');
  return (
    <button type="button" className={s.panel} onClick={onOpen} aria-label={photo?.caption || `Open photo ${index + 1}`}>
      {url ? <img src={url} alt="" loading="lazy" /> : <StayArt seed={seed} motif={ART_MOTIFS[index % 3]} />}
    </button>
  );
}

function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className={s.stars} aria-label={label ?? `${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} data-on={i < value || undefined}>
          <IconStar size={16} aria-hidden="true" />
        </span>
      ))}
    </span>
  );
}

function RateInPlace({ stay, person }: { stay: Stay; person: PersonId }) {
  const [hover, setHover] = useState(0);
  const field = person === 'nirsh' ? 'rating_nirsh' : 'rating_shady';
  return (
    <div className={s.rate} role="radiogroup" aria-label="Rate this stay" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={false}
          aria-label={`${n} out of 5`}
          data-on={n <= hover || undefined}
          onMouseEnter={() => setHover(n)}
          onClick={() => {
            void upsertVisit({ ...stay.visit, [field]: n as 1 | 2 | 3 | 4 | 5 });
            toast.show({ message: 'Rating saved', tone: 'success' });
          }}
        >
          <IconStar size={28} />
        </button>
      ))}
    </div>
  );
}

function Ratings({ stay, me }: { stay: Stay; me: PersonId | null }) {
  return (
    <ul className={s.ratings} role="list">
      {PEOPLE.map((p) => {
        const r = p === 'nirsh' ? stay.visit.rating_nirsh : stay.visit.rating_shady;
        return (
          <li key={p}>
            <strong>{personName(p)}</strong>
            {r != null ? (
              <Stars value={r} label={`${personName(p)}: ${r} out of 5`} />
            ) : p === me ? (
              <span className={s.rateMe}>
                <span>Rate this stay</span>
                <RateInPlace stay={stay} person={p} />
              </span>
            ) : (
              <span className={s.waiting}>Waiting for {personName(p)}'s rating</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NoteEditor({ stay }: { stay: Stay }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(stay.visit.note ?? '');
  if (!editing) {
    return (
      <div className={s.note}>
        {stay.visit.note ? <blockquote>“{stay.visit.note}”</blockquote> : <p className={s.muted}>No notes yet.</p>}
        <Button variant="ghost" size="sm" icon={<IconEdit size={16} />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }
  return (
    <form
      className={s.noteForm}
      onSubmit={(e) => {
        e.preventDefault();
        void upsertVisit({ ...stay.visit, note: note.trim() || null });
        setEditing(false);
        toast.show({ message: 'Stay saved', tone: 'success' });
      }}
    >
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Our notes" autoFocus />
      <div className={s.row}>
        <Button type="submit" size="sm">
          Save our stay
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function HotelInfo({ stay }: { stay: Stay }) {
  const { hotel } = stay;
  const status = useEnrichmentStatus(hotel.hotel_id);
  useEffect(() => {
    if (hotel.enrichment_status === 'none' || hotel.enrichment_status === 'pending') void requestEnrichment(hotel.hotel_id);
  }, [hotel.hotel_id, hotel.enrichment_status]);
  // 'pending' only counts until this session's run settles; otherwise the skeleton never ends.
  const running = status === 'running' || (hotel.enrichment_status === 'pending' && status === 'idle');
  const amenities = parseJsonArray(hotel.amenities_json);
  const src = hotel.description_source;
  const rows: [string, React.ReactNode][] = [];
  if (hotel.address) rows.push(['Address', hotel.address]);
  if (hotel.stars) rows.push(['Stars', <Stars key="s" value={hotel.stars} label={`${hotel.stars} stars`} />]);
  if (hotel.price_level) rows.push(['Price level', '¤'.repeat(hotel.price_level)]);
  if (hotel.website)
    rows.push([
      'Website',
      <a key="w" href={hotel.website} target="_blank" rel="noopener noreferrer">
        {hotel.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} <IconExternal size={14} aria-hidden="true" />
      </a>,
    ]);
  if (hotel.phone)
    rows.push([
      'Phone',
      <a key="p" href={`tel:${hotel.phone.replace(/\s/g, '')}`}>
        <IconPhone size={14} aria-hidden="true" /> {hotel.phone}
      </a>,
    ]);
  return (
    <section className={s.section} aria-labelledby="hotel-info">
      <div className={s.headRow}>
        <h2 id="hotel-info">Hotel info</h2>
        <Button variant="ghost" size="sm" icon={<IconSync size={16} />} busy={running} onClick={() => void requestEnrichment(hotel.hotel_id, { force: true })}>
          Refresh info
        </Button>
      </div>
      {running ? (
        <div className={s.infoSkeleton} aria-label="Fetching hotel info…" role="status">
          <Skeleton height="1rem" />
          <Skeleton height="1rem" width="85%" />
          <Skeleton height="1rem" width="60%" />
        </div>
      ) : (
        <>
          {status === 'failed' || hotel.enrichment_status === 'failed' ? <p className={s.muted}>Couldn't fetch hotel info.</p> : null}
          {hotel.description ? <p className={s.description}>{hotel.description}</p> : null}
          {hotel.description && src === 'ai' ? <p className={s.attribution}>Written by AI from public info</p> : null}
          {hotel.description && (src === 'wikipedia' || src === 'wikidata') ? (
            <p className={s.attribution}>From {src === 'wikipedia' ? 'Wikipedia' : 'Wikidata'}, CC BY-SA</p>
          ) : null}
          {rows.length ? (
            <dl className={s.facts}>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {amenities.length ? (
            <ul className={s.amenities} role="list">
              {amenities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

function VisitsHere({ stay }: { stay: Stay }) {
  const visits = useVisitsForHotel(stay.hotel.hotel_id);
  return (
    <section className={s.section} aria-labelledby="visits-here">
      <h2 id="visits-here">Our visits here</h2>
      <ol className={s.timeline}>
        {visits.map((v) => {
          const current = v.visit.visit_id === stay.visit.visit_id;
          return (
            <li key={v.visit.visit_id} data-current={current || undefined}>
              {current ? (
                <span aria-current="page">
                  <strong>{formatDate(v.visit.date)}</strong> · Visit {v.visitNumber}
                </span>
              ) : (
                <a href={`#/stay/${v.visit.visit_id}`}>
                  <strong>{formatDate(v.visit.date)}</strong> · Visit {v.visitNumber}
                </a>
              )}
              <span className={s.muted}>{v.visit.visit_type}</span>
            </li>
          );
        })}
      </ol>
      <ButtonLink href={href('/add', { hotel: stay.hotel.hotel_id })} variant="secondary" size="sm" className={s.fit}>
        Visit again
      </ButtonLink>
    </section>
  );
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        art={<KeyTagMark size={72} />}
        title="This room key doesn't open anything"
        body="That page checked out. Let's get you back to our stays."
        action={<ButtonLink href="#/">Back to Stays</ButtonLink>}
      />
    </div>
  );
}

export default function StayDetailScreen() {
  const { visitId } = useParams();
  const ready = useStoreReady();
  const stay = useStay(visitId);
  const me = useMe();
  const [viewer, setViewer] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!ready) {
    return (
      <div className={s.screen} aria-busy="true" aria-label="Loading our stays…">
        <Skeleton height="18rem" radius="xs" />
        <div className="page">
          <Skeleton height="2rem" width="60%" />
        </div>
      </div>
    );
  }
  if (!stay || stay.visit.deleted) return <NotFound />;

  const { visit, hotel } = stay;
  const place = [hotel.area, hotel.city, hotel.city ? null : hotel.country].filter(Boolean).join(', ');
  const times = formatTimeRange(visit.check_in, visit.check_out);
  const panels: { photo: Photo | null; seed: string }[] = stay.photos.length
    ? stay.photos.map((p) => ({ photo: p, seed: hotel.hotel_id }))
    : ART_MOTIFS.map((m) => ({ photo: null, seed: `${hotel.hotel_id}|${m}` }));
  const items: ViewerItem[] = panels.map((p) => ({ photoId: p.photo?.photo_id ?? null, artSeed: p.seed, caption: p.photo?.caption }));
  const links = directionLinks(hotel.lat, hotel.lng, hotel.name);
  const mood = visit.mood && isMoodId(visit.mood) ? visit.mood : null;

  const doDelete = async () => {
    setConfirm(false);
    // Let the sheet finish closing (it restores focus and page semantics) before we leave.
    await new Promise((r) => window.setTimeout(r, 400));
    await softDeleteVisit(visit.visit_id);
    navigate('/', { replace: true });
    toast.show({ message: 'Stay moved out.', action: { label: 'Undo', onClick: () => void undoDeleteVisit(visit.visit_id) } });
  };

  return (
    <div className={s.screen}>
      <div className={s.header} data-stay-header={visit.visit_id} style={{ viewTransitionName: photoTransitionName(visit.visit_id) }}>
        <HeaderPhoto stay={stay} />
      </div>
      <div className={s.headerBar}>
        <button type="button" className={s.round} onClick={() => closeStay(visit.visit_id)} aria-label="Back">
          <IconBack size={20} />
        </button>
        <button type="button" className={s.round} onClick={() => void shareStay(visit.visit_id)} aria-label="Share this stay">
          <IconShare size={20} />
        </button>
      </div>

      <div className={`page ${s.layout}`}>
        <div className={s.main}>
          <div className={s.titleBlock}>
            <h1>{hotel.name}</h1>
            <p className={s.place}>
              {hotel.stars ? <Stars value={hotel.stars} label={`${hotel.stars} stars`} /> : null}
              {place}
            </p>
            <div className={s.row}>
              <span className={s.inkPill}>Visit {stay.visitNumber}</span>
              <span className={s.typePill}>{visit.visit_type}</span>
              {visit.picked_by ? <span className={s.typePill}>{visit.picked_by === 'both' ? 'Picked by both of us' : `${personName(visit.picked_by)} picked it`}</span> : null}
            </div>
          </div>

          <div className={s.panels} data-count={Math.min(panels.length, 5)}>
            {panels.slice(0, 5).map((p, i) => (
              <Panel key={p.photo?.photo_id ?? p.seed} photo={p.photo} seed={p.seed} index={i} onOpen={() => setViewer(i)} />
            ))}
          </div>

          <section className={s.section} aria-labelledby="notes">
            <h2 id="notes">Our notes</h2>
            <NoteEditor key={visit.updated_at} stay={stay} />
            {visit.favourite_moment ? (
              <p className={s.moment}>
                <span>The good part</span>
                {visit.favourite_moment}
              </p>
            ) : null}
            {mood ? (
              <div className={s.mood}>
                <MoodStamp mood={mood} size={88} />
              </div>
            ) : null}
          </section>

          <section className={s.section} aria-labelledby="ratings">
            <h2 id="ratings">Ratings</h2>
            <Ratings stay={stay} me={me} />
          </section>

          <VisitsHere stay={stay} />
          <HotelInfo stay={stay} />

          <section className={s.section} aria-labelledby="on-map">
            <h2 id="on-map">On the map</h2>
            <MiniMap lat={hotel.lat} lng={hotel.lng} label={hotel.name} className={s.map} pitch={45} zoom={15} />
          </section>
        </div>

        <aside className={s.side} aria-label="This stay">
          <div className={s.sideCard}>
            <p className={s.bigDate}>{formatDate(visit.date)}</p>
            {times ? <span className={s.slot}>{times}</span> : null}
            {visit.nights > 0 ? <span className={s.muted}>{visit.nights === 1 ? '1 night' : `${visit.nights} nights`}</span> : null}
            <div className={s.directions}>
              <a className={s.dirButton} href={links.google} target="_blank" rel="noopener noreferrer" data-dir="google">
                <IconPin size={16} aria-hidden="true" /> Google Maps
              </a>
              <a className={s.dirButton} href={links.apple} target="_blank" rel="noopener noreferrer" data-dir="apple">
                Apple Maps
              </a>
              <a className={s.dirButton} href={links.waze} target="_blank" rel="noopener noreferrer" data-dir="waze">
                Waze
              </a>
            </div>
            <div className={s.actions}>
              <ButtonLink href={href('/add', { edit: visit.visit_id })} variant="secondary" icon={<IconEdit size={18} />}>
                Edit stay
              </ButtonLink>
              <Button variant="secondary" icon={<IconShare size={18} />} onClick={() => void shareStay(visit.visit_id)}>
                Share this stay
              </Button>
              <Button variant="ghost" icon={<IconTrash size={18} />} className={s.delete} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <PhotoViewer items={items} index={viewer} onIndexChange={setViewer} onClose={() => setViewer(null)} title={hotel.name} />
      <BottomSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Remove this stay?"
        snapPoints={[0.4]}
        footer={
          <div className={s.confirmRow} data-no-drag>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => void doDelete()} icon={<IconTrash size={18} />}>
              Delete
            </Button>
          </div>
        }
      >
        <p className={s.muted}>You can undo this for a few seconds after.</p>
      </BottomSheet>
    </div>
  );
}
