import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.ai.math_engine import _safe_parse, math_engine


def test_math_parser_supports_implicit_multiplication_and_math_functions():
    assert str(_safe_parse("2x + sin(pi / 2)")) == "2*x + 1"


@pytest.mark.parametrize(("expression", "expected"), [
    ("arcsin(x)", "asin(x)"), ("arccos(x)", "acos(x)"), ("arctan(x)", "atan(x)"),
])
def test_math_parser_supports_inverse_trig_aliases(expression, expected):
    assert str(_safe_parse(expression)) == expected


def test_math_parser_rejects_factorial_calls_before_evaluation():
    with pytest.raises(ValueError, match="Factorial calls are unsupported"):
        _safe_parse("factorial(100000000)")


def test_math_parser_bounds_symbolic_expansion_before_solver_evaluation():
    with pytest.raises(ValueError, match="too complex to evaluate safely"):
        math_engine._try_expression_evaluation("(x + 1)^1000 * (y + 1)^1000")
    with pytest.raises(ValueError, match="too complex to evaluate safely"):
        math_engine._try_expression_evaluation(
            "((x+1)^100/(y+1)^100)*((z+1)^100/(w+1)^100)"
        )


def test_math_parser_rejects_python_execution_syntax(tmp_path):
    sentinel = tmp_path / "parser-executed"
    expression = f"__import__('pathlib').Path({str(sentinel)!r}).write_text('owned')"
    with pytest.raises(ValueError):
        _safe_parse(expression)
    assert not sentinel.exists()


@pytest.mark.parametrize("expression", ["x.__class__", "x[0]", "[x for x in ()]"])
def test_math_parser_rejects_non_math_python_syntax(expression):
    with pytest.raises(ValueError):
        _safe_parse(expression)


@pytest.mark.parametrize("expression", ["2^1000000000", "2^(2^1000)"])
def test_math_parser_bounds_expensive_numeric_exponents(expression):
    with pytest.raises(ValueError):
        _safe_parse(expression)


def test_limit_target_uses_the_safe_math_parser(tmp_path):
    sentinel = tmp_path / "limit-parser-executed"
    payload = f"__import__('pathlib').Path({str(sentinel)!r}).write_text('owned')"
    with pytest.raises(ValueError):
        math_engine._try_calculus_limit(f"limit x -> {payload} x")
    assert not sentinel.exists()


def test_matrix_cells_use_the_safe_math_parser(tmp_path):
    sentinel = tmp_path / "matrix-parser-executed"
    payload = f"__import__('pathlib').Path({str(sentinel)!r}).write_text('owned')"
    with pytest.raises(ValueError):
        math_engine._try_linear_algebra_matrix(f"det [[{payload}, 1], [1, 1]]")
    assert not sentinel.exists()


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
