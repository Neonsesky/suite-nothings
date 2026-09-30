import { beforeEach, describe, expect, it } from 'vitest';
import { isBusy, markBusy, onBusyChange } from '@/lib/busy';
import { toast } from '@/lib/toast';

describe('busy registry', () => {
  it('marks busy while a key is held and clears once released', () => {
    const release = markBusy('form-a');
    expect(isBusy()).toBe(true);
    release();
    expect(isBusy()).toBe(false);
  });

  it('release is idempotent (safe to call twice)', () => {
    const release = markBusy('form-b');
    release();
    expect(() => release()).not.toThrow();
    expect(isBusy()).toBe(false);
  });

  it('requires a matching release for each markBusy call on the same key', () => {
    const r1 = markBusy('form-c');
    const r2 = markBusy('form-c');
    expect(isBusy()).toBe(true);
    r1();
    expect(isBusy()).toBe(true);
    r2();
    expect(isBusy()).toBe(false);
  });

  it('onBusyChange fires on every change and stops firing after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = onBusyChange(() => {
      calls += 1;
    });
    const release = markBusy('form-d');
    expect(calls).toBe(1);
    release();
    expect(calls).toBe(2);
    unsubscribe();
    const release2 = markBusy('form-e');
    expect(calls).toBe(2);
    release2();
  });
});

describe('toast queue', () => {
  beforeEach(() => {
    toast.clear();
  });

  it('show returns an id and records the toast', () => {
    const id = toast.show({ message: 'Saved' });
    expect(typeof id).toBe('string');
    expect(toast.getAll()).toHaveLength(1);
    expect(toast.getAll()[0]!.id).toBe(id);
  });

  it('showing with the same id replaces rather than stacks', () => {
    toast.show({ id: 'fixed', message: 'first' });
    toast.show({ id: 'fixed', message: 'second' });
    expect(toast.getAll()).toHaveLength(1);
    expect(toast.getAll()[0]!.message).toBe('second');
  });

  it('keeps at most 3 visible toasts', () => {
    toast.show({ message: 'one' });
    toast.show({ message: 'two' });
    toast.show({ message: 'three' });
    toast.show({ message: 'four' });
    const all = toast.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.message)).toEqual(['two', 'three', 'four']);
  });

  it('dismiss removes a toast by id', () => {
    const id = toast.show({ message: 'bye' });
    toast.dismiss(id);
    expect(toast.getAll()).toHaveLength(0);
  });

  it('subscribe is called immediately with the current queue', () => {
    toast.show({ message: 'hello' });
    let received: readonly { message: string }[] = [];
    const unsubscribe = toast.subscribe((items) => {
      received = items;
    });
    expect(received).toHaveLength(1);
    expect(received[0]!.message).toBe('hello');
    unsubscribe();
  });

  it('defaults to a 4000ms duration, 6000ms when an action is present', () => {
    const plainId = toast.show({ message: 'plain' });
    const withActionId = toast.show({ message: 'actionable', action: { label: 'Undo', onClick: () => {} } });
    const plain = toast.getAll().find((t) => t.id === plainId);
    const withAction = toast.getAll().find((t) => t.id === withActionId);
    expect(plain?.durationMs).toBe(4000);
    expect(withAction?.durationMs).toBe(6000);
  });
});
