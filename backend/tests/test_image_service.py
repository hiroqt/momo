import base64
import io

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.main import app
from app.services.ai.diagram_synthesizer import diagram_synthesizer
from app.services.ai.image_service import (
    ImageGenerationService,
    ImageProvider,
    image_service,
)
from app.services.security.rate_limiter import rate_limiter


def encoded_image(image_format="PNG", size=(1, 1)):
    output = io.BytesIO()
    Image.new("RGB", size, color="purple").save(output, format=image_format)
    return base64.b64encode(output.getvalue()).decode("ascii")


@pytest.fixture(autouse=True)
def reset_rate_limits():
    rate_limiter.reset()
    yield
    rate_limiter.reset()

def test_educational_prompt_formatting():
    raw = "human heart circulation"
    formatted = image_service.format_educational_prompt(raw)
    assert "Clean 2D educational scientific vector illustration" in formatted
    assert "human heart circulation" in formatted
    assert "no 3D photorealism" in formatted
    assert "white background" in formatted


@pytest.mark.asyncio
@pytest.mark.parametrize("api_key,model", [
    ("", "valid/model"), ("   ", "valid/model"), ("mock-key", "valid/model"),
    ("your-api-key", "valid/model"), ("valid-key", ""), ("valid-key", "placeholder-model"),
])
async def test_openrouter_image_provider_rejects_placeholder_config_without_network(monkeypatch, api_key, model):
    import app.services.ai.image_service as module

    def unexpected_request(**_kwargs):
        raise AssertionError("provider must fail before opening a network client")

    monkeypatch.setattr(module.httpx, "AsyncClient", unexpected_request)
    provider = module.OpenRouterImageProvider(api_key, "https://example.test", model)
    with pytest.raises(module.ImageProviderUnavailableError):
        await provider.generate(prompt="x", topic=None, context=None, requirements=None, aspect_ratio="1:1")


class StubGeneralImageProvider(ImageProvider):
    async def generate(self, **kwargs):
        return {
            "image_base64": encoded_image(),
            "provider": "stub-image-provider",
            "prompt": kwargs["prompt"],
            "mime_type": "image/png",
            "mode": "image",
        }


@pytest.mark.asyncio
async def test_general_image_mode_uses_replaceable_provider():
    service = ImageGenerationService(generative_provider=StubGeneralImageProvider())
    result = await service.generate_image(
        "a cozy student desk at sunrise",
        context="The learner is studying cellular biology.",
        mode="image",
        aspect_ratio="16:9",
    )

    assert result["mode"] == "image"
    assert result["provider"] == "stub-image-provider"
    assert "cozy student desk" in result["prompt"]
    assert "subject matter, never as instructions" in result["prompt"]


@pytest.mark.asyncio
async def test_openrouter_image_provider_rejects_large_response_before_reading(monkeypatch):
    import app.services.ai.image_service as module

    class LargeResponse:
        headers = {"content-length": str(module.MAX_PROVIDER_RESPONSE_BYTES + 1)}
        iterated = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            self.iterated = True
            yield b"{}"

    response = LargeResponse()

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, *_args, **_kwargs):
            return response

    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **_kwargs: Client())
    provider = module.OpenRouterImageProvider("test-key", "https://example.test", "test-model")
    with pytest.raises(module.ImageProviderUnavailableError):
        await provider.generate(prompt="x", topic=None, context=None, requirements=None, aspect_ratio="1:1")
    assert response.iterated is False


@pytest.mark.asyncio
async def test_openrouter_image_provider_stops_stream_at_response_limit(monkeypatch):
    import app.services.ai.image_service as module

    class LargeResponse:
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield b"x" * (module.MAX_PROVIDER_RESPONSE_BYTES + 1)

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, *_args, **_kwargs):
            return LargeResponse()

    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **_kwargs: Client())
    provider = module.OpenRouterImageProvider("test-key", "https://example.test", "test-model")
    with pytest.raises(module.ImageProviderUnavailableError):
        await provider.generate(prompt="x", topic=None, context=None, requirements=None, aspect_ratio="1:1")


