import { vi } from 'vitest';

export const readDir = vi.fn().mockResolvedValue([]);
export const readTextFile = vi.fn().mockResolvedValue('');
export const writeTextFile = vi.fn().mockResolvedValue(undefined);
export const writeFile = vi.fn().mockResolvedValue(undefined);
export const mkdir = vi.fn().mockResolvedValue(undefined);
export const exists = vi.fn().mockResolvedValue(false);
