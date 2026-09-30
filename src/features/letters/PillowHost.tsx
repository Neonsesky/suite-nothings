/**
 * Mounted once by the shell. Shows the pillow note on the home screen the first time its
 * reader opens the app on this device, and a one-time "Shady read your note" toast for the
 * author once the other phone has read it.
 */
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useRoute } from '@/app/router';
import { personName } from '@/config/couple';
import { getDevice, setDevice } from '@/data/device';
import { useDevicePref, useMe, useStoreReady } from '@/data/store';
import { toast } from '@/lib/toast';
import { useIntroActive } from '@/features/intro/state';
import { useLetterViews } from './access';
import { PillowNote } from './PillowNote';

export function PillowHost() {
  const me = useMe();
  const ready = useStoreReady();
  const intro = useIntroActive();
  const { match } = useRoute();
  const shown = useDevicePref('pillowShown');
  const views = useLetterViews();
  const [openId, setOpenId] = useState<string | null>(null);

  const onHome = match?.route.name === 'stays';
  const candidate = views.find((v) => !v.mine && v.unlocked && v.letter.to === me && !v.letter.read_at && !shown.includes(v.letter.letter_id));

  // Let the home screen settle before the turndown card slides in.
  useEffect(() => {
    if (!ready || intro || !onHome || !candidate || openId) return;
    const t = setTimeout(() => setOpenId(candidate.letter.letter_id), 900);
    return () => clearTimeout(t);
  }, [ready, intro, onHome, candidate, openId]);

  // Read receipts for the author.
  useEffect(() => {
    if (!ready || !me) return;
    const seen = getDevice('readReceiptsSeen');
    const fresh = views.filter((v) => v.mine && v.letter.read_at && !seen.includes(v.letter.letter_id));
    if (fresh.length === 0) return;
    setDevice('readReceiptsSeen', [...seen, ...fresh.map((v) => v.letter.letter_id)]);
    toast.show({ id: 'read-receipt', tone: 'love', message: `${personName(fresh[0].letter.to)} read your note`, action: { label: 'See letters', onClick: () => (location.hash = '#/letters') } });
  }, [ready, me, views]);

  const letter = openId ? views.find((v) => v.letter.letter_id === openId)?.letter : undefined;
  return <AnimatePresence>{letter ? <PillowNote key={letter.letter_id} letter={letter} onClose={() => setOpenId(null)} /> : null}</AnimatePresence>;
}
