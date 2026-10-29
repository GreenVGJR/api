// Credits: JS port of signers/xdynosaur.py from https://github.com/DudeGeorgesTG/tiktok-web-signer (MIT).

import { ChaCha20, _grb, _kpv, _twc, _fwt } from "./web_gnarly.mjs";

const STD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const ALT_ALPHABET = "u09tbS3UvgDEe6r-ZVMXzLpsAohTn7mdINQlW412GqBjfYiyk8JORCF5/xKHwacP=";
const ENC_MAP = {};
const DEC_MAP = {};
for (let i = 0; i < STD_ALPHABET.length; i++) {
	ENC_MAP[STD_ALPHABET[i]] = ALT_ALPHABET[i];
	DEC_MAP[ALT_ALPHABET[i]] = STD_ALPHABET[i];
}

const FIXED_VALUE = [94, 222, 223, 224, 0, 1];

function _cvn(cipher, keyBytes) {
	const pos = _grb(keyBytes, cipher);
	return [...cipher.slice(0, pos), ...keyBytes, ...cipher.slice(pos)];
}

export function _wdp(packed) {
	const keyLen = 48;
	for (let pos = 0; pos <= packed.length - keyLen; pos++) {
		const test = packed.slice(pos, pos + keyLen);
		const cipher = [...packed.slice(0, pos), ...packed.slice(pos + keyLen)];
		if (_grb(test, cipher) === pos) return [test, cipher];
	}
	throw new Error("alignment fault");
}

function _gzt(data) {
	return Buffer.from(data)
		.toString("base64")
		.split("")
		.map((c) => ENC_MAP[c] ?? c)
		.join("");
}

export function _ykm(text) {
	const clean = text.split(/\s/).join("");
	const padded = clean.length % 4 ? clean + "=".repeat(4 - (clean.length % 4)) : clean;
	return [
		...Buffer.from(
			padded
				.split("")
				.map((c) => DEC_MAP[c] ?? c)
				.join(""),
			"base64",
		),
	];
}

function _bjx(signType, mode) {
	return ((signType & 0x03) << 6) | 0x08 | (mode & 0x07);
}

function _rhl(header) {
	return {
		sign_type: (header >> 6) & 0x03,
		has_flag_8: Boolean(header & 0x08),
		mode: header & 0x07,
	};
}

function _qpw(text) {
	let h = 2166136260;
	for (const b of Buffer.from(text, "utf8")) {
		const product = Math.imul(h ^ b, 16777619) >>> 0;
		h = (product + Math.imul(product, 32)) >>> 0;
	}
	return h;
}

