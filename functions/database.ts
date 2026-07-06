import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const dbPath = path.join(process.cwd(), "database", "database.sqlite");

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
const DB_KEY = process.env.DB_KEY;

function checkKey(): boolean {
	return !!DB_KEY && DB_KEY.length > 0;
}

function encrypt(text: string): string {
	try {
		const key = crypto
			.createHash("sha256")
			.update(DB_KEY as string)
			.digest();
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
		const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
		const tag = cipher.getAuthTag();
		return Buffer.concat([iv, encrypted, tag]).toString("base64url");
	} catch {
		return text;
	}
}

function decrypt(payload: string): string {
	try {
		const data = Buffer.from(payload, "base64url");
		if (data.length < 28) return payload;
		const key = crypto
			.createHash("sha256")
			.update(DB_KEY as string)
			.digest();
		const iv = data.subarray(0, 12);
		const tag = data.subarray(data.length - 16);
		const encrypted = data.subarray(12, data.length - 16);
		const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
	} catch {
		return payload;
	}
}

db.run(`
    CREATE TABLE IF NOT EXISTS apidataobjects (
        name TEXT,
        value TEXT,
        hash TEXT,
        PRIMARY KEY (name, hash)
    )
`);

export default {
	get(name: string, hash: string) {
		if (!checkKey()) return { error: "Database key (DB_KEY) is not set in environment" };
		const stmt = db.prepare("SELECT value FROM apidataobjects WHERE name = ? AND hash = ?");
		const result = stmt.get(name, hash) as { value: string } | null;
		if (result) {
			result.value = decrypt(result.value);
		}
		return result;
	},
	getAll(query: string = "", hash?: string) {
		if (!checkKey()) return { error: "Database key (DB_KEY) is not set in environment" };
		if (!hash) return { error: "Missing hash parameter for access separation" };

		let results: { name: string; value: string; hash: string }[] = [];
		if (!query) {
			const stmt = db.prepare("SELECT name, value, hash FROM apidataobjects WHERE hash = ?");
			results = stmt.all(hash) as {
				name: string;
				value: string;
				hash: string;
			}[];
		} else {
			const stmt = db.prepare("SELECT name, value, hash FROM apidataobjects WHERE name LIKE ? AND hash = ?");
			results = stmt.all(`%${query}%`, hash) as {
				name: string;
				value: string;
				hash: string;
			}[];
		}

		return results.map((r) => ({ ...r, value: decrypt(r.value) }));
	},
	set(name: string, value: string, existingHash?: string) {
		if (!checkKey()) return { error: "Database key (DB_KEY) is not set in environment" };
		if (name.length > 1024) {
			return { error: "Name exceeds limit of 1024 characters" };
		}
		if (value.length > 65536) {
			return { error: "Value exceeds limit of 64k characters" };
		}

		const encryptedValue = encrypt(value);
		if (existingHash) {
			const updateStmt = db.prepare("UPDATE apidataobjects SET value = ? WHERE name = ? AND hash = ?");
			const info = updateStmt.run(encryptedValue, name, existingHash);

			if (info.changes > 0) {
				return { success: true, type: "update", hash: existingHash };
			}

			const checkHashStmt = db.prepare("SELECT 1 FROM apidataobjects WHERE hash = ? LIMIT 1");
			const hashExists = checkHashStmt.get(existingHash);

			if (hashExists) {
				const insertStmt = db.prepare("INSERT INTO apidataobjects (name, value, hash) VALUES (?, ?, ?)");
				insertStmt.run(name, encryptedValue, existingHash);
				return { success: true, type: "new", hash: existingHash };
			} else {
				return { error: "Invalid hash or record not found" };
			}
		} else {
			const hash = crypto.randomBytes(8).toString("hex");
			const stmt = db.prepare("INSERT INTO apidataobjects (name, value, hash) VALUES (?, ?, ?)");
			stmt.run(name, encryptedValue, hash);
			return { success: true, type: "new", hash: hash };
		}
	},
	delete(name: string, hash: string) {
		if (!checkKey()) return { error: "Database key (DB_KEY) is not set in environment" };
		const stmt = db.prepare("DELETE FROM apidataobjects WHERE name = ? AND hash = ?");
		const info = stmt.run(name, hash);
		return { success: info.changes > 0 };
	},
};
