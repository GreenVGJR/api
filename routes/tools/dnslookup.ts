import * as net from "node:net";
import * as tls from "node:tls";
import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";

const app = new Hono();

function extractHost(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) {
		try {
			return new URL(trimmed).hostname;
		} catch {
			return null;
		}
	}
	return trimmed
		.replace(/^[a-z]+:\/\//i, "")
		.split("/")[0]
		.split(":")[0];
}

function normalize(name: string, base: string): string | null {
	let n = name.trim().toLowerCase().replace(/^\*\./, "");
	if (!n || !n.endsWith(base) || n === base) return null;
	return n;
}

async function fromCrtSh(domain: string, base: string): Promise<string[]> {
	try {
		const url = `https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`;
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 8000);
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
			signal: ctrl.signal,
		});
		clearTimeout(t);
		if (!res.ok) return [];
		const data = (await res.json()) as Array<{ name_value?: string }>;
		const found = new Set<string>();
		for (const e of data) {
			if (!e.name_value) continue;
			for (const part of e.name_value.split(/[\n,]/)) {
				const n = normalize(part, base);
				if (n) found.add(n);
			}
		}
		return Array.from(found);
	} catch {
		return [];
	}
}

async function fromHackertarget(domain: string, base: string): Promise<string[]> {
	try {
		const url = `https://api.hackertarget.com/hostsearch/?q=${domain}`;
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 8000);
		const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
		clearTimeout(t);
		if (!res.ok) return [];
		const text = await res.text();
		const found = new Set<string>();
		for (const line of text.split(/\n/)) {
			const n = normalize(line.split(",")[0], base);
			if (n) found.add(n);
		}
		return Array.from(found);
	} catch {
		return [];
	}
}

function fromTlsCert(domain: string, base: string): Promise<string[]> {
	return new Promise<string[]>((resolve) => {
		const out = new Set<string>();
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			try {
				sock.destroy();
			} catch {}
			resolve(Array.from(out));
		};
		const sock = tls.connect({ host: domain, port: 443, servername: domain, timeout: 5000 }, () => {
			try {
				const cert = sock.getPeerCertificate(true);
				const san = (cert && cert.subjectaltname) || "";
				for (const part of san.split(",")) {
					const m = part.trim().match(/^DNS:(.+)$/i);
					if (m) {
						const n = normalize(m[1], base);
						if (n) out.add(n);
					}
				}
			} catch {}
			finish();
		});
		sock.setTimeout(5000, finish);
		sock.on("error", finish);
		sock.on("timeout", finish);
	});
}

async function enumerateSubdomains(domain: string): Promise<string[]> {
	const base = domain.toLowerCase();
	const [a, b, c] = await Promise.all([fromCrtSh(domain, base), fromHackertarget(domain, base), fromTlsCert(domain, base)]);
	return Array.from(new Set([...a, ...b, ...c])).sort();
}

// ── Full DNS record retrieval via DNS-over-HTTPS (returns TTL per record) ────
const DNS_TYPES: [string, number][] = [
	["A", 1],
	["AAAA", 28],
	["CNAME", 5],
	["NS", 2],
	["SOA", 6],
	["MX", 15],
	["TXT", 16],
	["PTR", 12],
	["SRV", 33],
	["NAPTR", 35],
	["CAA", 257],
	["DNSKEY", 48],
	["DS", 43],
	["SSHFP", 44],
	["TLSA", 52],
];

async function queryDoH(host: string, typeName: string): Promise<{ status: number; records: any[] }> {
	try {
		const url = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${typeName}`;
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 8000);
		const res = await fetch(url, { headers: { Accept: "application/dns-json" }, signal: ctrl.signal });
		clearTimeout(t);
		if (!res.ok) return { status: -1, records: [] };
		const json = (await res.json()) as any;
		const answers = json.Answer || [];
		const typeNum = DNS_TYPES.find(([n]) => n === typeName)?.[1];
		const records = answers.filter((a: any) => a.type === typeNum).map((a: any) => ({ ttl: a.TTL, data: a.data }));
		return { status: json.Status ?? 0, records };
	} catch {
		return { status: -1, records: [] };
	}
}

// ── Reverse DNS: IP -> in-addr.arpa / ip6.arpa for PTR lookup ───────────────
function ipToArpa(ip: string): string | null {
	if (net.isIP(ip) === 4) {
		return ip.split(".").reverse().join(".") + ".in-addr.arpa";
	}
	if (net.isIP(ip) === 6) {
		const full = expandIPv6(ip);
		if (!full) return null;
		const nibbles = full.toLowerCase().split("").reverse().join(".");
		return nibbles + ".ip6.arpa";
	}
	return null;
}

function expandIPv6(addr: string): string | null {
	const [head, tail] = addr.split("::");
	const headParts = head ? head.split(":") : [];
	const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
	const missing = 8 - (headParts.length + tailParts.length);
	if (missing < 0) return null;
	const parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
	return parts.map((p) => p.padStart(4, "0")).join("");
}

async function dnsLookup(input: string): Promise<any> {
	const host = extractHost(input);
	if (!host) return { error: "Invalid domain" };

	const ipVer = net.isIP(host);
	if (ipVer) {
		const arpa = ipToArpa(host);
		if (!arpa) return { error: "Invalid IP address" };
		const ptr = await queryDoH(arpa, "PTR");
		return {
			domain: host,
			queryType: "reverse",
			data: {
				records: { PTR: ptr.records },
				subdomains: [],
			},
		};
	}

	if (!/^[a-z0-9.-]+$/i.test(host) || host.length > 253) return { error: "Invalid domain" };

	const results = await Promise.all(DNS_TYPES.map(([name]) => queryDoH(host, name)));

	if (results.every((r) => r.status === 3)) return { error: "Domain does not exist (NXDOMAIN)" };

	const records: any = {};
	DNS_TYPES.forEach(([name], i) => {
		records[name] = results[i].records;
	});
	records.SOA = records.SOA.length ? records.SOA[0] : null;

	// Reverse lookup for every resolved address (A / AAAA).
	const addrs: string[] = [...records.A.map((r: any) => r.data), ...records.AAAA.map((r: any) => r.data)];
	const reverse = await Promise.all(
		addrs.map(async (ip) => {
			const arpa = ipToArpa(ip);
			let addr = "";
			if (arpa) {
				const pr = await queryDoH(arpa, "PTR");
				addr = pr.records.map((r: any) => String(r.data).replace(/\.$/, "")).join(", ");
			}
			return { ip, addr };
		}),
	);

	return {
		domain: host,
		queryType: "forward",
		data: {
			records,
			reverse,
			subdomains: await enumerateSubdomains(host),
		},
	};
}

app.get("/dnslookup", async (c) => {
	const url = c.req.query("url");
	if (url === undefined) return c.json({ error: "Missing parameter required" }, 202);
	if (url === "") return c.json({ error: "Nothing to do" }, 202);

	c.header("X-Route", "dns.google, crt.sh, api.hackertarget.com");
	return await dispatch(c, () => dnsLookup(url));
});

export default app;
