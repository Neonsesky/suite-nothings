/** "Our stays" (SPEC §3.3 row 4): city tabs from our data, the card grid and the filters sheet. */
import { useEffect, useMemo, useState } from 'react';
import { href } from '@/app/router';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { IconArrowRight, IconFilter } from '@/components/icons';
import { personName, type PersonId } from '@/config/couple';
import { ABROAD } from '@/data/stays';
import { onRemoteChange, useMe, useSettings } from '@/data/store';
import type { Stay, VisitType } from '@/data/types';
import { DiaryCard } from './DiaryCard';
import { ALL_TAB, activeFilterCount, applyFilters, cityTabs, filterOptions, type StayFilters } from './logic';
import s from './Sections.module.css';

/** Visit ids that just arrived from the other phone, cleared after the entrance animation. */
function useArrivals(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  useEffect(
    () =>
      onRemoteChange((c) => {
        if (!c.newVisits.length) return;
        const fresh = c.newVisits.map((v) => v.visit_id);
        setIds((prev) => new Set([...prev, ...fresh]));
        window.setTimeout(() => setIds((prev) => new Set([...prev].filter((id) => !fresh.includes(id)))), 2400);
      }),
    [],
  );
  return ids;
}

function FiltersSheet({ open, onClose, stays, draft, setDraft, onApply }: { open: boolean; onClose(): void; stays: Stay[]; draft: StayFilters; setDraft(f: StayFilters): void; onApply(f: StayFilters): void }) {
  const home = useSettings().home_base;
  const opts = useMemo(() => filterOptions(stays, home), [stays, home]);
  const count = applyFilters(stays, draft, home).length;
  const pickLabel = (p: PersonId | 'both') => (p === 'both' ? 'Both of us' : personName(p));
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      snapPoints={[0.8]}
      footer={
        <div className={s.sheetFooter} data-no-drag>
          <Button variant="ghost" onClick={() => setDraft({})}>
            Clear
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            disabled={count === 0}
          >
            Show our stays
          </Button>
        </div>
      }
    >
      <div className={s.filterGroups} data-no-drag>
        <div className={s.filterGroup}>
          <h3>City</h3>
          <ChipGroup label="City" allowEmpty options={opts.cities.map((c) => ({ value: c, label: c }))} value={draft.city ?? null} onChange={(v) => setDraft({ ...draft, city: (v as string) ?? null })} />
        </div>
        <div className={s.filterGroup}>
          <h3>Year</h3>
          <ChipGroup label="Year" allowEmpty options={opts.years.map((y) => ({ value: String(y), label: String(y) }))} value={draft.year ? String(draft.year) : null} onChange={(v) => setDraft({ ...draft, year: v ? Number(v) : null })} />
        </div>
        <div className={s.filterGroup}>
          <h3>Type</h3>
          <ChipGroup label="Type" allowEmpty options={opts.types.map((t) => ({ value: t, label: t }))} value={draft.type ?? null} onChange={(v) => setDraft({ ...draft, type: (v as VisitType) ?? null })} />
        </div>
        <div className={s.filterGroup}>
          <h3>Rating</h3>
          <ChipGroup label="Rating" allowEmpty options={opts.ratings.map((r) => ({ value: String(r), label: `♡ ${r}+` }))} value={draft.minRating ? String(draft.minRating) : null} onChange={(v) => setDraft({ ...draft, minRating: v ? Number(v) : null })} />
        </div>
        <div className={s.filterGroup}>
          <h3>Who picked it</h3>
          <ChipGroup label="Who picked it" allowEmpty options={opts.pickedBy.map((p) => ({ value: p, label: pickLabel(p) }))} value={draft.pickedBy ?? null} onChange={(v) => setDraft({ ...draft, pickedBy: (v as PersonId | 'both') ?? null })} />
        </div>
        <p className={s.filterCount} aria-live="polite">
          {count === 1 ? '1 stay found' : `${count} stays found`}
        </p>
      </div>
    </BottomSheet>
  );
}

export function OurStays({ stays }: { stays: Stay[] }) {
  const home = useSettings().home_base;
  const me = useMe();
  const arrivals = useArrivals();
  const tabs = useMemo(() => cityTabs(stays, home), [stays, home]);
  const [tab, setTab] = useState<string | null>(null);
  const [filters, setFilters] = useState<StayFilters>({});
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<StayFilters>({});
  const activeTab = tab && tabs.some((t) => t.value === tab) ? tab : tabs[0]?.value ?? ALL_TAB;
  const shown = useMemo(() => applyFilters(stays, { ...filters, tab: activeTab }, home), [stays, filters, activeTab, home]);
  const visitsByHotel = useMemo(() => {
    const m = new Map<string, number>();
    for (const st of stays) m.set(st.hotel.hotel_id, (m.get(st.hotel.hotel_id) ?? 0) + 1);
    return m;
  }, [stays]);
  const nFilters = activeFilterCount(filters);
  const seeAll = activeTab !== ALL_TAB && activeTab !== ABROAD ? activeTab : null;

  return (
    <section className={s.section} aria-labelledby="our-stays" data-section="our-stays">
      <h2 id="our-stays" className={s.h2}>
        Our stays
      </h2>
      <div className={s.tabsRow}>
        <div className={s.tabs} role="tablist" aria-label="City">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={t.value === activeTab}
              className={s.tab}
              onClick={() => setTab(t.value)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const i = tabs.findIndex((x) => x.value === activeTab);
                const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                setTab(next.value);
                (e.currentTarget.parentElement?.children[tabs.indexOf(next)] as HTMLElement | undefined)?.focus();
              }}
              tabIndex={t.value === activeTab ? 0 : -1}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className={s.filterButton} onClick={() => {
            setDraft(filters);
            setSheet(true);
          }} aria-label={nFilters ? `Filters, ${nFilters} on` : 'Filters'}>
          <IconFilter size={18} aria-hidden="true" />
          <span>Filters</span>
          {nFilters ? <span className={s.filterBadge}>{nFilters}</span> : null}
        </button>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          title="No stays match that"
          body="Try a different name, area, or a word from a note."
          action={
            <Button variant="secondary" onClick={() => setFilters({})}>
              Clear
            </Button>
          }
        />
      ) : (
        <div className={s.grid} role="tabpanel" aria-label={activeTab}>
          {shown.map((st) => (
            <DiaryCard key={st.visit.visit_id} stay={st} hotelVisits={visitsByHotel.get(st.hotel.hotel_id) ?? 1} me={me} arriving={arrivals.has(st.visit.visit_id)} />
          ))}
        </div>
      )}
      {seeAll ? (
        <a className={s.seeAll} href={href('/map', { city: seeAll })}>
          See all our {seeAll} stays
          <IconArrowRight size={18} aria-hidden="true" />
        </a>
      ) : null}
      <FiltersSheet open={sheet} onClose={() => setSheet(false)} stays={stays} draft={draft} setDraft={setDraft} onApply={setFilters} />
    </section>
  );
}
