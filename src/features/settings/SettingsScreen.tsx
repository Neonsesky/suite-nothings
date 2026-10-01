/** Settings (SPEC §8.8, design/plan.md §7.8, design/copy.md §9). Owned by w1-shell. */
import { useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { IconChevron, IconDownload, IconUpload } from '@/components/icons';
import { COUPLE, PEOPLE, type PersonId } from '@/config/couple';
import { APP_VERSION, BUILD_DATE } from '@/config/env';
import { goBack } from '@/app/router';
import { ConnectionSection } from '@/features/connection/ConnectionSection';
import { setDevice } from '@/data/device';
import {
  clearDemo,
  exportData as getSnapshot,
  importData,
  resetDemo,
  setMe,
  updateSettings,
  useBootError,
  useDemoMode,
  useDevicePref,
  useMe,
  useSettings,
  useStoreReady,
} from '@/data/store';
import type { Letter, Photo, Snapshot, Visit, Wish, Hotel } from '@/data/types';
import { useMarkBusy } from '@/lib/busy';
import { formatDate } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { downloadExport, ImportError, parseImport } from './exportData';
import { HomeBasePicker } from './HomeBasePicker';
import { HotelInfoSettings } from '@/enrichment/ui/HotelInfoSettings';
import s from './Settings.module.css';

export default function SettingsScreen() {
  const ready = useStoreReady();
  const bootError = useBootError();
  // Only the first load gets the skeleton. Switching Demo ↔ Live re-inits the store; unmounting
  // then would drop the Connection section's "Connected" result mid-flow.
  const [loaded, setLoaded] = useState(ready);
  if (ready && !loaded) setLoaded(true);

  if (bootError) {
    return (
      <div className="page">
        <ErrorState title="Settings couldn't load" body={bootError} />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`page ${s.screen}`}>
        <Skeleton width="6rem" height="1.5rem" />
        <Skeleton width="10rem" height="2rem" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={s.card}>
            <Skeleton width="30%" height="0.75rem" />
            <Skeleton width="60%" height="1.5rem" />
          </div>
        ))}
      </div>
    );
  }

  return <SettingsBody />;
}

