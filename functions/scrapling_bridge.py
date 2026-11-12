import os
import sys
import json
from types import SimpleNamespace
from typing import Dict, Any


def _default_chromium_flags():
	"""Launch flags that keep Chromium from spinning on headless Linux VPS boxes.

	Ubuntu servers typically run as root (needs --no-sandbox), have a tiny
	/dev/shm (renderer crash loops without --disable-dev-shm-usage) and no GPU
	(GPU process spin without --disable-gpu). No-ops on other platforms.
	"""
	flags = []
	if sys.platform.startswith("linux"):
		flags += ["--disable-dev-shm-usage", "--disable-gpu", "--disable-software-rasterizer"]
		try:
			if os.geteuid() == 0:
				flags.append("--no-sandbox")
		except Exception:
			pass
	return flags


def _session_flags(input_data):
	extra = input_data.get("extra_flags") or []
	if not isinstance(extra, (list, tuple)):
		extra = []
	return list(dict.fromkeys(_default_chromium_flags() + list(extra)))


def _close_pooled_pages(session):
	"""Close the tabs the session parks after a successful fetch.

	Only the failure path closes a page; on success it goes back to the pool still
	loaded, so every solved site keeps a live renderer running in the background.
	Cookies and the fingerprint live on the context, so the browser stays warm.
	"""
	try:
		pool = getattr(session, "page_pool", None)
		if pool is None:
			return
		for info in pool.clear():
			try:
				info.page.close()
			except Exception:
				pass
	except Exception:
		pass


def _google_solve_fetch(session, url, headers, timeout, extract_html, image_search=False):
	"""Single-navigation Google solve.

	Web results ship complete in the first response, so `domcontentloaded` plus
	the raw body is enough. Image results use deferred thumbnails that only
	exist in the rendered DOM, so those wait for `load` and read page.content().
	Cookies are merged by the caller (last-write-wins), so nothing is cleared.
	"""
	if not session or not getattr(session, "context", None):
		raise RuntimeError("stealthy session not started")

	page = session.context.new_page()
	try:
		page.set_default_navigation_timeout(timeout)
		page.set_default_timeout(timeout)
		if headers:
			page.set_extra_http_headers(headers)

		wait_until = "load" if image_search else "domcontentloaded"
		resp = None
		status = 0
		# 429/403 are the only statuses worth an immediate retry; 200 carries the
		# full results and anything else is a hard answer we should not hammer.
		for _attempt in range(3):
			resp = page.goto(url, wait_until=wait_until, referer="https://www.google.com/")
			status = resp.status if resp is not None else 0
			if status == 200 or status not in (429, 403):
				break

		html = ""
		if extract_html:
			if image_search:
				html = page.content()
			else:
				try:
					body = resp.body() if resp is not None else b""
					html = body.decode("utf-8", errors="ignore") if body else ""
				except Exception:
					html = page.content()
		cookies = {}
		try:
			for cookie in session.context.cookies():
				if cookie.get("name"):
					cookies[cookie["name"]] = cookie.get("value", "")
		except Exception:
			pass

		# Shape matches scrapling's Response so the shared extraction below works.
		return SimpleNamespace(
			status=status,
			url=page.url,
			headers={},
			cookies=cookies,
			body=html.encode("utf-8") if html else b"",
			success=status == 200,
		)
	finally:
		try:
			page.close()
		except Exception:
			pass


