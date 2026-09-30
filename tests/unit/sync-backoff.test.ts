import { describe, expect, it } from 'vitest';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelay } from '@/data/sync';

const midRandom = () => 0.5;

describe('backoffDelay', () => {
  it('is the base delay for attempt 1 with no jitter (random = 0.5 -> 1x)', () => {
    expect(backoffDelay(1, midRandom)).toBe(BACKOFF_BASE_MS);
  });
  it('doubles for attempt 2', () => {
    expect(backoffDelay(2, midRandom)).toBe(BACKOFF_BASE_MS * 2);
  });
  it('doubles again for attempt 3', () => {
    expect(backoffDelay(3, midRandom)).toBe(BACKOFF_BASE_MS * 4);
  });
  it('caps at the max delay for large attempts', () => {
    expect(backoffDelay(20, midRandom)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(50, midRandom)).toBe(BACKOFF_MAX_MS);
  });
  it('applies a -20% jitter floor when random() = 0', () => {
    expect(backoffDelay(1, () => 0)).toBe(Math.round(BACKOFF_BASE_MS * 0.8));
  });
  it('applies a +20% jitter ceiling when random() = 1', () => {
    expect(backoffDelay(1, () => 1)).toBe(Math.round(BACKOFF_BASE_MS * 1.2));
  });
  it('treats attempt <= 1 as attempt 1', () => {
    expect(backoffDelay(0, midRandom)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelay(-5, midRandom)).toBe(BACKOFF_BASE_MS);
  });
});