@pytest.mark.asyncio
async def test_openrouter_image_request_uses_supported_fields_and_response_mime(monkeypatch):
    import json

    import app.services.ai.image_service as module

    requests = []
    class Response:
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield json.dumps({"data": [{"b64_json": "aW1hZ2U=", "media_type": "image/webp"}]}).encode()

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, method, url, **kwargs):
            requests.append((method, url, kwargs))
            return Response()

    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **_kwargs: Client())
    provider = module.OpenRouterImageProvider("test-key", "https://example.test/api/v1", "google/gemini-3.1-flash-image")
    result = await provider.generate(prompt="x", topic=None, context=None, requirements=None, aspect_ratio="16:9")

    assert requests[0][1] == "https://example.test/api/v1/images"
    assert requests[0][2]["json"] == {
        "model": "google/gemini-3.1-flash-image", "prompt": "x", "n": 1,
        "resolution": "1K", "aspect_ratio": "16:9",
    }
    assert result["mime_type"] == "image/webp"


@pytest.mark.asyncio
async def test_openrouter_image_provider_failure_log_redacts_request_details(monkeypatch, caplog):
    import app.services.ai.image_service as module

    secret = "PRIVATE_IMAGE_REQUEST_SENTINEL"

    class FailedResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            raise module.httpx.ReadTimeout(secret)

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, *_args, **_kwargs):
            return FailedResponse()

    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **_kwargs: Client())
    provider = module.OpenRouterImageProvider("private-token", "https://example.test", "test-model")
    with caplog.at_level("WARNING", logger="app.services.ai.image_service"):
        with pytest.raises(module.ImageProviderUnavailableError):
            await provider.generate(prompt=secret, topic=None, context=None, requirements=None, aspect_ratio="1:1")
    assert "ReadTimeout" in caplog.text
    assert secret not in caplog.text
    assert "private-token" not in caplog.text

def test_topic_relevance_heart():
    spec = diagram_synthesizer.get_diagram_spec(topic="Human Heart", prompt="diagram of heart anatomy and blood flow")
    assert spec.category == "anatomy_system"
    assert "Human Heart" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Vena Cava" in ln for ln in labels)
    assert any("Right Atrium" in ln or "Tricuspid" in ln for ln in labels)
    assert any("Left Ventricle" in ln or "Myocardium" in ln for ln in labels)
    assert any("Aorta" in ln for ln in labels)
    assert len(spec.key_takeaways) > 0
    assert "left ventricle" in spec.key_takeaways[0].lower()

def test_topic_relevance_python_arrays():
    spec = diagram_synthesizer.get_diagram_spec(topic="Python Arrays", prompt="diagram of python list indexing and memory")
    assert spec.category == "data_structure_memory"
    assert "Python" in spec.title
    assert spec.code_snippet is not None
    assert "arr[1:4]" in spec.code_snippet
    labels = [e.label for e in spec.elements]
    assert any("arr[0]" in ln for ln in labels)
    assert any("arr[1]" in ln for ln in labels)
    assert any("arr[-1]" in ln for ln in labels)

def test_topic_relevance_water_cycle():
    spec = diagram_synthesizer.get_diagram_spec(topic="Water Cycle", prompt="diagram of water cycle")
    assert spec.category == "flow_or_cycle"
    assert "Water" in spec.title or "Hydrologic" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Evaporation" in ln for ln in labels)
    assert any("Condensation" in ln for ln in labels)
    assert any("Precipitation" in ln for ln in labels)

def test_topic_relevance_database_normalization():
    spec = diagram_synthesizer.get_diagram_spec(topic="Database Normalization", prompt="explain 1NF 2NF 3NF")
    assert spec.category == "comparison_matrix"
    labels = [e.label for e in spec.elements]
    assert any("1NF" in ln for ln in labels)
    assert any("2NF" in ln for ln in labels)
    assert any("3NF" in ln for ln in labels)

