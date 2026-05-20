import { vi } from 'vitest';

export const getCurrentWebview = vi.fn().mockReturnValue({
  onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
});
