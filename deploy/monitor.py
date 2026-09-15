#!/usr/bin/env python3
"""Public-only health and verified TLS check. No credentials or family data."""
import json
import re
import socket
import ssl
import time
import urllib.request

HOST = '147.45.136.245'


def certificate_problem(start, end, now):
    threshold = min(86400, (end - start) * 0.2)
    if now < start or end <= now:
        return 'Certificate is not currently valid'
    if end - now < threshold:
        return 'Certificate expires within renewal warning window'
    return None


def check():
    context = ssl.create_default_context()
    with socket.create_connection((HOST, 443), timeout=15) as connection:
        with context.wrap_socket(connection, server_hostname=HOST) as tls:
            cert = tls.getpeercert()
    start, end = (ssl.cert_time_to_seconds(cert[key]) for key in ('notBefore', 'notAfter'))
    problem = certificate_problem(start, end, time.time())
    if problem:
        raise RuntimeError(problem)
    for route in ('/api/health', '/release.json', '/login'):
        with urllib.request.urlopen('https://' + HOST + route, timeout=15) as response:
            body = response.read(1024 * 1024)
            if response.status != 200:
                raise RuntimeError('HTTP check failed: ' + route)
            if route == '/release.json' and not re.fullmatch('[a-f0-9]{40}', str(json.loads(body).get('commit', ''))):
                raise RuntimeError('Release metadata missing')
            if route == '/api/health' and json.loads(body).get('code') != 200:
                raise RuntimeError('Backend health failed')
    print(json.dumps({'ok': True, 'certificate_hours_remaining': round((end - time.time()) / 3600, 1)}))


if __name__ == '__main__':
    for attempt in range(3):
        try:
            check()
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(10)
