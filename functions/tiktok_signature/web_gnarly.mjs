// Credits: JS port of signers/xgnarly.py from https://github.com/DudeGeorgesTG/tiktok-web-signer (MIT).
// Algorithm notes: https://github.com/justscrapeme/tiktok-web-reverse-engineering (MIT).

import crypto from "crypto";

const STD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const ALT_ALPHABET = "u09tbS3UvgDEe6r-ZVMXzLpsAohTn7mdINQlW412GqBjfYiyk8JORCF5/xKHwacP=";
const ENC_MAP = {};
const DEC_MAP = {};
for (let i = 0; i < STD_ALPHABET.length; i++) {
	ENC_MAP[STD_ALPHABET[i]] = ALT_ALPHABET[i];
	DEC_MAP[ALT_ALPHABET[i]] = STD_ALPHABET[i];
}

export function rotl32(x, n) {
	return ((x << n) | (x >>> (32 - n))) >>> 0;
}

export class ChaCha20 {
	static CONST = [1196819126, 600974999, 3863347763, 1451689750];
	constructor(keyWords) {
		if (keyWords.length !== 12) throw new Error("buffer underflow");
		this.keyWords = [...keyWords];
		this.rounds = ChaCha20.calcRounds(keyWords);
		this.state = [...ChaCha20.CONST, ...this.keyWords];
	}
	static calcRounds(keyWords) {
		let acc = 0;
		for (const w of keyWords) acc += w & 0xf;
		return (acc & 0xf) + 5;
	}
	static quarter(s, a, b, c, d) {
		s[a] = (s[a] + s[b]) >>> 0;
		s[d] = rotl32(s[d] ^ s[a], 16);
		s[c] = (s[c] + s[d]) >>> 0;
		s[b] = rotl32(s[b] ^ s[c], 12);
		s[a] = (s[a] + s[b]) >>> 0;
		s[d] = rotl32(s[d] ^ s[a], 8);
		s[c] = (s[c] + s[d]) >>> 0;
		s[b] = rotl32(s[b] ^ s[c], 7);
	}
	static block(state, rounds) {
		const w = [...state];
		let r = 0;
		while (r < rounds) {
			ChaCha20.quarter(w, 0, 4, 8, 12);
			ChaCha20.quarter(w, 1, 5, 9, 13);
			ChaCha20.quarter(w, 2, 6, 10, 14);
			ChaCha20.quarter(w, 3, 7, 11, 15);
			r += 1;
			if (r >= rounds) break;
			ChaCha20.quarter(w, 0, 5, 10, 15);
			ChaCha20.quarter(w, 1, 6, 11, 12);
			ChaCha20.quarter(w, 2, 7, 12, 13);
			ChaCha20.quarter(w, 3, 4, 13, 14);
			r += 1;
		}
		for (let i = 0; i < 16; i++) w[i] = (w[i] + state[i]) >>> 0;
		return w;
	}
	encrypt(data) {
		const buf = [...data];
		ChaCha20.cryptInplace(this.state, this.rounds, buf);
		return buf;
	}
	decrypt(data) {
		return this.encrypt(data);
	}
	static cryptInplace(state16, rounds, data) {
		const nFull = Math.floor(data.length / 4);
		const leftover = data.length % 4;
		const words = new Array(Math.floor((data.length + 3) / 4)).fill(0);
		for (let i = 0; i < nFull; i++) {
			const j = 4 * i;
			words[i] = (data[j] | (data[j + 1] << 8) | (data[j + 2] << 16) | (data[j + 3] << 24)) >>> 0;
		}
		if (leftover) {
			for (let c = 0; c < leftover; c++) words[nFull] = (words[nFull] | (data[4 * nFull + c] << (8 * c))) >>> 0;
		}
		const state = [...state16];
		let off = 0;
		while (off + 16 < words.length) {
			const stream = ChaCha20.block(state, rounds);
			state[12] = (state[12] + 1) >>> 0;
			for (let k = 0; k < 16; k++) words[off + k] = (words[off + k] ^ stream[k]) >>> 0;
			off += 16;
		}
		const stream = ChaCha20.block(state, rounds);
		for (let k = 0; k < words.length - off; k++) words[off + k] = (words[off + k] ^ stream[k]) >>> 0;
		for (let i = 0; i < nFull; i++) {
			const j = 4 * i;
			const w = words[i];
			data[j] = w & 0xff;
			data[j + 1] = (w >>> 8) & 0xff;
			data[j + 2] = (w >>> 16) & 0xff;
			data[j + 3] = (w >>> 24) & 0xff;
		}
		if (leftover) {
			const w = words[nFull];
			for (let c = 0; c < leftover; c++) data[4 * nFull + c] = (w >>> (8 * c)) & 0xff;
		}
	}
	static keyBytesToWords(keyBytes) {
		const out = [];
		for (let i = 0; i < 12; i++) out.push((keyBytes[i * 4] | (keyBytes[i * 4 + 1] << 8) | (keyBytes[i * 4 + 2] << 16) | (keyBytes[i * 4 + 3] << 24)) >>> 0);
		return out;
	}
}

