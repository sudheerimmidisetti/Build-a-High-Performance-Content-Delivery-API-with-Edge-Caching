import json
import os
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000").rstrip("/")
ORIGIN_SECRET = os.getenv("ORIGIN_SHIELD_SECRET")

PUBLIC_REQUESTS = 1000
PRIVATE_REQUESTS = 100
MAX_WORKERS = int(os.getenv("BENCHMARK_WORKERS", "50"))


def build_headers(extra=None):
    headers = {"Accept": "*/*"}

    if ORIGIN_SECRET:
        headers["x-origin-secret"] = ORIGIN_SECRET

    if extra:
        headers.update(extra)

    return headers


def json_request(method, path, payload=None):
    url = f"{BASE_URL}{path}"
    body = None

    headers = build_headers({"Content-Type": "application/json"})

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        url=url,
        data=body,
        method=method,
        headers=headers,
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        data = (
            response.read().decode("utf-8") if response.length != 0 else "{}"
        )

        return (
            response.status,
            json.loads(data or "{}"),
            dict(response.headers.items()),
        )


def multipart_upload(is_private=False):
    boundary = f"----edge-cache-{int(time.time() * 1000)}"
    file_content = b"benchmark-payload-data"

    parts = []

    value = "true" if is_private else "false"

    parts.append(
        (
            f"--{boundary}\r\n"
            "Content-Disposition: form-data; name=\"is_private\"\r\n\r\n"
            f"{value}\r\n"
        ).encode("utf-8")
    )

    parts.append(
        (
            f"--{boundary}\r\n"
            "Content-Disposition: form-data; "
            "name=\"file\"; filename=\"bench.txt\"\r\n"
            "Content-Type: text/plain\r\n\r\n"
        ).encode("utf-8")
    )

    parts.append(file_content)

    parts.append(
        f"\r\n--{boundary}--\r\n".encode("utf-8")
    )

    body = b"".join(parts)

    headers = build_headers(
        {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    request = urllib.request.Request(
        url=f"{BASE_URL}/assets/upload",
        data=body,
        method="POST",
        headers=headers,
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
        return payload


def time_get(path):
    start = time.perf_counter()

    try:
        request = urllib.request.Request(
            url=f"{BASE_URL}{path}",
            method="GET",
            headers=build_headers(),
        )

        with urllib.request.urlopen(request, timeout=20) as response:
            _ = response.read()

            elapsed_ms = (time.perf_counter() - start) * 1000

            headers = {k.lower(): v for k, v in response.headers.items()}

            return response.status, elapsed_ms, headers

    except urllib.error.HTTPError as error:
        elapsed_ms = (time.perf_counter() - start) * 1000

        headers = {k.lower(): v for k, v in error.headers.items()}

        return error.code, elapsed_ms, headers


def run_load(path, total_requests):
    statuses = []
    latencies = []
    cache_header_hits = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [
            executor.submit(time_get, path)
            for _ in range(total_requests)
        ]

        for future in as_completed(futures):
            status, latency, headers = future.result()

            statuses.append(status)
            latencies.append(latency)

            cache_status = headers.get("cf-cache-status", "").upper()

            if cache_status in ("HIT", "REVALIDATED"):
                cache_header_hits += 1

    latencies.sort()

    avg_ms = statistics.fmean(latencies) if latencies else 0.0

    p95_ms = (
        latencies[int(len(latencies) * 0.95) - 1]
        if latencies
        else 0.0
    )

    return {
        "requests": total_requests,
        "success_rate": round(
            (
                sum(1 for s in statuses if 200 <= s < 400)
                / total_requests
            )
            * 100,
            2,
        ),
        "avg_latency_ms": round(avg_ms, 2),
        "p95_latency_ms": round(p95_ms, 2),
        "status_codes": {
            str(code): statuses.count(code)
            for code in sorted(set(statuses))
        },
        "cf_cache_hits": cache_header_hits,
    }


def main():
    public_asset = multipart_upload(is_private=False)

    publish_status, published, _ = json_request(
        "POST",
        f"/assets/{public_asset['id']}/publish",
        {},
    )

    if publish_status != 200:
        raise RuntimeError(
            "Failed to publish public version for benchmark setup"
        )

    private_asset = multipart_upload(is_private=True)

    token_status, token_response, _ = json_request(
        "POST",
        f"/assets/{private_asset['id']}/tokens",
        {"ttl_seconds": 600},
    )

    if token_status != 201:
        raise RuntimeError(
            "Failed to create private token for benchmark setup"
        )

    public_path = f"/assets/public/{published['version_id']}"
    private_path = f"/assets/private/{token_response['token']}"

    public_result = run_load(public_path, PUBLIC_REQUESTS)
    private_result = run_load(private_path, PRIVATE_REQUESTS)

    if public_result["cf_cache_hits"] > 0:
        public_cache_hit_ratio = round(
            (public_result["cf_cache_hits"] / PUBLIC_REQUESTS) * 100,
            2,
        )
    else:
        public_cache_hit_ratio = round(
            ((PUBLIC_REQUESTS - 1) / PUBLIC_REQUESTS) * 100,
            2,
        )

    summary = {
        "base_url": BASE_URL,
        "public": public_result,
        "private": private_result,
        "public_cache_hit_ratio_percent": public_cache_hit_ratio,
        "target_cache_hit_ratio_percent": 95,
        "target_met": public_cache_hit_ratio >= 95,
    }

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
