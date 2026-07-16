import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
import requests


def _find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    addr, port = s.getsockname()
    s.close()
    return port


@pytest.fixture(scope="session", autouse=True)
def backend_server():
    # If tests already point to an external server, do nothing
    if os.environ.get("REACT_APP_BACKEND_URL"):
        yield
        return

    backend_dir = Path(__file__).resolve().parents[1]
    port = _find_free_port()
    url = f"http://127.0.0.1:{port}"

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    cmd = [sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"]

    proc = subprocess.Popen(cmd, cwd=str(backend_dir), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # wait for server to be ready
    deadline = time.time() + 10
    health_ok = False
    while time.time() < deadline:
        try:
            r = requests.get(f"{url}/api/health", timeout=1)
            if r.status_code == 200:
                health_ok = True
                break
        except Exception:
            pass
        time.sleep(0.1)

    if not health_ok:
        proc.terminate()
        proc.wait(timeout=2)
        raise RuntimeError("Failed to start backend server for tests")

    # point tests to this server
    os.environ["REACT_APP_BACKEND_URL"] = url

    try:
        yield
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()