import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.ai.image_service import ImageGenerationService, ImageProvider, image_service
from app.services.ai.diagram_synthesizer import diagram_synthesizer
from app.services.security.rate_limiter import rate_limiter

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


class StubGeneralImageProvider(ImageProvider):
    async def generate(self, **kwargs):
        return {
            "image_base64": "generated-image-base64",
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

def test_topic_relevance_heart():
    spec = diagram_synthesizer.get_diagram_spec(topic="Human Heart", prompt="diagram of heart anatomy and blood flow")
    assert spec.category == "anatomy_system"
    assert "Human Heart" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Vena Cava" in l for l in labels)
    assert any("Right Atrium" in l or "Tricuspid" in l for l in labels)
    assert any("Left Ventricle" in l or "Myocardium" in l for l in labels)
    assert any("Aorta" in l for l in labels)
    assert len(spec.key_takeaways) > 0
    assert "left ventricle" in spec.key_takeaways[0].lower()

def test_topic_relevance_python_arrays():
    spec = diagram_synthesizer.get_diagram_spec(topic="Python Arrays", prompt="diagram of python list indexing and memory")
    assert spec.category == "data_structure_memory"
    assert "Python" in spec.title
    assert spec.code_snippet is not None
    assert "arr[1:4]" in spec.code_snippet
    labels = [e.label for e in spec.elements]
    assert any("arr[0]" in l for l in labels)
    assert any("arr[1]" in l for l in labels)
    assert any("arr[-1]" in l for l in labels)

def test_topic_relevance_water_cycle():
    spec = diagram_synthesizer.get_diagram_spec(topic="Water Cycle", prompt="diagram of water cycle")
    assert spec.category == "flow_or_cycle"
    assert "Water" in spec.title or "Hydrologic" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Evaporation" in l for l in labels)
    assert any("Condensation" in l for l in labels)
    assert any("Precipitation" in l for l in labels)

def test_topic_relevance_database_normalization():
    spec = diagram_synthesizer.get_diagram_spec(topic="Database Normalization", prompt="explain 1NF 2NF 3NF")
    assert spec.category == "comparison_matrix"
    labels = [e.label for e in spec.elements]
    assert any("1NF" in l for l in labels)
    assert any("2NF" in l for l in labels)
    assert any("3NF" in l for l in labels)

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
    assert data["image_base64"] == "generated-image-base64"

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
        for i in range(5):
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
    assert any("Sinoatrial" in l or "SA" in l for l in labels)
    assert any("AV Node" in l or "Atrioventricular" in l for l in labels)
    assert any("Bundle of His" in l for l in labels)
    assert any("Purkinje" in l for l in labels)

def test_subtopic_requirements_heart_valves():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Heart",
        prompt="diagram of heart",
        requirements="focus on heart valves and hemodynamics"
    )
    assert "Valves" in spec.title
    labels = [e.label for e in spec.elements]
    assert any("Tricuspid" in l for l in labels)
    assert any("Mitral" in l or "Bicuspid" in l for l in labels)
    assert any("Aortic" in l for l in labels)

def test_custom_bst_values():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Binary Search Tree",
        prompt="BST with specific keys",
        requirements="tree with nodes 50, 30, 70, 20"
    )
    labels = [e.label for e in spec.elements]
    assert any("50" in l for l in labels)
    assert any("30" in l for l in labels)
    assert any("70" in l for l in labels)

def test_custom_array_values():
    spec = diagram_synthesizer.get_diagram_spec(
        topic="Python Arrays",
        prompt="array indexing",
        requirements="array with elements 'Alpha', 'Bravo', 'Charlie', 'Delta'"
    )
    labels = [e.label for e in spec.elements]
    assert any("Alpha" in l for l in labels)
    assert any("Bravo" in l for l in labels)
    assert any("Charlie" in l for l in labels)

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
