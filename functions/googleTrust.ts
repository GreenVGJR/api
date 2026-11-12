import { browserRequest } from "./browserRequest.js";

const trust: Record<string, string> = {};

let refreshInflight: Promise<boolean> | null = null;

export const googleTrustJar = (): string =>
	Object.entries(trust)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");

export const googleTrustHas = (name: string): boolean => !!trust[name];

export const mergeGoogleTrust = (res: Response): void => {
	try {
		const raw: string[] = typeof (res.headers as any).getSetCookie === "function" ? (res.headers as any).getSetCookie() : [];
		for (const cookie of raw) {
			const m = /^([^=]+)=([^;]*)/.exec(cookie);
			if (m && m[1]) {
				trust[m[1].trim()] = m[2];
			}
		}
	} catch {}
};

export const mergeGoogleTrustCookies = (cookies: Record<string, string> | undefined): void => {
	if (!cookies) return;
	for (const [k, v] of Object.entries(cookies)) {
		if (k && v) trust[k] = v;
	}
};

export const googleTrustIsFresh = (): boolean => !!trust.NID;

const solveTrust = async (url: string, label: string): Promise<boolean> => {
	if (refreshInflight) return refreshInflight;

	refreshInflight = (async () => {
		try {
			const res = await browserRequest({
				url,
				fetcherType: "stealthy",
				googleSolve: true,
				extractHtml: false,
				timeoutMs: 45000,
			});
			mergeGoogleTrustCookies(res?.cookies);
			if (res?.cookies?.NID) {
				return true;
			}
			if (res && !res.success) console.warn(`${label}: browser fetch failed: ${String(res.error ?? "unknown").slice(0, 160)}`);
			return !!trust.NID;
		} catch (e) {
			console.warn(`${label}: bridge threw:`, String(e).slice(0, 160));
			return !!trust.NID;
		} finally {
			refreshInflight = null;
		}
	})();

	return refreshInflight;
};

export const refreshGoogleTrust = async (url?: string): Promise<boolean> => solveTrust(url || "https://www.google.com/search?udm=50", "refreshGoogleTrust");

// Startup warmup: solve once so the first user search goes straight to the
// cloak path. The homepage sets NID but the cloak fingerprint still gets
// challenged, so this must warm with a search URL.
export const warmGoogleTrust = async (): Promise<boolean> => {
	if (googleTrustIsFresh()) return true;
	return refreshGoogleTrust();
};