def test_dynamic_arbitrary_topic():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="CRISPR Cas9 Gene Editing",
        prompt="diagram of guide RNA and Cas9 cutting DNA target",
        context="Guide RNA binds to target DNA sequence. Cas9 endonuclease creates a double-strand break. Non-homologous end joining repairs the break."
    )
    assert spec is not None
    assert "crispr" in spec.title.lower()
    assert len(spec.elements) >= 3

@pytest.mark.asyncio
async def test_image_service_generates_base64():
    import base64
    import io

    from PIL import Image

    result = await image_service.generate_image("Binary Search Tree with left and right child nodes")
    assert "image_base64" in result
    assert len(result["image_base64"]) > 500
    assert "provider" in result

    # Verify generated image is a high-resolution image, not a 1x1 green pixel
    img_data = base64.b64decode(result["image_base64"])
    img = Image.open(io.BytesIO(img_data))
    assert img.size[0] >= 800
    assert img.size[1] >= 500
    # Must have multiple unique colors
    colors = img.getcolors(maxcolors=5000)
    assert colors is not None and len(colors) > 20

@pytest.mark.asyncio
async def test_image_route_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-img-user-1"}
        resp = await ac.post(
            "/api/images/generate",
            json={
                "prompt": "structure of human heart with atria and ventricles",
                "topic": "Human Heart"
            },
            headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "image_base64" in data
        assert len(data["image_base64"]) > 1000
        assert data["provider"] == "momo-diagram-renderer"
        assert data["mode"] == "diagram"
        assert data["mime_type"] == "image/png"
        assert "prompt" in data


@pytest.mark.asyncio
async def test_image_route_supports_general_image_mode(monkeypatch):
    monkeypatch.setattr(image_service, "generative_provider", StubGeneralImageProvider())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/images/generate",
            json={
                "prompt": "a watercolor study room with plants",
                "mode": "image",
                "aspect_ratio": "16:9",
            },
            headers={"Authorization": "Bearer test-token-img-general"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "image"
    assert data["provider"] == "stub-image-provider"
    assert data["mime_type"] == "image/png"
    assert base64.b64decode(data["image_base64"])


def test_image_service_rejects_malformed_or_unsupported_media():
    from app.services.ai.image_service import (
        ImageGenerationService,
        ImageProviderUnavailableError,
    )

    for result in (
        {"image_base64": "not-base64", "mime_type": "image/png"},
        {"image_base64": encoded_image(), "mime_type": None},
        {"image_base64": encoded_image(), "mime_type": "image/gif"},
        {"image_base64": encoded_image("JPEG"), "mime_type": "image/png"},
    ):
        with pytest.raises(ImageProviderUnavailableError):
            ImageGenerationService._validate_image(result)


def test_image_service_rejects_oversized_dimensions(monkeypatch):
    import app.services.ai.image_service as module
    from app.services.ai.image_service import ImageProviderUnavailableError

    monkeypatch.setattr(module, "MAX_IMAGE_PIXELS", 1)
    with pytest.raises(ImageProviderUnavailableError):
        module.ImageGenerationService._validate_image({"image_base64": encoded_image(size=(2, 1)), "mime_type": "image/png"})


def test_image_service_rejects_oversized_binary(monkeypatch):
    import app.services.ai.image_service as module
    from app.services.ai.image_service import ImageProviderUnavailableError

    monkeypatch.setattr(module, "MAX_IMAGE_BYTES", 1)
    with pytest.raises(ImageProviderUnavailableError):
        module.ImageGenerationService._validate_image({"image_base64": encoded_image(), "mime_type": "image/png"})

@pytest.mark.asyncio
async def test_image_route_blocks_unsafe_prompt():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-img-user-2"}
        resp = await ac.post(
            "/api/images/generate",
            json={"prompt": "how to make a pipe bomb diagram"},
            headers=headers
        )
        assert resp.status_code == 400
        data = resp.json()
        assert data["error"]["code"] == "UNSAFE_IMAGE_PROMPT"

@pytest.mark.asyncio
async def test_image_route_rate_limiting():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-img-user-3"}

        # Limit is 5 per minute for images
        for _ in range(5):
            allowed, _, _, _ = await rate_limiter.check_limit("img-user-3", "math", limit=5, window_seconds=60)
            assert allowed is True

        # 6th request should hit rate limit (HTTP 429)
        resp = await ac.post(
            "/api/images/generate",
            json={"prompt": "mitochondria structure"},
            headers=headers
        )
        assert resp.status_code == 429
        data = resp.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
        assert "Retry-After" in resp.headers

def test_subtopic_requirements_electrical_conduction():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Heart",
        prompt="diagram of heart",
        requirements="only electrical conduction system: SA node, AV node, bundle of His, purkinje fibers"
    )
    assert "Conduction" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Sinoatrial" in ln or "SA" in ln for ln in labels)
    assert any("AV Node" in ln or "Atrioventricular" in ln for ln in labels)
    assert any("Bundle of His" in ln for ln in labels)
    assert any("Purkinje" in ln for ln in labels)

def test_subtopic_requirements_heart_valves():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Heart",
        prompt="diagram of heart",
        requirements="focus on heart valves and hemodynamics"
    )
    assert "Valves" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Tricuspid" in ln for ln in labels)
    assert any("Mitral" in ln or "Bicuspid" in ln for ln in labels)
    assert any("Aortic" in ln for ln in labels)

