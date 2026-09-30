import { useDemoMode } from '@/data/store';
import { Badge } from './Badge';

/** "Demo" pill shown while the demo adapter is active. Renders nothing in live mode. */
export function DemoBadge({ className }: { className?: string }) {
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <Badge
      tone="honey"
      className={className}
      title="You're exploring demo stays. Connect our Sheet in Settings."
      aria-label="Demo mode: sample stays, nothing saved to our Sheet"
    >
      Demo
    </Badge>
  );
}
