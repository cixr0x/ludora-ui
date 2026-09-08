import { readFile } from "node:fs/promises";
import { getHeapStatistics } from "node:v8";
import { getPriority } from "node:os";

export async function processEvidence(lease) {
  const result = { pid: process.pid, parentPid: process.ppid, holderPid: lease.holderPid,
    nodeVersion: process.version, execArgv: process.execArgv, heapLimitBytes: getHeapStatistics().heap_size_limit, nice: getPriority() };
  if (process.platform === "linux") {
    const group = async pid => (await readFile(`/proc/${pid}/cgroup`, "utf8")).split("\n").find(line => line.startsWith("0::"))?.slice(3);
    result.cgroup = await group(process.pid);
    result.holderCgroup = await group(lease.holderPid);
  }
  return result;
}
