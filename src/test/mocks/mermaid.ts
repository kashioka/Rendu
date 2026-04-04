import { vi } from 'vitest';

const mermaid = {
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
};

export default mermaid;
