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

export function useUpdateCheck(): {
  info: UpdateInfo | null;
  isLatest: boolean;
  dismissUpdate: () => void;
  dismissLatest: () => void;
} {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [isLatest, setIsLatest] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [latestDismissed, setLatestDismissed] = useState(false);

  useEffect(() => {
    invoke<UpdateCheckResult>("check_for_updates")
      .then((result) => {
        if (result.has_update) {
          setInfo({
            latestVersion: result.latest_version,
            currentVersion: result.current_version,
            releaseUrl: result.release_url,
          });
        } else {
          setIsLatest(true);
        }
      })
      .catch(() => {});
  }, []);

  return {
    info: updateDismissed ? null : info,
    isLatest: latestDismissed ? false : isLatest,
    dismissUpdate: () => setUpdateDismissed(true),
    dismissLatest: () => setLatestDismissed(true),
  };
}
