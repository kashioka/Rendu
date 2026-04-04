import { vi } from 'vitest';

export const getCurrentWindow = vi.fn().mockReturnValue({
  setTheme: vi.fn().mockResolvedValue(undefined),
});
