import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-fs', () => import('./test/mocks/tauri-fs'));
vi.mock('@tauri-apps/api/path', () => import('./test/mocks/tauri-path'));
vi.mock('@tauri-apps/api/window', () => import('./test/mocks/tauri-window'));

import { useSettings, darkPreset, lightPreset, presets } from './useSettings';

describe('useSettings', () => {
  it('has dark and light presets', () => {
    expect(presets.dark).toBe(darkPreset);
    expect(presets.light).toBe(lightPreset);
  });

  it('darkPreset has all required fields', () => {
    expect(darkPreset.preset).toBe('dark');
    expect(darkPreset.locale).toBe('en');
    expect(darkPreset.appBg).toBeDefined();
    expect(darkPreset.mermaidTheme).toBe('base');
  });

  it('lightPreset has all required fields', () => {
    expect(lightPreset.preset).toBe('light');
    expect(lightPreset.locale).toBe('en');
    expect(lightPreset.appBg).toBeDefined();
    expect(lightPreset.mermaidTheme).toBe('base');
  });

  it('defaults to darkPreset', async () => {
    const { result } = renderHook(() => useSettings());
    // Wait for async loadFromFile
    await act(async () => {});
    expect(result.current.settings.preset).toBe('dark');
  });

  it('patches settings with setSettings', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => {
      result.current.setSettings({ appBg: '#000000' });
    });
    expect(result.current.settings.appBg).toBe('#000000');
    // Other fields remain unchanged
    expect(result.current.settings.preset).toBe('dark');
  });

  it('switches preset while preserving locale', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    // Change locale first
    act(() => {
      result.current.setSettings({ locale: 'ja' });
    });
    expect(result.current.settings.locale).toBe('ja');
    // Apply light preset
    act(() => {
      result.current.applyPreset('light');
    });
    expect(result.current.settings.preset).toBe('light');
    expect(result.current.settings.appBg).toBe(lightPreset.appBg);
    // Locale should be preserved
    expect(result.current.settings.locale).toBe('ja');
  });
});