function SettingsBody() {
  const me = useMe();
  const demo = useDemoMode();
  const muted = useDevicePref('muted');
  const reduced = useDevicePref('reducedMotion');
  const settings = useSettings();

  const [homeSheetOpen, setHomeSheetOpen] = useState(false);
  const [clearSheetOpen, setClearSheetOpen] = useState(false);
  const [importState, setImportState] = useState<{ file: File; snap: Partial<Snapshot> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const snap = await parseImport(file);
      setImportState({ file, snap });
    } catch (e) {
      const message = e instanceof ImportError ? e.message : "That file isn't one of our exports. Look for suite-nothings-….zip or .json.";
      toast.show({ message, tone: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`page ${s.screen}`}>
      <div className={s.header}>
        <a
          href="#/us"
          className={s.back}
          aria-label="Back"
          onClick={(e) => { e.preventDefault(); goBack('/us'); }}
        >
          <IconChevron size={20} className={s.backIcon} />
        </a>
        <h1 className={s.heading}>Settings</h1>
      </div>

      <section className={s.card} aria-labelledby="who-am-i-label">
        <p id="who-am-i-label" className={s.label}>Who am I</p>
        <ChipGroup
          label="Who am I"
          options={PEOPLE.map((p) => ({ value: p, label: COUPLE.people[p].name }))}
          value={me}
          onChange={(v) => v && setMe(v as PersonId)}
        />
        <p className={s.helper}>Switches greetings and whose name goes on new stays.</p>
      </section>

      <section className={s.card} aria-labelledby="home-base-label">
        <p id="home-base-label" className={s.label}>Home base</p>
        <div className={s.row}>
          <div className={s.rowMain}>
            <span className={s.value}>{settings.home_base.city}, {settings.home_base.country}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setHomeSheetOpen(true)} iconEnd={<IconChevron size={16} />}>
            Change
          </Button>
        </div>
      </section>

      <ConnectionSection />

      <section className={s.card} aria-labelledby="map-lighting-label">
        <p id="map-lighting-label" className={s.label}>Map lighting</p>
        <ChipGroup
          label="Map lighting"
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'day', label: 'Day' },
            { value: 'golden', label: 'Golden hour' },
            { value: 'night', label: 'Night' },
          ]}
          value={settings.map_lighting}
          onChange={(v) => v && void updateSettings({ map_lighting: v as typeof settings.map_lighting })}
        />
      </section>

      <section className={s.card} aria-labelledby="units-label">
        <p id="units-label" className={s.label}>Units</p>
        <ChipGroup
          label="Units"
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
          value={settings.units}
          onChange={(v) => v && void updateSettings({ units: v as typeof settings.units })}
        />
      </section>

      <section className={s.card} aria-labelledby="hotel-info-label">
        <p id="hotel-info-label" className={s.label}>Hotel info</p>
        <HotelInfoSettings />
      </section>

      <section className={s.card} aria-labelledby="reduce-motion-label">
        <p id="reduce-motion-label" className={s.label}>Reduce motion</p>
        <ChipGroup
          label="Reduce motion"
          options={[
            { value: 'system', label: 'System' },
            { value: 'reduce', label: 'Reduce' },
            { value: 'full', label: 'Full' },
          ]}
          value={reduced == null ? 'system' : reduced ? 'reduce' : 'full'}
          onChange={(v) => setDevice('reducedMotion', v === 'system' ? null : v === 'reduce')}
        />
      </section>

      <section className={s.card} aria-labelledby="sound-label">
        <div className={s.row}>
          <p id="sound-label" className={s.label} style={{ margin: 0 }}>Sound</p>
          <SoundSwitch muted={!!muted} />
        </div>
      </section>

      <section className={s.card} aria-labelledby="data-label">
        <p id="data-label" className={s.label}>Your data</p>
        <div className={s.actions}>
          <Button variant="secondary" icon={<IconDownload size={18} />} onClick={() => downloadExport()}>
            Download our data
          </Button>
          <Button
            variant="secondary"
            icon={<IconUpload size={18} />}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Import
          </Button>
          <input
            ref={fileInputRef}
            className={s.importFileInput}
            type="file"
            tabIndex={-1}
            accept=".json,.zip,application/json,application/zip"
            aria-label="Import a suite-nothings export file"
            onChange={(e) => void onPickImportFile(e.target.files?.[0])}
          />
        </div>
        <p className={s.helper}>JSON and CSV, for safekeeping.</p>
      </section>

      {demo ? (
        <section className={`${s.card} ${s.demoCard}`} aria-labelledby="demo-label">
          <p id="demo-label" className={s.label}>Demo data</p>
          <div className={s.actions}>
            <Button variant="ghost" onClick={() => setClearSheetOpen(true)}>Clear demo data</Button>
            <Button
              variant="ghost"
              onClick={() => void resetDemo().then(() => toast.show({ message: 'The demo stays are back', tone: 'success' }))}
            >
              Bring back the demo stays
            </Button>
          </div>
        </section>
      ) : null}

      <AboutSection />

      <BottomSheet
        open={homeSheetOpen}
        onClose={() => setHomeSheetOpen(false)}
        title="Change home base"
      >
        <HomeBasePicker
          value={settings.home_base}
          autoFocus
          onChange={(next) => {
            setHomeSheetOpen(false);
            void updateSettings({ home_base: next }).then(() =>
              toast.show({ message: `Home base set to ${next.city}`, tone: 'success' }),
            );
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={clearSheetOpen}
        onClose={() => setClearSheetOpen(false)}
        title="Clear demo data?"
        footer={
          <div className={s.actions}>
            <Button variant="ghost" onClick={() => setClearSheetOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setClearSheetOpen(false);
                void clearDemo().then(() => toast.show({ message: 'Demo data cleared', tone: 'neutral' }));
              }}
            >
              Clear
            </Button>
          </div>
        }
      >
        <p className={s.helper}>Removes every sample stay. Nothing real is touched.</p>
      </BottomSheet>

      <ImportPreviewSheet
        state={importState}
        onClose={() => setImportState(null)}
      />
    </div>
  );
}

function SoundSwitch({ muted }: { muted: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-labelledby="sound-label"
      className={s.switch}
      onClick={() => import('@/lib/sound').then(({ setMuted }) => setMuted(!muted))}
    >
      <span className={s.switchTrack}>
        <span className={s.switchThumb} />
      </span>
    </button>
  );
}

const TABLES = [
  { key: 'hotels', idField: 'hotel_id', label: 'Hotels' },
  { key: 'visits', idField: 'visit_id', label: 'Stays' },
  { key: 'photos', idField: 'photo_id', label: 'Photos' },
  { key: 'wishes', idField: 'wish_id', label: 'Wishlist' },
  { key: 'letters', idField: 'letter_id', label: 'Letters' },
] as const;

type Row = Hotel | Visit | Photo | Wish | Letter;