function _fvs(value) {
	const v = value >>> 0;
	return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

function _txc(data, customMode = false) {
	const length = (data[data.length - 2] << 8) | data[data.length - 1];
	let result = "";
	for (let idx = 0; idx < length; idx++) {
		const target = data[idx];
		let found = false;
		for (let code = 32; code < 127; code++) {
			let out;
			if (customMode) {
				let val = ((code ^ (102 + idx)) + (idx & 0xaa)) ^ 0xa5;
				val = (val << 1) + ((val << 1) >> 8);
				out = (val & 0xff) ^ 0xbb;
			} else {
				let val = (code ^ (103 + idx)) + ((idx & 0xaa) + 1);
				val = (val << 2) + ((val << 2) >> 8);
				out = (((val & 0xff) ^ 0xbb) + 1) & 0xff;
			}
			if (out === target) {
				result += String.fromCharCode(code);
				found = true;
				break;
			}
		}
		if (!found) return Buffer.from(data).toString("hex");
	}
	return result;
}

function _wjb(text) {
	text = String(text);
	const out = new Array(Math.max(text.length, 4) + 2).fill(0);
	for (let idx = 0; idx < text.length; idx++) {
		const ch = text.charCodeAt(idx);
		let val = (ch ^ (103 + idx)) + ((idx & 0xaa) + 1);
		val = (val << 2) + ((val << 2) >> 8);
		out[idx] = (((val & 0xff) ^ 0xbb) + 1) & 0xff;
	}
	for (let idx = text.length; idx < 4; idx++) out[idx] = 0xdd + idx;
	out[out.length - 2] = (text.length >>> 8) & 0xff;
	out[out.length - 1] = text.length & 0xff;
	return out;
}

function _kmd(text) {
	text = String(text);
	const out = new Array(Math.max(text.length, 4) + 2).fill(0);
	for (let idx = 0; idx < text.length; idx++) {
		const ch = text.charCodeAt(idx);
		let val = ((ch ^ (102 + idx)) + (idx & 0xaa)) ^ 0xa5;
		val = (val << 1) + ((val << 1) >> 8);
		out[idx] = (val & 0xff) ^ 0xbb;
	}
	for (let idx = text.length; idx < 4; idx++) out[idx] = 0xdd + idx;
	out[out.length - 2] = (text.length >>> 8) & 0xff;
	out[out.length - 1] = text.length & 0xff;
	return out;
}

function _uzq(tag, value) {
	return [tag, ..._fwt(value.length), ...value];
}

function _dlv(records) {
	const buf = [];
	for (const rec of records) buf.push(..._uzq(rec.tag, rec.value));
	return buf;
}

const DYNO_FIELD_NAMES = {
	32: "checksum",
	33: "field_33",
	34: "field_34",
	35: "field_35",
	36: "field_14",
	37: "num_encrypt_requests",
	38: "envcode",
	39: "timestamp",
	40: "ex_proof_code",
	41: "field_41",
	42: "version",
	43: "body_hash",
	44: "canvas",
	45: "field_45",
	46: "query_hash",
	47: "num_total_requests",
	48: "user_agent_hash",
	49: "scm_version",
	50: "ex_scm_version",
	51: "ex_bundle_digest",
	52: "field_8",
	53: "field_53",
	54: "ubcode",
	55: "field_55",
	56: "ex_bundle_proof_hash",
};

export function _hgn(payload) {
	const result = {};
	let pos = 0;
	while (pos < payload.length) {
		if (pos + 3 > payload.length) throw new Error("unexpected EOF");
		const tag = payload[pos];
		const size = (payload[pos + 1] << 8) | payload[pos + 2];
		pos += 3;
		if (pos + size > payload.length) throw new Error("read past end of buffer");
		const value = payload.slice(pos, pos + size);
		pos += size;
		const name = DYNO_FIELD_NAMES[tag] ?? `field_${tag}`;
		if ([43, 46, 48, 56].includes(tag)) {
			result[name] = value.length === 4 ? (((value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3]) >>> 0).toString(16).padStart(8, "0") : Buffer.from(value).toString("hex");
		} else {
			result[name] = _txc(value, [32, 33, 34].includes(tag));
		}
	}
	return result;
}

function _srj(envcode, timestamp, field8) {
	const xorHalf = (timestamp >> 16) ^ (field8 >> 16) ^ (timestamp & 0xffff) ^ (field8 & 0xffff);
	return ((envcode << 16) | xorHalf) >>> 0;
}

function _ecp(qs, body, ua, ubcode, canvas, version, scmVer, ts, field8, totalReqs, encReqs, envcode, exProof, exScm, exDigest, exProofHash, field53) {
	const entries = [
		[32, [...FIXED_VALUE]],
		[33, [...FIXED_VALUE]],
		[34, [...FIXED_VALUE]],
		[35, _wjb("0")],
		[36, _wjb(_srj(envcode, ts, field8))],
		[37, _wjb(encReqs)],
		[38, _wjb(envcode)],
		[39, _wjb(ts)],
		[40, _wjb(exProof)],
		[41, _wjb("0")],
		[42, _wjb(version)],
		[43, _fvs(_qpw(body))],
		[44, _wjb(canvas)],
		[45, _wjb("0")],
		[46, _fvs(_qpw(qs))],
		[47, _wjb(totalReqs)],
		[48, _fvs(_qpw(ua))],
		[49, _wjb(scmVer)],
		[50, _wjb(exScm)],
		[51, _wjb(exDigest)],
		[52, _wjb(field8)],
		[53, _wjb(field53)],
		[54, _wjb(ubcode)],
		[55, _wjb("0")],
		[56, _fvs(exProofHash === null || exProofHash === undefined ? _qpw(body) : exProofHash)],
	];
	let checksum = 0;
	for (const [, val] of entries) checksum ^= val[1];
	entries[0] = [32, _kmd(checksum)];
	return _dlv(entries.map(([tag, value]) => ({ tag, value })));
}

export function pack(qs, body, ua, opts = {}) {
	const { ubcode = 0, canvas = 1245783967, version = "5.3.2", scm_version = "1.0.0.417", timestamp = Math.floor(Date.now() / 1000), field8 = _kpv(), total_reqs = 1, enc_reqs = 1, envcode = 1, ex_proof = 0, sign_type = 1, mode = 3, field_53 = "0" } = opts;
	let exScm;
	let exDigest;
	let exProofHash;
	if (version === "5.3.0") {
		exScm = "1.0.0.2695";
		exDigest = "1b98a897ac64bcef2414bf38b8549d4c";
		exProofHash = 0x0d4cbea1;
	} else if (["5.3.1", "5.3.2"].includes(version)) {
		exScm = "0";
		exDigest = "0";
		exProofHash = null;
	} else {
		throw new Error(`unknown descriptor: ${version}`);
	}
	const payload = _ecp(qs, body, ua, ubcode, canvas, version, scm_version, timestamp, field8, total_reqs, enc_reqs, envcode, ex_proof, exScm, exDigest, exProofHash, field_53);
	const [keyWords, keyBytes] = _twc();
	const encrypted = new ChaCha20(keyWords).encrypt(payload);
	const packed = [_bjx(sign_type, mode), ..._cvn(encrypted, keyBytes)];
	return _gzt(packed);
}

export function unpack(encrypted) {
	const raw = _ykm(encrypted);
	if (raw.length < 49) throw new Error("buffer underflow");
	const header = raw[0];
	const packed = raw.slice(1);
	const [keyBytes, cipher] = _wdp(packed);
	const keyWords = ChaCha20.keyBytesToWords(keyBytes);
	const chacha = new ChaCha20(keyWords);
	const payload = chacha.decrypt(cipher);
	return {
		prefix: `0x${header.toString(16).padStart(2, "0")}`,
		..._rhl(header),
		key_bytes: Buffer.from(keyBytes).toString("hex"),
		insert_pos: _grb(keyBytes, cipher),
		rounds: chacha.rounds,
		cipher: Buffer.from(cipher).toString("hex"),
		payload: Buffer.from(payload).toString("hex"),
		record: _hgn(payload),
	};
}

export function encrypt(qs = "", body = "", ua = "", opts = {}) {
	return pack(qs, body, ua, opts);
}

export function x_dynosaur_decrypt(encrypted) {
	return unpack(encrypted);
}
