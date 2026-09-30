import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoViewer, type ViewerItem } from '@/features/stay-detail/PhotoViewer';

const items: ViewerItem[] = [
  { photoId: null, artSeed: 'hotel-1', caption: 'Pool at dusk' },
  { photoId: null, artSeed: 'hotel-1', caption: 'Lobby' },
];

describe('PhotoViewer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<PhotoViewer items={items} index={null} onIndexChange={() => undefined} onClose={() => undefined} title="Atlantis" />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog with a counter when open', () => {
    render(<PhotoViewer items={items} index={0} onIndexChange={() => undefined} onClose={() => undefined} title="Atlantis" />);
    expect(screen.getByRole('dialog', { name: 'Atlantis photos' })).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('Escape closes and ArrowRight advances the index', () => {
    const onClose = vi.fn();
    const onIndexChange = vi.fn();
    render(<PhotoViewer items={items} index={0} onIndexChange={onIndexChange} onClose={onClose} title="Atlantis" />);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
