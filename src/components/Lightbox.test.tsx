import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '../test/helpers';
import { Lightbox } from './Lightbox';

describe('Lightbox', () => {
  it('renders image with correct src and alt', () => {
    renderWithLocale(<Lightbox src="/test.png" alt="Test" onClose={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/test.png');
    expect(img).toHaveAttribute('alt', 'Test');
  });

  it('calls onClose on close button click', async () => {
    const onClose = vi.fn();
    renderWithLocale(<Lightbox src="/test.png" onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    renderWithLocale(<Lightbox src="/test.png" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows download button when onDownload provided', () => {
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByTitle('Download')).toBeInTheDocument();
  });

  it('hides download button when onDownload not provided', () => {
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} />);
    expect(screen.queryByTitle('Download')).not.toBeInTheDocument();
  });

  it('calls onDownload when download button clicked', async () => {
    const onDownload = vi.fn();
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} onDownload={onDownload} />);
    await userEvent.click(screen.getByTitle('Download'));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('sets body overflow to hidden on mount', () => {
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
