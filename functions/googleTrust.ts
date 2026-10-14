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

export const refreshGoogleTrust = async (): Promise<boolean> => {
	if (refreshInflight) return refreshInflight;

	refreshInflight = (async () => {
		try {
			const res = await browserRequest({
				url: "https://www.google.com/search?udm=50",
				fetcherType: "stealthy",
				extractHtml: false,
				timeoutMs: 120000,
			});
			mergeGoogleTrustCookies(res?.cookies);
			if (res?.cookies?.NID) {
				return true;
			}
			if (res && !res.success) console.warn(`refreshGoogleTrust: browser fetch failed: ${String(res.error ?? "unknown").slice(0, 160)}`);
			return !!trust.NID;
		} catch (e) {
			console.warn("refreshGoogleTrust: bridge threw:", String(e).slice(0, 160));
			return !!trust.NID;
		} finally {
			refreshInflight = null;
		}
	})();

	return refreshInflight;
};
