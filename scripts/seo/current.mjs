import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readLiveGeneration, readVerifiedRuntime, withGenerationLock, writeJsonAtomic } from "./publish.mjs";

export async function refreshCurrentGeneration({ stateDirectory, livePath, lockPath, apiOrigin,
  loadWorker = directory => import(/* @vite-ignore */ pathToFileURL(join(directory, "refresh-worker.mjs")).href) }) {
  return withGenerationLock(lockPath, async lease => {
    let worker, runtimeDirectory;
    try {
      const live = await readLiveGeneration(livePath);
      runtimeDirectory = live?.manifest?.runtimeDirectory;
      if (!runtimeDirectory) throw new Error("No retained SEO runtime: run the initial build first");
      await readVerifiedRuntime(runtimeDirectory);
      worker = await loadWorker(runtimeDirectory);
    } catch (error) {
      await writeJsonAtomic(join(stateDirectory, "status.json"), { status: "failed", phase: "runtime-selection", error: error.message, failedAt: new Date().toISOString() }).catch(() => {});
      throw error;
    }
    return worker.refreshSeo({ runtimeDirectory, stateDirectory, livePath, lockPath, lease, apiOrigin });
  });
}
