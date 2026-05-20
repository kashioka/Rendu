/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// jsdom does not implement HTMLElement.prototype.scrollTo; provide a no-op so
// components that call container.scrollTo() during effects (e.g. MarkdownViewer)
// don't throw unhandled errors in tests.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollToShim() { /* no-op */ };
}
