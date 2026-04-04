import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '../test/helpers';
import { ImageWithOverlay } from './ImageWithOverlay';

describe('ImageWithOverlay', () => {
  it('renders plain img when src is undefined', () => {
    renderWithLocale(<ImageWithOverlay />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.closest('.image-wrapper')).toBeNull();
  });

  it('renders image with overlay wrapper when src is provided', () => {
    renderWithLocale(<ImageWithOverlay src="/photo.png" alt="Photo" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/photo.png');
    expect(img).toHaveAttribute('alt', 'Photo');
    expect(img.closest('.image-wrapper')).toBeTruthy();
  });

  it('shows download button on hover', () => {
    renderWithLocale(<ImageWithOverlay src="/photo.png" alt="Photo" />);
    expect(screen.getByTitle('Download image')).toBeInTheDocument();
  });

  it('opens lightbox on image click', async () => {
    renderWithLocale(<ImageWithOverlay src="/photo.png" alt="Photo" />);
    const img = screen.getByRole('img');
    await userEvent.click(img);
    // Lightbox renders a second img and a close button
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('closes lightbox on close button', async () => {
    renderWithLocale(<ImageWithOverlay src="/photo.png" alt="Photo" />);
    await userEvent.click(screen.getByRole('img'));
    expect(screen.getByTitle('Close')).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
  });

  it('triggers download via anchor element', async () => {
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    renderWithLocale(<ImageWithOverlay src="/photo.png" alt="Photo" />);
    await userEvent.click(screen.getByTitle('Download image'));
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