def main():
    stealthy_session = None
    dynamic_session = None
    stealthy_flags = None
    dynamic_flags = None
    stealthy_headless = None
    dynamic_headless = None
    # Session-level fetch retries are fixed, never taken from the request.
    # Callers pass per-request `retries` meaning "cap the work", but scrapling
    # only accepts it at session creation - keying session identity on it made
    # every mixed-retries request kill and relaunch the whole Chromium (CPU
    # spike + ~500MB churn each time). Per-request bounds are timeoutMs plus
    # the callers' own attempt loops.
    SESSION_RETRIES = 1

    try:
        while True:
            # Read a single line from stdin
            line = sys.stdin.readline()
            if not line:
                break  # EOF, parent closed stdin

            line = line.strip()
            if not line:
                continue

            try:
                input_data = json.loads(line)
            except Exception as e:
                print(json.dumps({
                    "success": False,
                    "error": f"Failed to parse input JSON: {str(e)}"
                }))
                sys.stdout.flush()
                continue

            url = input_data.get("url")
            request_id = input_data.get("request_id")
            if not url:
                print(json.dumps({
                    "request_id": request_id,
                    "success": False,
                    "error": "URL parameter is required"
                }))
                sys.stdout.flush()
                continue

            fetcher_type = input_data.get("fetcher_type", "stealthy").lower()
            if input_data.get("warmup"):
                try:
                    _headless = input_data.get("headless", True)
                    _flags = _session_flags(input_data)
                    if fetcher_type == "dynamic":
                        if not dynamic_session:
                            from scrapling.fetchers import DynamicSession
                            dynamic_session = DynamicSession(headless=_headless, cookies=None, retries=SESSION_RETRIES, extra_flags=_flags)
                            dynamic_session.start()
                            dynamic_flags = _flags
                            dynamic_headless = _headless
                    else:
                        if not stealthy_session:
                            from scrapling.fetchers import StealthySession
                            stealthy_session = StealthySession(headless=_headless, cookies=None, retries=SESSION_RETRIES, extra_flags=_flags)
                            stealthy_session.start()
                            stealthy_flags = _flags
                            stealthy_headless = _headless
                    print(json.dumps({
                        "request_id": request_id,
                        "success": True,
                        "warmed": True
                    }))
                except Exception as e:
                    print(json.dumps({
                        "request_id": request_id,
                        "success": False,
                        "error": str(e)
                    }))
                sys.stdout.flush()
                continue
            method = input_data.get("method", "GET").upper()
            headers = input_data.get("headers")
            cookies = input_data.get("cookies")
            proxy = input_data.get("proxy")
            headless = input_data.get("headless", True)
            network_idle = input_data.get("network_idle", False)
            timeout = input_data.get("timeout", 30000)
            retries = input_data.get("retries", 3)
            solve_cloudflare = input_data.get("solve_cloudflare", True)
            google_search = input_data.get("google_search", False)
            google_solve = input_data.get("google_solve", False)
            google_image = input_data.get("google_image", False)
            wait_selector = input_data.get("wait_selector")
            wait_selector_state = input_data.get("wait_selector_state")
            wait_ms = input_data.get("wait_ms")
            selectors = input_data.get("selectors", {})
            extract_markdown = input_data.get("extract_markdown", False)
            extract_text = input_data.get("extract_text", False)
            extract_html = input_data.get("extract_html", False)

            active_session = None
            try:
                if fetcher_type == "basic":
                    from scrapling import Fetcher
                    kwargs = {}
                    if headers:
                        kwargs["headers"] = headers
                    if cookies:
                        kwargs["cookies"] = cookies
                    if proxy:
                        kwargs["proxy"] = proxy
                    if timeout:
                        kwargs["timeout"] = timeout / 1000.0  # basic fetcher expects seconds

                    if method == "GET":
                        response = Fetcher.get(url, **kwargs)
                    elif method == "POST":
                        response = Fetcher.post(url, data=input_data.get("body"), **kwargs)
                    elif method == "PUT":
                        response = Fetcher.put(url, data=input_data.get("body"), **kwargs)
                    elif method == "DELETE":
                        response = Fetcher.delete(url, **kwargs)
                    else:
                        raise ValueError(f"Unsupported HTTP method for basic fetcher: {method}")

                else:
                    # Session-based fetchers
                    kwargs = {
                        "timeout": timeout,
                        "solve_cloudflare": solve_cloudflare,
                        "google_search": google_search,
                    }
                    if wait_ms is not None:
                        kwargs["wait"] = wait_ms
                    if wait_selector:
                        kwargs["wait_selector"] = wait_selector
                    if wait_selector_state:
                        kwargs["wait_selector_state"] = wait_selector_state
                    if headers:
                        kwargs["extra_headers"] = headers
                    if proxy:
                        kwargs["proxy"] = proxy

                    if fetcher_type == "dynamic":
                        if not dynamic_session or dynamic_flags != _session_flags(input_data) or dynamic_headless != headless:
                            if dynamic_session:
                                try:
                                    dynamic_session.close()
                                except:
                                    pass
                            from scrapling.fetchers import DynamicSession
                            dynamic_flags = _session_flags(input_data)
                            dynamic_headless = headless
                            dynamic_session = DynamicSession(headless=headless, cookies=cookies, retries=SESSION_RETRIES, extra_flags=dynamic_flags)
                            dynamic_session.start()
                        response = dynamic_session.fetch(url, **kwargs)
                        active_session = dynamic_session
                    else:
                        if not stealthy_session or stealthy_flags != _session_flags(input_data) or stealthy_headless != headless:
                            if stealthy_session:
                                try:
                                    stealthy_session.close()
                                except:
                                    pass
                            from scrapling.fetchers import StealthySession
                            stealthy_flags = _session_flags(input_data)
                            stealthy_headless = headless
                            stealthy_session = StealthySession(headless=headless, cookies=cookies, retries=SESSION_RETRIES, extra_flags=stealthy_flags)
                            stealthy_session.start()
                        if google_solve:
                            response = _google_solve_fetch(stealthy_session, url, headers, timeout, extract_html, google_image)
                        else:
                            response = stealthy_session.fetch(url, **kwargs)
                        active_session = stealthy_session

                # Extract values using selectors
                extracted_data = {}
                for key, sel_config in selectors.items():
                    if isinstance(sel_config, str):
                        sel_str = sel_config
                        is_xpath = sel_str.startswith("/") or sel_str.startswith("./") or sel_str.startswith("xpath ")
                        all_matches = False
                    elif isinstance(sel_config, dict):
                        sel_str = sel_config.get("selector", "")
                        is_xpath = sel_config.get("xpath", False) or sel_str.startswith("/") or sel_str.startswith("./") or sel_str.startswith("xpath ")
                        all_matches = sel_config.get("all", False)
                    else:
                        continue

                    try:
                        if is_xpath:
                            if sel_str.startswith("xpath "):
                                sel_str = sel_str[6:]
                            sel_result = response.xpath(sel_str)
                        else:
                            sel_result = response.css(sel_str)

                        if all_matches:
                            extracted_data[key] = sel_result.getall()
                        else:
                            extracted_data[key] = sel_result.get()
                    except Exception as sel_err:
                        extracted_data[key] = None

                # Extract headers and cookies safely
                headers_dict = {}
                if hasattr(response, "headers"):
                    if isinstance(response.headers, dict):
                        headers_dict = response.headers
                    elif hasattr(response.headers, "items"):
                        headers_dict = dict(response.headers.items())
                    else:
                        try:
                            headers_dict = dict(response.headers)
                        except Exception:
                            headers_dict = {"raw": str(response.headers)}

                cookies_dict = {}
                if hasattr(response, "cookies"):
                    if isinstance(response.cookies, (list, tuple)):
                        for cookie in response.cookies:
                            if isinstance(cookie, dict) and "name" in cookie and "value" in cookie:
                                cookies_dict[cookie["name"]] = cookie["value"]
                            elif isinstance(cookie, tuple) and len(cookie) == 2:
                                cookies_dict[cookie[0]] = cookie[1]
                    elif isinstance(response.cookies, dict):
                        cookies_dict = response.cookies
                    else:
                        try:
                            cookies_dict = dict(response.cookies)
                        except Exception:
                            cookies_dict = {"raw": str(response.cookies)}

                result = {
                    "request_id": request_id,
                    "success": getattr(response, "success", True),
                    "status": response.status,
                    "url": response.url,
                    "headers": headers_dict,
                    "cookies": cookies_dict,
                    "data": extracted_data,
                }

                if extract_markdown:
                    try:
                        from markdownify import markdownify
                        result["markdown"] = markdownify(response.body.decode("utf-8", errors="ignore")) if hasattr(response, "body") and response.body else ""
                    except Exception as md_err:
                        result["markdown"] = None
                        result["markdown_error"] = str(md_err)

                if extract_text:
                    result["text"] = response.get_all_text()

                if extract_html:
                    result["html"] = response.body.decode("utf-8", errors="ignore") if hasattr(response, "body") and response.body else ""

                _close_pooled_pages(active_session)
                print(json.dumps(result))
                sys.stdout.flush()

            except Exception as e:
                _close_pooled_pages(active_session)
                print(json.dumps({
                    "request_id": request_id,
                    "success": False,
                    "error": str(e)
                }))
                sys.stdout.flush()

    finally:
        if stealthy_session:
            try:
                stealthy_session.close()
            except:
                pass
        if dynamic_session:
            try:
                dynamic_session.close()
            except:
                pass

if __name__ == "__main__":
    main()