let _vkx = null;
let _jmt = 0;

function _rwp() {
	const nowMs = Date.now() & 0xffffffff;
	_vkx = [2517678443, 2718276124, 3212677781, 2633865432, 217618912, 2931180889, 1498001188, 2157053261, 211147047, 185100057, 2903579748, 3732962506, nowMs >>> 0, Math.floor(Math.random() * 4294967296), Math.floor(Math.random() * 4294967296), Math.floor(Math.random() * 4294967296)];
	_jmt = 0;
}

function _bzq() {
	if (!_vkx) _rwp();
	const block = ChaCha20.block(_vkx, 8);
	const hi = block[_jmt];
	const lo = (block[_jmt + 8] & 0xfffffff0) >>> 11;
	if (_jmt === 7) {
		_vkx[12] = (_vkx[12] + 1) >>> 0;
		_jmt = 0;
	} else {
		_jmt += 1;
	}
	return (hi + 4294967296 * lo) / 2 ** 53;
}

function _nfl() {
	return Math.floor(_bzq() * 4294967296);
}

function _dxh(values) {
	for (let idx = values.length - 1; idx > 0; idx--) {
		const swapIdx = Math.floor(_bzq() * (idx + 1));
		[values[idx], values[swapIdx]] = [values[swapIdx], values[idx]];
	}
}

export function _twc() {
	const keyWords = [];
	const keyBytes = [];
	for (let i = 0; i < 12; i++) {
		const word = _nfl();
		keyWords.push(word);
		keyBytes.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
	}
	return [keyWords, keyBytes];
}

export function _kpv() {
	return Math.floor((Date.now() * 1000) % 4294967296);
}

export function _grb(keyBytes, ciphertext) {
	const cipher = typeof ciphertext === "string" ? [...ciphertext].map((c) => c.charCodeAt(0)) : ciphertext;
	let pos = 0;
	for (const b of keyBytes) pos = (pos + b) % (cipher.length + 1);
	for (const b of cipher) pos = (pos + b) % (cipher.length + 1);
	return pos;
}