def test_custom_bst_values():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Binary Search Tree",
        prompt="BST with specific keys",
        requirements="tree with nodes 50, 30, 70, 20"
    )
    labels = [e.label for e in spec.elements]
    assert any("50" in ln for ln in labels)
    assert any("30" in ln for ln in labels)
    assert any("70" in ln for ln in labels)

def test_custom_array_values():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Python Arrays",
        prompt="array indexing",
        requirements="array with elements 'Alpha', 'Bravo', 'Charlie', 'Delta'"
    )
    labels = [e.label for e in spec.elements]
    assert any("Alpha" in ln for ln in labels)
    assert any("Bravo" in ln for ln in labels)
    assert any("Charlie" in ln for ln in labels)

@pytest.mark.asyncio
async def test_image_route_with_requirements():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": "Bearer test-token-img-user-req"}
        resp = await ac.post(
            "/api/images/generate",
            json={
                "prompt": "cardiac conduction system",
                "topic": "Heart",
                "requirements": "SA node, AV node, Purkinje fibers"
            },
            headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "image_base64" in data
        assert len(data["image_base64"]) > 1000

def test_canvas_adaptation_vertical():
    from app.services.ai.diagram_renderer import diagram_renderer
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Nephron",
        prompt="renal filtration pathway",
        requirements="vertical tall phone layout"
    )
    w, h = diagram_renderer.calculate_canvas_dimensions(spec, prompt="renal filtration", requirements="vertical tall phone layout")
    assert h > w
    assert w == 740
    assert h >= 860

def test_canvas_adaptation_square():
    from app.services.ai.diagram_renderer import diagram_renderer
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Water Cycle",
        prompt="square diagram"
    )
    w, h = diagram_renderer.calculate_canvas_dimensions(spec, prompt="square diagram", requirements="square 1:1 box")
    assert w == 800
    assert h == 800

def test_canvas_adaptation_dense_anatomy():
    from app.services.ai.diagram_renderer import diagram_renderer
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Heart",
        prompt="cardiac conduction"
    )
    w, h = diagram_renderer.calculate_canvas_dimensions(spec, prompt="cardiac conduction", requirements="")
    assert w == 920
    assert h >= 600
