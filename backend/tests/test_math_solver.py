import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_solve_math_with_equation_text():
    headers = {"Authorization": "Bearer test-token-user-math"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req = {
            "equation_text": "3x + 9 = 24"
        }
        res = await ac.post("/api/math/solve", json=req, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "final_answer" in data
        assert "x = 5" in data["final_answer"] or "5" in data["final_answer"]
        assert len(data["steps"]) > 0
        assert "category" in data

@pytest.mark.asyncio
async def test_solve_math_with_calculus_expression():
    headers = {"Authorization": "Bearer test-token-user-math"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req = {
            "equation_text": "derivative of x^2 + 6x"
        }
        res = await ac.post("/api/math/solve", json=req, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "2*x + 6" in data["final_answer"] or "2x + 6" in data["final_answer"]

@pytest.mark.asyncio
async def test_solve_math_missing_input():
    headers = {"Authorization": "Bearer test-token-user-math"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/math/solve", json={}, headers=headers)
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "MISSING_INPUT"
