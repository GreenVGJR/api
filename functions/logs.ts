import { Context } from "hono";

type RequestLogEntry = {
  path: [string, number];
  requester: string;
  UA: string;
  timestamp: string;
};

const MAX_REQUEST_LOGS = 30;

const globalStore = globalThis as typeof globalThis & {
  __vgjr_logs?: RequestLogEntry[];
};

const requestLogs = globalStore.__vgjr_logs || (globalStore.__vgjr_logs = []);

function maskConnectingIp(ip?: string): string {
  const rawIp = ip?.split(",")[0]?.trim();
  if (!rawIp) return "null";

  if (rawIp.includes(":")) {
    const parts = rawIp.split(":").filter(Boolean);
    return `${parts[0] || "xxx"}:xxx::${parts.at(-1) || "xxx"}`;
  }

  const parts = rawIp.split(".");
  if (parts.length === 4) return `${parts[0]}.xxx.xxx.${parts[3]}`;

  return rawIp.length <= 4 ? "xxx" : `${rawIp.slice(0, 4)}xxx`;
}

export function recordRequestLog(c: Context, statusCode: number) {
  const country = c.req.header("cf-ipcountry") || "null";
  const requester = `${country}-${maskConnectingIp(c.req.header("cf-connecting-ip"))}`;
  const path = c.req.path;
  const UA = c.req.header("user-agent") || "null";

  requestLogs.unshift({
    timestamp: new Date().toISOString(),
    path: [path, statusCode],
    requester,
    UA,
  });

  if (requestLogs.length > MAX_REQUEST_LOGS) {
    requestLogs.splice(MAX_REQUEST_LOGS);
  }
}

export function getLastRequestedLogs(): RequestLogEntry[] {
  return requestLogs.slice(0, MAX_REQUEST_LOGS);
}
