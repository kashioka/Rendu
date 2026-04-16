import { createTauriTest } from "@srsholmes/tauri-playwright";

export const { test, expect } = createTauriTest({
  devUrl: "http://localhost:5173",
  ipcMocks: {
    check_for_updates: () => ({
      has_update: false,
      latest_version: "0.5.0",
      current_version: "0.5.0",
      release_url: "",
    }),
  },
});
