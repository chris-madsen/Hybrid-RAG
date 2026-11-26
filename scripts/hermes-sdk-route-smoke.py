"""Exercise the real pinned OpenAI SDK URL join; no real provider traffic.

The Hermes adapter passes the configured base directly to the SDK. This test
certifies only the SDK path and stateless fixture body, not Hermes auth,
Bifröst plugin loading, native retrieval or physical provider wire.
"""
import json
import httpx
import openai

EXPECTED_PATH = "/chatgpt_passthrough/backend-api/codex/responses"


def observed_request(base_path):
    requests = []

    def observe(request):
        requests.append((request.method, request.url.path, json.loads(request.content)))
        return httpx.Response(400, json={"error": {"message": "synthetic route observation"}})

    with httpx.Client(transport=httpx.MockTransport(observe), trust_env=False) as transport:
        with openai.OpenAI(base_url="http://127.0.0.1:8765" + base_path,
                           api_key="synthetic-sdk-route", max_retries=0,
                           http_client=transport) as client:
            try:
                client.responses.create(model="fixture-model", input="fixture query", store=False)
            except openai.BadRequestError:
                pass
            else:
                raise AssertionError("synthetic response was not observed")
    assert len(requests) == 1
    return requests[0]


if __name__ == "__main__":
    assert openai.__version__ == "2.24.0", "wrong SDK version for Hermes v0.22.3"
    method, path, body = observed_request("/chatgpt_passthrough/backend-api/codex")
    assert method == "POST" and path == EXPECTED_PATH
    assert body["model"] == "fixture-model" and body["store"] is False
    assert observed_request("/chatgpt_passthrough")[1] == "/chatgpt_passthrough/responses"
    assert observed_request("/chatgpt_passthrough/backend-api/codex/responses")[1] != EXPECTED_PATH
    print(json.dumps({"status": "sdk-native-route-pass", "providerWireCertified": False}))
