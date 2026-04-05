import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '../test/helpers';
import { Settings } from './Settings';
import { darkPreset } from '../useSettings';

describe('Settings', () => {
  const defaultProps = {
    settings: darkPreset,
    onChange: vi.fn(),
    onApplyPreset: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders the title', () => {
    renderWithLocale(<Settings {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders language buttons', () => {
    renderWithLocale(<Settings {...defaultProps} />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('日本語')).toBeInTheDocument();
  });

  it('calls onChange with locale when language button clicked', async () => {
    const onChange = vi.fn();
    renderWithLocale(<Settings {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('日本語'));
    expect(onChange).toHaveBeenCalledWith({ locale: 'ja' });
  });

  it('renders theme preset buttons', () => {
    renderWithLocale(<Settings {...defaultProps} />);
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('calls onApplyPreset when theme button clicked', async () => {
    const onApplyPreset = vi.fn();
    renderWithLocale(<Settings {...defaultProps} onApplyPreset={onApplyPreset} />);
    await userEvent.click(screen.getByText('Light'));
    expect(onApplyPreset).toHaveBeenCalledWith('light');
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    renderWithLocale(<Settings {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn();
    renderWithLocale(<Settings {...defaultProps} onClose={onClose} />);
    // Backdrop is the div with bg-black/50
    const backdrop = document.querySelector('.bg-black\\/50') as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows auto-save message', () => {
    renderWithLocale(<Settings {...defaultProps} />);
    expect(screen.getByText('Settings are saved automatically.')).toBeInTheDocument();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    renderWithLocale(<Settings {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has role=dialog and aria-modal', () => {
    renderWithLocale(<Settings {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
