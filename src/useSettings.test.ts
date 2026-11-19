import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-fs', () => import('./test/mocks/tauri-fs'));
vi.mock('@tauri-apps/api/path', () => import('./test/mocks/tauri-path'));
vi.mock('@tauri-apps/api/window', () => import('./test/mocks/tauri-window'));
vi.mock('@tauri-apps/api/core', () => import('./test/mocks/tauri-core'));

import { useSettings, migrateStored, darkPreset, lightPreset, systemPreset, presets } from './useSettings';

describe('useSettings', () => {
  it('has dark, light, and system presets', () => {
    expect(presets.dark).toBe(darkPreset);
    expect(presets.light).toBe(lightPreset);
    expect(presets.system).toBe(systemPreset);
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

  it('systemPreset has all required fields', () => {
    expect(systemPreset.preset).toBe('system');
    expect(systemPreset.locale).toBe('en');
    expect(systemPreset.appBg).toBeDefined();
    expect(systemPreset.mermaidTheme).toBe('base');
  });

  it('defaults to systemPreset', async () => {
    const { result } = renderHook(() => useSettings());
    // Wait for async loadFromFile
    await act(async () => {});
    expect(result.current.settings.preset).toBe('system');
  });

  it('patches settings with setSettings', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => {
      result.current.setSettings({ appBg: '#000000' });
    });
    expect(result.current.settings.appBg).toBe('#000000');
    // Other fields remain unchanged
    expect(result.current.settings.preset).toBe('system');
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

  it('keeps dark and light customizations independently across preset switches', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});

    // Customize dark
    act(() => result.current.applyPreset('dark'));
    act(() => result.current.setSettings({ appBg: '#111111' }));
    expect(result.current.settings.appBg).toBe('#111111');

    // Light starts untouched
    act(() => result.current.applyPreset('light'));
    expect(result.current.settings.appBg).toBe(lightPreset.appBg);
    act(() => result.current.setSettings({ appBg: '#eeeeee' }));
    expect(result.current.settings.appBg).toBe('#eeeeee');

    // Switching back restores each bucket (no reset)
    act(() => result.current.applyPreset('dark'));
    expect(result.current.settings.appBg).toBe('#111111');
    act(() => result.current.applyPreset('light'));
    expect(result.current.settings.appBg).toBe('#eeeeee');
  });

  // Issue #223: fenced code used the dark highlight palette on the light
  // code background. Each palette now picks its own highlight theme and base
  // code-block text color.
  it('switches the highlight theme and code text color with the palette', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    const root = document.documentElement;

    act(() => result.current.applyPreset('light'));
    expect(document.getElementById('hljs-theme')?.dataset.theme).toBe('light');
    expect(root.style.getPropertyValue('--md-code-text')).toBe(lightPreset.mdCodeText);

    act(() => result.current.applyPreset('dark'));
    expect(document.getElementById('hljs-theme')?.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--md-code-text')).toBe(darkPreset.mdCodeText);
    expect(document.querySelectorAll('#hljs-theme')).toHaveLength(1);
  });

  it('customizes code block text per palette', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => result.current.applyPreset('light'));
    act(() => result.current.setSettings({ mdCodeText: '#000000' }));
    expect(document.documentElement.style.getPropertyValue('--md-code-text')).toBe('#000000');
    act(() => result.current.applyPreset('dark'));
    expect(result.current.settings.mdCodeText).toBe(darkPreset.mdCodeText);
  });

  it('resetPreset restores the active palette to its defaults', async () => {
    const { result } = renderHook(() => useSettings());
    await act(async () => {});
    act(() => result.current.applyPreset('dark'));
    act(() => result.current.setSettings({ appBg: '#111111' }));
    expect(result.current.settings.appBg).toBe('#111111');
    act(() => result.current.resetPreset());
    expect(result.current.settings.appBg).toBe(darkPreset.appBg);
  });
});

describe('migrateStored', () => {
  it('migrates a legacy flat dark config into the dark bucket', () => {
    const s = migrateStored({ preset: 'dark', locale: 'ja', appBg: '#123456' });
    expect(s?.preset).toBe('dark');
    expect(s?.locale).toBe('ja');
    expect(s?.dark.appBg).toBe('#123456');
    // Other bucket stays at stock defaults
    expect(s?.light.appBg).toBe(lightPreset.appBg);
  });

  it('reads the new bucketed schema as-is', () => {
    const s = migrateStored({
      preset: 'light',
      locale: 'en',
      dark: { appBg: '#111111' },
      light: { appBg: '#eeeeee' },
    });
    expect(s?.dark.appBg).toBe('#111111');
    expect(s?.light.appBg).toBe('#eeeeee');
  });

  // Settings saved before the code text color existed get the default.
  it('fills mdCodeText for settings saved before it existed', () => {
    const s = migrateStored({ preset: 'light', locale: 'en', dark: { appBg: '#111111' }, light: { mdCodeBg: '#eeeeee' } });
    expect(s?.light.mdCodeText).toBe(lightPreset.mdCodeText);
    expect(s?.light.mdCodeBg).toBe('#eeeeee');
    expect(s?.dark.mdCodeText).toBe(darkPreset.mdCodeText);
  });

  it('falls back to system preset for invalid input', () => {
    expect(migrateStored(null)).toBeNull();
    expect(migrateStored({ preset: 'bogus' })?.preset).toBe('system');
  });
});
