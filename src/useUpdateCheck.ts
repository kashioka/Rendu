import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
}

interface UpdateCheckResult {
  has_update: boolean;
  latest_version: string;
  current_version: string;
  release_url: string;
}

export function useUpdateCheck(): { info: UpdateInfo | null; dismiss: () => void } {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    invoke<UpdateCheckResult>("check_for_updates")
      .then((result) => {
        if (result.has_update) {
          setInfo({
            latestVersion: result.latest_version,
            currentVersion: result.current_version,
            releaseUrl: result.release_url,
          });
        }
      })
      .catch(() => {});
  }, []);

  return {
    info: dismissed ? null : info,
    dismiss: () => setDismissed(true),
  };
}
