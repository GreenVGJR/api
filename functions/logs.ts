import { Context } from "hono";

type RequestLogEntry = {
	path: [string, number];
	UA: string;
	timestamp: string;
};

const MAX_REQUEST_LOGS = 30;

const globalStore = globalThis as typeof globalThis & {
	__vgjr_logs?: RequestLogEntry[];
};

const requestLogs = globalStore.__vgjr_logs || (globalStore.__vgjr_logs = []);

export function recordRequestLog(c: Context, statusCode: number) {
	const path = c.req.path;
	const UA = c.req.header("user-agent") || "null";

	requestLogs.unshift({
		timestamp: new Date().toISOString(),
		path: [path, statusCode],
		UA,
	});

	if (requestLogs.length > MAX_REQUEST_LOGS) {
		requestLogs.splice(MAX_REQUEST_LOGS);
	}
}

export function getLastRequestedLogs(): RequestLogEntry[] {
	return requestLogs.slice(0, MAX_REQUEST_LOGS);
}
