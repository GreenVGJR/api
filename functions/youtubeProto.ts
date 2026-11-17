/**
 * Minimal YouTube visitor-data protobuf codec.
 *
 * Replaces the `ProtoUtils` import from youtubei.js, which cost ~3.3s at
 * startup for two small functions. Schema (verified byte-exact against
 * youtubei.js):
 *   field 1 (tag 10): id        - string
 *   field 5 (tag 40): timestamp - int32
 */

const encodeVarint = (value: number): number[] => {
	const out: number[] = [];
	let n = value >>> 0;
	while (n > 0) {
		let byte = n & 0x7f;
		n >>>= 7;
		if (n) byte |= 0x80;
		out.push(byte);
	}
	return out;
};

const decodeVarint = (buf: Uint8Array, cursor: { i: number }): number => {
	let result = 0;
	let shift = 0;
	while (cursor.i < buf.length) {
		const byte = buf[cursor.i++] as number;
		result += (byte & 0x7f) * 2 ** shift;
		if ((byte & 0x80) === 0) break;
		shift += 7;
	}
	return result;
};

export interface VisitorData {
	id: string;
	timestamp: number;
}

export function encodeVisitorData(id: string, timestamp: number): string {
	const idBytes = Buffer.from(id, "utf8");
	const parts: number[] = [];
	if (id !== "") parts.push(10, idBytes.length, ...idBytes);
	if (timestamp !== 0) parts.push(40, ...encodeVarint(timestamp));
	return encodeURIComponent(Buffer.from(parts).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"));
}

export function decodeVisitorData(visitorData: string): VisitorData {
	const raw = Buffer.from(decodeURIComponent(visitorData).replace(/-/g, "+").replace(/_/g, "/"), "base64");
	const cursor = { i: 0 };
	const result: VisitorData = { id: "", timestamp: 0 };
	while (cursor.i < raw.length) {
		const tag = decodeVarint(raw, cursor);
		const field = tag >>> 3;
		if (field === 1) {
			const length = decodeVarint(raw, cursor);
			result.id = raw.subarray(cursor.i, cursor.i + length).toString("utf8");
			cursor.i += length;
		} else if (field === 5) {
			result.timestamp = decodeVarint(raw, cursor) | 0;
		} else {
			break;
		}
	}
	return result;
}
