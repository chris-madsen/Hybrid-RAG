#!/usr/bin/env python3
"""Offline dependency smoke tests; no remote model, workspace or credentials."""
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def provider():
    import certifi
    import httpcore2
    import httpx2
    import ssl
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    assert ssl.create_default_context(cafile=certifi.where()).get_ca_certs()
    assert callable(FalkorDriver)
    assert httpcore2 and httpx2


def fast():
    import onnxruntime
    import numpy as np
    assert "CPUExecutionProvider" in onnxruntime.get_available_providers()
    assert np.isfinite(np.array([1.0])).all()
    for name in ("fastembed-worker.py", "fastembed-sparse-worker.py", "fastembed-reranker-worker.py"):
        assert callable(runpy.run_path(str(ROOT / name))["main"])


def st():
    import torch
    from sentence_transformers import SentenceTransformer
    assert torch.equal(torch.tensor([1.0]) + 1, torch.tensor([2.0]))
    assert callable(SentenceTransformer)
    assert callable(runpy.run_path(str(ROOT / "sentence-transformers-worker.py"))["main"])


if __name__ == "__main__":
    {"provider": provider, "fast": fast, "st": st}[sys.argv[1]]()
    print("Dependency environment smoke PASS:", sys.argv[1])
