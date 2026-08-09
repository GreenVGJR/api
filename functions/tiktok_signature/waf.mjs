// Credits:
// https://github.com/5k-omar/Tiktok-Pow-Solver
// Solves the Slardar WAF proof-of-work challenge served by TikTok

import { createHash } from "node:crypto";

function b64d(val) {
	const missing = val.length % 4;
	if (missing) val += "=".repeat(4 - missing);
	return Buffer.from(val, "base64");
}

export async function solveTiktokWAF(html) {
	const wciMatch = html.match(/id="wci"\s+class="([^"]+)"/);
	const csMatch = html.match(/id="cs"\s+class="([^"]+)"/);
	if (!wciMatch || !csMatch) return null;

	try {
		const obj = JSON.parse(b64d(csMatch[1]).toString("utf8"));
		const prefix = b64d(obj.v.a);
		const target = b64d(obj.v.c).toString("hex");

		let answer = null;
		for (let i = 0; i <= 1000000; i++) {
			const hash = createHash("sha256").update(prefix).update(String(i)).digest("hex");
			if (hash === target) {
				answer = i;
				break;
			}
		}
		if (answer === null) return null;

		obj.d = Buffer.from(String(answer)).toString("base64");

		let cookie = `${wciMatch[1]}=${Buffer.from(JSON.stringify(obj)).toString("base64")}; `;

		const rciMatch = html.match(/id="rci"\s+class="([^"]+)"/);
		const rsMatch = html.match(/id="rs"\s+class="([^"]+)"/);
		if (rciMatch?.[1] && rsMatch?.[1]) cookie += `${rciMatch[1]}=${rsMatch[1]}; `;

		const rsIdMatch = html.match(/id="rs_id"\s+class="([^"]+)"/);
		if (rsIdMatch?.[1]) cookie += `waforigin_id=${rsIdMatch[1]}; `;

		return cookie;
	} catch {
		return null;
	}
}
