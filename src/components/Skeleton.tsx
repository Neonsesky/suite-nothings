import type { CSSProperties } from 'react';
import s from './Skeleton.module.css';

export interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'pill';
  className?: string;
}

/** Shimmering placeholder block (static under reduced motion). */
export function Skeleton({ width = '100%', height = '1rem', radius = 'sm', className }: SkeletonProps) {
  return <span aria-hidden="true" className={[s.skeleton, s[radius], className ?? ''].join(' ')} style={{ width, height }} />;
}

/** Skeleton matching the StayCard footprint. */
export function StayCardSkeleton() {
  return (
    <div className={s.card} aria-hidden="true">
      <Skeleton height="auto" className={s.photo} radius="lg" />
      <Skeleton width="70%" height="1.1rem" />
      <Skeleton width="45%" height="0.9rem" />
      <Skeleton width="55%" height="0.9rem" />
    </div>
  );
}
