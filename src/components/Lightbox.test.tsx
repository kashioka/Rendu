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

  it('has role=dialog and aria-modal', () => {
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('traps focus within dialog on Tab', () => {
    const onDownload = vi.fn();
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} onDownload={onDownload} />);
    const buttons = screen.getAllByRole('button');
    // Focus last button, then Tab should wrap to first
    buttons[buttons.length - 1].focus();
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('traps focus within dialog on Shift+Tab', () => {
    const onDownload = vi.fn();
    renderWithLocale(<Lightbox src="/test.png" onClose={vi.fn()} onDownload={onDownload} />);
    const buttons = screen.getAllByRole('button');
    // Focus first button, then Shift+Tab should wrap to last
    buttons[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});
