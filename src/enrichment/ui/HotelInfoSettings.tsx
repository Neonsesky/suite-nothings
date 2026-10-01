/**
 * Settings → Hotel info: the optional AI description and Google Places toggles (SPEC §11.4–11.5).
 * Both are off by default and saved per device.
 */
import { useEffect, useState } from 'react';
import { ChipGroup } from '@/components/Chip';
import { useStore } from '@/data/store';
import { detectOllama } from '../ai';
import { setPrefs, useEnrichmentPrefs, type AIChoice } from '../prefs';
import s from './enrichment.module.css';

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;

export function HotelInfoSettings() {
  const prefs = useEnrichmentPrefs();
  const live = useStore((st) => st.adapterKind === 'sheets');
  const [models, setModels] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isDesktop()) return;
    const ctrl = new AbortController();
    void detectOllama(undefined, ctrl.signal).then((m) => !ctrl.signal.aborted && setModels(m));
    return () => ctrl.abort();
  }, []);

  const options: { value: AIChoice; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'apps-script', label: 'Through our Sheet' },
  ];
  if (models?.length || prefs.ai === 'ollama') options.push({ value: 'ollama', label: 'Ollama on this computer' });

  return (
    <div className={s.settings}>
      <p className={s.settingsTitle}>AI descriptions</p>
      <ChipGroup label="AI descriptions" options={options} value={prefs.ai} onChange={(v) => v && setPrefs({ ai: v as AIChoice })} />
      {prefs.ai === 'ollama' && models?.length ? (
        <ChipGroup label="Ollama model" scroll options={models.map((m) => ({ value: m, label: m }))} value={prefs.ollamaModel ?? ''} onChange={(v) => setPrefs({ ollamaModel: typeof v === 'string' && v ? v : null })} />
      ) : null}
      <p className={s.hint}>
        {prefs.ai === 'off'
          ? 'Facts come from OpenStreetMap and Wikipedia. Turn this on and an AI rewrites them into a few warm lines, labelled as AI.'
          : prefs.ai === 'apps-script'
            ? live
              ? 'Uses the AI key in our Sheet’s Script Properties. No key yet? It quietly does nothing.'
              : 'Works once our Sheet is connected and has an AI key.'
            : models?.length
              ? prefs.ollamaModel
                ? `Using ${prefs.ollamaModel} on this computer. Nothing leaves it.`
                : 'Pick a model to use.'
              : 'We can’t see Ollama on this computer right now.'}
      </p>

      <p className={s.settingsTitle}>Google Places</p>
      <ChipGroup
        label="Google Places"
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
        value={prefs.places ? 'on' : 'off'}
        onChange={(v) => v && setPrefs({ places: v === 'on' })}
      />
      <p className={s.hint}>Extra facts through our Sheet. It needs a Google Cloud key with billing, so it can cost money.</p>
    </div>
  );
}
