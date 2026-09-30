/**
 * MiniMap — small map tile with an optional pin. Owned by w1-map, who replaces this stub with a
 * lazily loaded MapLibre implementation. The props are the contract.
 */
import { StayArt } from '@/components/StayArt';
import { IconPin } from '@/components/icons';
import s from './MiniMap.module.css';

export interface MiniMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  pitch?: number;
  /** Animate a pin drop on mount (save celebration). */
  dropPin?: boolean;
  /** Pin / accessible label, e.g. the hotel name. */
  label?: string;
  className?: string;
  /** With `onMove`: a pin picker with a centre crosshair; the map pans under it. */
  interactive?: boolean;
  onMove?(center: { lat: number; lng: number }): void;
}

export function MiniMap({ lat, lng, label, className, interactive }: MiniMapProps) {
  return (
    <div
      className={[s.root, className ?? ''].join(' ')}
      role="img"
      aria-label={label ? `Map showing ${label}` : `Map at ${lat.toFixed(3)}, ${lng.toFixed(3)}`}
      data-interactive={interactive || undefined}
    >
      <StayArt seed={`${lat.toFixed(2)},${lng.toFixed(2)}`} motif="skyline" />
      <span className={s.pin} aria-hidden="true">
        <IconPin size={32} />
      </span>
    </div>
  );
}

export default MiniMap;
