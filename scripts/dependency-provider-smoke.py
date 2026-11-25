#!/usr/bin/env python3
"""Offline dependency smoke tests; no remote model, workspace or credentials."""
import sys


def provider():
    import certifi
    import httpcore2
    import httpx2
    import ssl
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    assert ssl.create_default_context(cafile=certifi.where()).get_ca_certs()
    assert callable(FalkorDriver)
    assert httpcore2 and httpx2


if __name__ == "__main__":
    if sys.argv[1:] != ["provider"]:
        raise SystemExit("Usage: dependency-provider-smoke.py provider")
    provider()
    print("Dependency environment smoke PASS:", sys.argv[1])