export function _fwt(val) {
	if (val < 0xfe01) return [(val >>> 8) & 0xff, val & 0xff];
	return [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
}

function _encTable(s) {
	return s
		.split("")
		.map((c) => ENC_MAP[c] ?? c)
		.join("");
}

function _decTable(s) {
	return s
		.split("")
		.map((c) => DEC_MAP[c] ?? c)
		.join("");
}

export function _qxl(s) {
	return _encTable(Buffer.from(s, "latin1").toString("base64"));
}

export function _hcr(s) {
	return Buffer.from(_decTable(s), "base64").toString("latin1");
}

function _smz(enc, keyBytes) {
	const encBytes = [...enc].map((c) => c.charCodeAt(0));
	const insertPos = _grb(keyBytes, encBytes);
	return "K" + enc.slice(0, insertPos) + Buffer.from(keyBytes).toString("latin1") + enc.slice(insertPos);
}

function _yjn(raw) {
	const keyLen = 48;
	const encLen = raw.length - keyLen;
	for (let pos = 0; pos <= encLen; pos++) {
		const candidate = raw.slice(pos, pos + keyLen);
		const enc = raw.slice(0, pos) + raw.slice(pos + keyLen);
		if (
			_grb(
				[...candidate].map((c) => c.charCodeAt(0)),
				[...enc].map((c) => c.charCodeAt(0)),
			) === pos
		) {
			return [Buffer.from(candidate, "latin1"), enc];
		}
	}
	throw new Error("alignment fault");
}

function _md5(s) {
	return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

function _strHeadU32(s) {
	const b = Buffer.from(s, "utf8");
	let v = 0;
	for (let i = 0; i < Math.min(4, b.length); i++) v = v * 256 + b[i];
	return v >>> 0;
}

function _znd(obj, count) {
	let result = 0;
	for (let i = 1; i <= count; i++) {
		const v = obj[i];
		result ^= typeof v === "number" ? v : _strHeadU32(v);
	}
	return result >>> 0;
}

function _uvg(obj, count) {
	let result = 0;
	for (let i = 1; i <= count; i++) {
		const v = obj[i];
		if (typeof v === "number") result ^= v;
	}
	return result >>> 0;
}

function _ptk(envcode, timestamp, field8) {
	const xorHalf = (timestamp >> 16) ^ (field8 >> 16) ^ (timestamp & 0xffff) ^ (field8 & 0xffff);
	return ((envcode << 16) | xorHalf) >>> 0;
}

function _mbs(timestamp, canvas, field8) {
	const low = (timestamp & 0xffff) ^ (field8 & 0xffff);
	const high = (canvas & 0xffff) ^ (field8 >> 16);
	return ((high << 16) | low) >>> 0;
}

function _ejw(qs, body, ua, envcode, ubcode, ts, canvas, f8, version, scmVer, totalReqs, encReqs) {
	const obj = {
		1: envcode,
		2: ubcode,
		3: _md5(qs),
		4: _md5(body),
		5: _md5(ua),
		6: ts,
		7: canvas,
		8: f8,
		9: version,
	};
	let count = 9;
	if (["5.1.1", "5.1.2", "5.1.3", "5.2.0", "5.2.1", "5.3.0", "5.3.1", "5.3.2"].includes(version)) {
		obj[10] = scmVer;
		obj[11] = 1;
		count = 11;
	}
	if (["5.1.3", "5.2.0", "5.2.1", "5.3.0", "5.3.1", "5.3.2"].includes(version)) {
		obj[12] = totalReqs;
		obj[13] = encReqs;
		obj[14] = _ptk(envcode, ts, f8);
		count = 14;
	}
	if (["5.2.1", "5.3.0", "5.3.1", "5.3.2"].includes(version)) {
		obj[15] = _mbs(ts, canvas, f8);
		count = 15;
	}
	obj[count + 1] = _znd(obj, count);
	obj[0] = _uvg(obj, count + 1);
	let keyOrder;
	if (["5.1.0", "5.2.0", "5.2.1", "5.3.0"].includes(version)) {
		keyOrder = Array.from({ length: count + 1 }, (_, i) => i);
		_dxh(keyOrder);
	} else {
		keyOrder = [0, 12, 15, 13, 4, 8, 11, 7, 5, 3, 10, 14, 6, 9, 1, 2].filter((idx) => idx in obj);
	}
	return [obj, keyOrder];
}

function _lrq(obj, keyOrder) {
	const fieldCount = Object.keys(obj).length;
	const buf = [fieldCount];
	for (const idx of keyOrder) {
		buf.push(idx);
		const v = obj[idx];
		const valBytes = typeof v === "number" ? _fwt(v) : [...Buffer.from(v, "utf8")];
		buf.push(..._fwt(valBytes.length));
		buf.push(...valBytes);
	}
	return buf;
}

const GNARLY_FIELD_NAMES = {
	0: "verify",
	1: "envcode",
	2: "ubcode",
	3: "query_string_md5",
	4: "body_md5",
	5: "user_agent_md5",
	6: "timestamp",
	7: "canvas",
	8: "field_8",
	9: "version",
	10: "scm_version",
	11: "fixed_11",
	12: "num_total_requests",
	13: "num_encrypt_requests",
	14: "field_14",
	15: "field_15",
};
const GNARLY_INT_FIELDS = new Set([0, 1, 2, 6, 7, 8, 11, 12, 13, 14, 15]);

function _oxf(data) {
	const numFields = data[0];
	let pos = 1;
	const rawFields = new Map();
	for (let i = 0; i < numFields; i++) {
		if (pos >= data.length) break;
		const fieldIdx = data[pos];
		pos += 1;
		if (pos + 2 > data.length) break;
		let valLen = (data[pos] << 8) | data[pos + 1];
		pos += 2;
		if (valLen >= 0xfe01) {
			pos -= 2;
			if (pos + 4 > data.length) break;
			valLen = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
			pos += 4;
		}
		if (pos + valLen > data.length) break;
		rawFields.set(fieldIdx, data.slice(pos, pos + valLen));
		pos += valLen;
	}
	let checkAllIdx = null;
	for (const idx of rawFields.keys()) {
		if (idx > 0 && (checkAllIdx === null || idx > checkAllIdx)) checkAllIdx = idx;
	}
	const result = {};
	for (const [fieldIdx, raw] of rawFields) {
		const fieldName = fieldIdx === checkAllIdx ? "check_all" : (GNARLY_FIELD_NAMES[fieldIdx] ?? `field_${fieldIdx}`);
		if (GNARLY_INT_FIELDS.has(fieldIdx) || fieldIdx === checkAllIdx) {
			let value = 0;
			for (const b of raw) value = value * 256 + b;
			result[fieldName] = value;
		} else {
			result[fieldName] = Buffer.from(raw).toString("utf8");
		}
	}
	return result;
}

export function pack(qs, body, ua, opts = {}) {
	const { ubcode = 0, canvas = 1245783967, version = "5.3.2", scm_version = "1.0.0.417", timestamp = Math.floor(Date.now() / 1000), field8 = _kpv(), total_reqs = 1, enc_reqs = 1, envcode = 1 } = opts;
	const [obj, keyOrder] = _ejw(qs, body, ua, envcode, ubcode, timestamp, canvas, field8, version, scm_version, total_reqs, enc_reqs);
	const payload = _lrq(obj, keyOrder);
	const [keyWords, keyBytes] = _twc();
	const cipher = new ChaCha20(keyWords);
	const enc = Buffer.from(cipher.encrypt(payload)).toString("latin1");
	return _qxl(_smz(enc, keyBytes));
}

export function unpack(encrypted) {
	const raw = _hcr(encrypted);
	if (raw[0] !== "K") throw new Error("segment fault");
	const prefix = raw.charCodeAt(0);
	const body = raw.slice(1);
	const [keyBytes, enc] = _yjn(body);
	const cipher = [...Buffer.from(enc, "latin1")];
	const keyWords = ChaCha20.keyBytesToWords([...keyBytes]);
	const chacha = new ChaCha20(keyWords);
	const payload = chacha.decrypt(cipher);
	return {
		prefix: `0x${prefix.toString(16).padStart(2, "0")}`,
		sign_type: (prefix >> 6) & 0x03,
		has_flag_8: Boolean(prefix & 0x08),
		mode: prefix & 0x07,
		key_bytes: Buffer.from(keyBytes).toString("hex"),
		insert_pos: _grb([...keyBytes], cipher),
		rounds: chacha.rounds,
		cipher: Buffer.from(cipher).toString("hex"),
		payload: Buffer.from(payload).toString("hex"),
		record: _oxf(payload),
	};
}

export function encrypt(qs = "", body = "", ua = "", opts = {}) {
	return pack(qs, body, ua, opts);
}

export function x_gnarly_decrypt(encrypted) {
	return unpack(encrypted);
}