function diffCounts(current: Snapshot, incoming: Partial<Snapshot>) {
  const rows = TABLES.map(({ key, idField, label }) => {
    const incomingRows = (incoming[key] as Row[] | undefined) ?? [];
    const currentRows = current[key] as Row[];
    const byId = new Map(currentRows.map((r) => [(r as unknown as Record<string, unknown>)[idField], r]));
    let changed = 0;
    for (const row of incomingRows) {
      const id = (row as unknown as Record<string, unknown>)[idField];
      const cur = byId.get(id) as { updated_at: string } | undefined;
      if (!cur || (row as unknown as { updated_at: string }).updated_at > cur.updated_at) changed++;
    }
    return { label, total: incomingRows.length, changed };
  }).filter((t) => t.total > 0);
  const settingsChanged = !!incoming.settings?.updated_at && incoming.settings.updated_at > (current.settings.updated_at ?? '');
  return { rows, settingsChanged };
}

function ImportPreviewSheet({ state, onClose }: { state: { file: File; snap: Partial<Snapshot> } | null; onClose(): void }) {
  useMarkBusy(!!state, 'settings-import');
  const current = getSnapshot();
  const diff = state ? diffCounts(current, state.snap) : { rows: [], settingsChanged: false };

  const onConfirm = () => {
    if (!state) return;
    const snap = state.snap;
    onClose();
    void importData(snap).then((n) => {
      toast.show({ message: n > 0 ? `Imported ${n} change${n === 1 ? '' : 's'}` : 'Everything was already up to date', tone: 'success' });
    });
  };

  return (
    <BottomSheet
      open={!!state}
      onClose={onClose}
      title="Import this file?"
      footer={
        <div className={s.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>Import</Button>
        </div>
      }
    >
      <div className={s.sheetBody}>
        <p className={s.helper}>
          Merges with what&rsquo;s already on this phone — matching records keep the newest edit. Nothing else changes.
        </p>
        {diff.rows.length === 0 && !diff.settingsChanged ? (
          <p className={s.previewNote}>Nothing new in this file — everything already matches.</p>
        ) : (
          <ul className={s.previewList}>
            {diff.rows.map((r) => (
              <li key={r.label} className={s.previewRow}>
                <span>{r.label}</span>
                <span>{r.changed} of {r.total} new or updated</span>
              </li>
            ))}
            {diff.settingsChanged ? (
              <li className={s.previewRow}>
                <span>Settings</span>
                <span>Updated</span>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}

function AboutSection() {
  const linkProps = { target: '_blank', rel: 'noopener' } as const;
  return (
    <section className={`${s.card} ${s.about}`} aria-labelledby="about-label">
      <p id="about-label" className={s.label}>About</p>
      <KeyTagMark size={40} title={COUPLE.appName} />
      <p className={s.aboutName}>{COUPLE.appName}</p>
      <p className={s.aboutTagline}>{COUPLE.tagline}</p>
      <p className={s.aboutMeta}>
        Version {APP_VERSION} &middot; Built {formatDate(BUILD_DATE)}
      </p>
      <p className={s.aboutCredit}>
        Designed as a love letter to Dayuse, where our first check-in happened.
      </p>
      <ul className={s.attributions}>
        <li><a href="https://www.openstreetmap.org/copyright" {...linkProps}>© OpenStreetMap contributors</a></li>
        <li><a href="https://openfreemap.org" {...linkProps}>Map tiles by OpenFreeMap</a></li>
        <li><a href="https://photon.komoot.io" {...linkProps}>Hotel search by Photon, from Komoot</a></li>
        <li><a href="https://www.naturalearthdata.com" {...linkProps}>Natural Earth (public domain) for the offline world outline</a></li>
        <li>
          Hotel facts from <a href="https://www.wikidata.org" {...linkProps}>Wikidata</a> (CC0),{' '}
          <a href="https://en.wikipedia.org" {...linkProps}>Wikipedia</a> summaries (CC BY-SA 4.0),{' '}
          <a href="https://overpass-api.de" {...linkProps}>Overpass API</a> over OpenStreetMap (ODbL) and pictures from{' '}
          <a href="https://commons.wikimedia.org" {...linkProps}>Wikimedia Commons</a>, each credited with its author and licence
        </li>
        <li>
          Fonts <a href="https://fonts.google.com/specimen/Manrope" {...linkProps}>Manrope</a> and{' '}
          <a href="https://www.jetbrains.com/lp/mono/" {...linkProps}>JetBrains Mono</a> under the{' '}
          <a href="https://scripts.sil.org/OFL" {...linkProps}>SIL Open Font License 1.1</a>
        </li>
      </ul>
    </section>
  );
}
