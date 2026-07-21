import sys
import json
from typing import Dict, Any

def main():
    stealthy_session = None
    dynamic_session = None

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
            if not url:
                print(json.dumps({
                    "success": False,
                    "error": "URL parameter is required"
                }))
                sys.stdout.flush()
                continue

            fetcher_type = input_data.get("fetcher_type", "stealthy").lower()
            method = input_data.get("method", "GET").upper()
            headers = input_data.get("headers")
            cookies = input_data.get("cookies")
            proxy = input_data.get("proxy")
            headless = input_data.get("headless", True)
            network_idle = input_data.get("network_idle", False)
            timeout = input_data.get("timeout", 30000)
            solve_cloudflare = input_data.get("solve_cloudflare", True)
            wait_selector = input_data.get("wait_selector")
            wait_selector_state = input_data.get("wait_selector_state")
            wait_ms = input_data.get("wait_ms")
            selectors = input_data.get("selectors", {})
            extract_markdown = input_data.get("extract_markdown", False)
            extract_text = input_data.get("extract_text", False)
            extract_html = input_data.get("extract_html", False)

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
                        if not dynamic_session:
                            from scrapling.fetchers import DynamicSession
                            dynamic_session = DynamicSession(headless=headless, cookies=cookies)
                            dynamic_session.start()
                        response = dynamic_session.fetch(url, **kwargs)
                    else:
                        if not stealthy_session:
                            from scrapling.fetchers import StealthySession
                            stealthy_session = StealthySession(headless=headless, cookies=cookies)
                            stealthy_session.start()
                        response = stealthy_session.fetch(url, **kwargs)

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
                    "success": True,
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

                print(json.dumps(result))
                sys.stdout.flush()

            except Exception as e:
                print(json.dumps({
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
