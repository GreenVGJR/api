"""Persistent bridge for Google Lens image translation via chrome-lens-py.

Uses Google's Lens OCR/translation API directly: reads the text in the image,
translates it, and renders the translated text back onto the image. No browser,
no bgr token, no user session required.

Protocol: JSON lines on stdin/stdout, keyed by `request_id`.
"""

import asyncio
import base64
import json
import sys
import traceback

from chrome_lens_py import LensAPI


def log(message):
	print(f"[translateImage] {message}", file=sys.stderr, flush=True)


def emit(payload):
	sys.stdout.write(json.dumps(payload) + "\n")
	sys.stdout.flush()


async def translate(image_bytes, source, target):
	async with LensAPI() as api:
		return await api.process_image(
			image_bytes,
			ocr_language=source if source and source != "auto" else None,
			source_translation_language=source if source and source != "auto" else None,
			target_translation_language=target or "en",
			return_overlay=True,
		)


def json_safe(value):
	"""Recursively make the raw Lens result JSON-serializable (bytes -> base64)."""
	if isinstance(value, (bytes, bytearray)):
		return base64.b64encode(value).decode()
	if isinstance(value, dict):
		return {key: json_safe(item) for key, item in value.items()}
	if isinstance(value, (list, tuple)):
		return [json_safe(item) for item in value]
	return value


def handle_request(request):
	image_b64 = request.get("image_b64") or ""
	if not image_b64:
		return {"ok": False, "error": "missing image"}

	try:
		image_bytes = base64.b64decode(image_b64)
	except Exception as exc:
		return {"ok": False, "error": f"invalid image: {str(exc)[:120]}"}

	source = (request.get("from") or "auto").lower()
	target = (request.get("to") or "en").lower()

	try:
		result = asyncio.run(translate(image_bytes, source, target))
	except Exception as exc:
		return {"ok": False, "error": f"translation failed: {str(exc)[:300]}"}

	# Return the raw Lens result verbatim (all binary fields base64-encoded).
	return {"ok": True, **json_safe(result)}


def main():
	log("bridge started (Lens OCR)")
	for raw in sys.stdin:
		line = raw.strip()
		if not line:
			continue
		request_id = None
		try:
			request = json.loads(line)
			request_id = request.get("request_id")
			if request.get("action") == "warmup":
				emit({"request_id": request_id, "success": True})
				continue
			if request.get("action") == "shutdown":
				emit({"request_id": request_id, "success": True})
				break
			emit({"request_id": request_id, **handle_request(request)})
		except Exception as exc:  # noqa: BLE001 - always answer the caller
			log(traceback.format_exc())
			emit({"request_id": request_id, "ok": False, "error": str(exc)[:300]})


if __name__ == "__main__":
	main()
