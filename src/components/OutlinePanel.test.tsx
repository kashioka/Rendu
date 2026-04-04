import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithLocale } from '../test/helpers';
import { OutlinePanel, type HeadingItem } from './OutlinePanel';

describe('OutlinePanel', () => {
  it('shows empty message when no headings', () => {
    renderWithLocale(<OutlinePanel headings={[]} />);
    expect(screen.getByText('No headings')).toBeInTheDocument();
  });

  it('renders heading items', () => {
    const headings: HeadingItem[] = [
      { id: 'intro', text: 'Introduction', level: 1 },
      { id: 'setup', text: 'Setup', level: 2 },
    ];
    renderWithLocale(<OutlinePanel headings={headings} />);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
  });

  it('shows Japanese empty message', () => {
    renderWithLocale(<OutlinePanel headings={[]} />, { locale: 'ja' });
    expect(screen.getByText('見出しなし')).toBeInTheDocument();
  });

  it('applies indentation based on heading level', () => {
    const headings: HeadingItem[] = [
      { id: 'h1', text: 'Level 1', level: 1 },
      { id: 'h2', text: 'Level 2', level: 2 },
    ];
    renderWithLocale(<OutlinePanel headings={headings} />);
    const level1 = screen.getByText('Level 1').closest('.outline-item') as HTMLElement;
    const level2 = screen.getByText('Level 2').closest('.outline-item') as HTMLElement;
    expect(level1).toBeTruthy();
    expect(level2).toBeTruthy();
    // Level 2 should have more paddingLeft than level 1
    const pad1 = parseInt(level1.style.paddingLeft);
    const pad2 = parseInt(level2.style.paddingLeft);
    expect(pad2).toBeGreaterThan(pad1);
  });
});
