import crypto from "crypto";
import { removeSessionJobTime } from "../config.json";

export interface AsyncJobSession {
	processId: string;
	guildId: string;
	status: "awaiting" | "done";
	total: number;
	success: number;
	failed: number;
	data: {
		status: "awaiting" | "done";
		process_id?: string;
		success?: string[];
		fail?: string[];
	};
}

const globalStore = globalThis as any;

/** Active jobs indexed by guildId */
export const activeGuildJobs: Map<string, AsyncJobSession> = globalStore.__vgjr_activeGuildJobs || (globalStore.__vgjr_activeGuildJobs = new Map<string, AsyncJobSession>());

/** Completed or in-progress jobs indexed by processId */
export const jobsByProcessId: Map<string, AsyncJobSession> = globalStore.__vgjr_jobsByProcessId || (globalStore.__vgjr_jobsByProcessId = new Map<string, AsyncJobSession>());

export function generateProcessId(): string {
	return crypto.randomUUID();
}

export function scheduleJobCleanup(processId: string, ttlMs = removeSessionJobTime) {
	setTimeout(() => {
		const job = jobsByProcessId.get(processId);
		if (job) {
			if (activeGuildJobs.get(job.guildId)?.processId === processId) {
				activeGuildJobs.delete(job.guildId);
			}
			jobsByProcessId.delete(processId);
		}
	}, ttlMs);
}
