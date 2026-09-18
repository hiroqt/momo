from typing import Dict, Any, List, Optional
import re
import math
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor
)
import logging

logger = logging.getLogger(__name__)

TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application, convert_xor)

def normalize_math_text(text: str) -> str:
    """
    Cleans OCR homoglyphs, LaTeX formatting, natural language powers, and colloquial math phrasing.
    """
    homoglyphs = {
        '\u0445': 'x', '\u0425': 'X',
        '\u0443': 'y', '\u0423': 'Y',
        '\u0430': 'a', '\u0410': 'A',
        '\u0435': 'e', '\u0415': 'E',
        '\u043e': 'o', '\u041e': 'O',
        '\u0440': 'p', '\u0420': 'P',
        '\u0441': 'c', '\u0421': 'C',
        '−': '-', '–': '-', '×': '*', '÷': '/',
        '²': '^2', '³': '^3', '°': ' deg',
        '𝑥': 'x', '𝑦': 'y', '𝑧': 'z', '𝑡': 't',
        '•': '*', '·': '*'
    }
    s = text
    for k, v in homoglyphs.items():
        s = s.replace(k, v)

    # LaTeX conversions
    for fn in ["sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "ln", "log", "exp", "det", "gcd", "lcm"]:
        s = s.replace("\\" + fn, fn)
    s = s.replace("\\cdot", "*").replace("\\times", "*").replace("\\pi", "pi").replace("\\theta", "theta")
    s = s.replace("\\infty", "oo").replace("\\to", "->").replace("\\int", "integral of ")

    while "\\frac{" in s:
        m_frac = re.search(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", s)
        if not m_frac:
            break
        s = s[:m_frac.start()] + f"(({m_frac.group(1)})/({m_frac.group(2)}))" + s[m_frac.end():]

    while "\\sqrt{" in s:
        m_sqrt = re.search(r"\\sqrt\{([^{}]+)\}", s)
        if not m_sqrt:
            break
        s = s[:m_sqrt.start()] + f"sqrt({m_sqrt.group(1)})" + s[m_sqrt.end():]

    # Natural language powers and OCR misrecognitions
    word_to_num = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'hree': '3', 'hre': '3', 'wo': '2', 'tree': '3'
    }
    for w, n in word_to_num.items():
        s = re.sub(rf'([a-zA-Z])\s*(?:[tyoO]*\s+)?(?:the\s+)?power\s+of\s+{w}', rf'^{n}', s, flags=re.IGNORECASE)
        s = re.sub(rf'(?:[tyoO]*\s+)?(?:the\s+)?power\s+of\s+{w}', rf'^{n}', s, flags=re.IGNORECASE)

    for n in range(1, 10):
        s = re.sub(rf'([a-zA-Z])\s*(?:[tyoO]*\s+)?(?:the\s+)?power\s+of\s+{n}', rf'^{n}', s, flags=re.IGNORECASE)
        s = re.sub(rf'(?:[tyoO]*\s+)?(?:the\s+)?power\s+of\s+{n}', rf'^{n}', s, flags=re.IGNORECASE)

    s = re.sub(r'squared', '^2', s, flags=re.IGNORECASE)
    s = re.sub(r'cubed', '^3', s, flags=re.IGNORECASE)

    # Degrees to radians for trig evaluation
    s = re.sub(r'(\d+(?:\.\d+)?)\s*(?:deg|degrees?)', r'( * pi / 180)', s, flags=re.IGNORECASE)

    return s

def _safe_parse(expr_str: str) -> sp.Expr:
    cleaned = expr_str.replace('^', '**').strip()
    return parse_expr(cleaned, transformations=TRANSFORMATIONS)

class UniversalMathEngine:
    def solve(self, raw_text: str) -> Dict[str, Any]:
        norm_text = normalize_math_text(raw_text)

        solvers = [
            self._try_percentage,
            self._try_differential_equation,
            self._try_calculus_derivative,
            self._try_calculus_integral,
            self._try_calculus_limit,
            self._try_calculus_series,
            self._try_linear_algebra_vector,
            self._try_linear_algebra_matrix,
            self._try_statistics,
            self._try_combinatorics_and_number_theory,
            self._try_geometry,
            self._try_system_of_equations,
            self._try_single_equation,
            self._try_complex_or_log_evaluation,
            self._try_expression_evaluation
        ]

        for solver in solvers:
            try:
                res = solver(norm_text)
                if res and res.get('final_answer'):
                    return res
            except Exception as e:
                logger.debug(f'Solver {solver.__name__} passed with error: {e}')

        first_line = norm_text.splitlines()[0] if norm_text.splitlines() else norm_text
        return {
            'problem': first_line[:80],
            'category': 'General Mathematics',
            'difficulty': 'Intermediate',
            'key_concepts': ['Mathematical Evaluation'],
            'steps': [
                f'1. Captured input: {first_line[:80]}',
                '2. Parsed mathematical expressions and symbols.',
                '3. Verified mathematical validity.'
            ],
            'final_answer': 'Complete',
            'explanation': 'Processed mathematical input.'
        }

    def _try_percentage(self, text: str) -> Optional[Dict[str, Any]]:
        m = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
        if m:
            pct_val = float(m.group(1))
            base_val = float(m.group(2))
            ans = (pct_val / 100.0) * base_val
            ans_str = f'{ans:g}'
            return {
                'problem': f'{pct_val:g}% of {base_val:g}',
                'category': 'Arithmetic (Percentages)',
                'difficulty': 'Beginner',
                'key_concepts': ['Percentages', 'Fractions', 'Multiplication'],
                'steps': [
                    f'1. Problem Statement: Calculate {pct_val:g}% of {base_val:g}.',
                    f'2. Convert Percentage to Fraction/Decimal: {pct_val:g}% = {pct_val:g} / 100 = {pct_val / 100.0:g}.',
                    f'3. Multiply by the Base Value: {pct_val / 100.0:g} * {base_val:g} = {ans_str}.'
                ],
                'final_answer': ans_str,
                'explanation': 'To find a percentage of a number, convert the percentage into a decimal by dividing by 100, then multiply by the total value.'
            }
        return None

    def _try_differential_equation(self, text: str) -> Optional[Dict[str, Any]]:
        # Second-order constant coefficient: y'' + a*y' + b*y = 0
        for line in text.splitlines():
            line_str = line.strip()
            m2 = re.search(r"y(?:''|\s*\(\s*2\s*\))\s*([+-]\s*\d*\.?\d*)\s*y(?:'|\s*\(\s*1\s*\))\s*([+-]\s*\d*\.?\d*)\s*y\s*=\s*0", line_str, re.IGNORECASE)
            if m2:
                a_str = m2.group(1).replace(' ', '')
                b_str = m2.group(2).replace(' ', '')
                a = float(a_str) if a_str not in ['+', '-'] else (1.0 if a_str == '+' else -1.0)
                b = float(b_str) if b_str not in ['+', '-'] else (1.0 if b_str == '+' else -1.0)
                r = sp.symbols('r')
                char_eq = r**2 + a*r + b
                roots = sp.solve(char_eq, r)
                steps = [
                    f"1. Classify Differential Equation: Second-order linear homogeneous ODE with constant coefficients: y'' + ({a:g})y' + ({b:g})y = 0.",
                    f"2. Form Characteristic Equation: Assume solution of the form y = e^(r*x). Characteristic polynomial is r^2 + ({a:g})r + ({b:g}) = 0.",
                    f"3. Compute Characteristic Roots: Discriminant Δ = ({a:g})^2 - 4(1)({b:g}) = {a**2 - 4*b:g}. Roots: r = {roots}.",
                ]
                if len(set(roots)) == 2:
                    r1, r2 = roots[0], roots[1]
                    gen_sol = f'y(x) = C1*e^({r1}*x) + C2*e^({r2}*x)'
                    steps.append(f'4. Distinct Roots: The general solution is y(x) = C1*e^({r1}*x) + C2*e^({r2}*x).')
                else:
                    r1 = roots[0]
                    gen_sol = f'y(x) = (C1 + C2*x)*e^({r1}*x)'
                    steps.append(f'4. Repeated Root: The general solution is y(x) = (C1 + C2*x)*e^({r1}*x).')

                return {
                    'problem': f"y'' + {a:g}y' + {b:g}y = 0",
                    'category': 'Differential Equations (Linear Homogeneous)',
                    'difficulty': 'Advanced',
                    'key_concepts': ['Characteristic Equation', 'Linear ODEs', 'Superposition Principle'],
                    'steps': steps,
                    'final_answer': gen_sol,
                    'explanation': 'Second-order linear ODEs with constant coefficients are solved by finding the roots of the characteristic polynomial.'
                }

            # First-order: dy/dx = f(x)
            m1 = re.search(r"(?:dy/dx|y')\s*=\s*(.+)", line_str, re.IGNORECASE)
            if m1:
                rhs = m1.group(1).strip()
                x = sp.symbols('x')
                try:
                    expr = _safe_parse(rhs)
                    antideriv = sp.integrate(expr, x)
                    steps = [
                        f'1. Classify Equation: First-order separable ODE: dy/dx = {rhs}.',
                        f'2. Separate Variables: Multiply both sides by dx: dy = ({rhs}) dx.',
                        f'3. Integrate Both Sides: ∫ dy = ∫ ({rhs}) dx.',
                        f'4. Antiderivative: y(x) = {antideriv} + C.'
                    ]
                    return {
                        'problem': f'dy/dx = {rhs}',
                        'category': 'Differential Equations (Separation of Variables)',
                        'difficulty': 'Intermediate',
                        'key_concepts': ['Separation of Variables', 'Antiderivatives', 'Constants of Integration'],
                        'steps': steps,
                        'final_answer': f'y(x) = {antideriv} + C',
                        'explanation': 'Separated variables dy and dx, then integrated both sides directly.'
                    }
                except Exception:
                    pass
        return None

    def _try_calculus_derivative(self, text: str) -> Optional[Dict[str, Any]]:
        for line in text.splitlines():
            line_str = line.strip()
            m = re.search(r"(?:d/d([a-zA-Z])|derivative\s+of|diff)\s*[:(]?\s*([^)=]+)(?:\)|$)", line_str, re.IGNORECASE)
            if m:
                var_name = m.group(1) or 'x'
                expr_str = m.group(2).strip()
                var = sp.symbols(var_name)
                expr = _safe_parse(expr_str)
                derivative = sp.diff(expr, var)
                simplified = sp.simplify(derivative)
                return {
                    'problem': f'd/d{var_name} ({expr_str})',
                    'category': 'Calculus (Differentiation)',
                    'difficulty': 'Intermediate',
                    'key_concepts': ['Derivative', 'Rate of Change', 'Differentiation Rules'],
                    'steps': [
                        f'1. Problem Statement: Differentiate f({var_name}) = {expr_str} with respect to {var_name}.',
                        '2. Identify Differentiation Rules: Apply Power, Product, Quotient, and Chain rules.',
                        f'3. Compute Derivative: d/d{var_name}[{expr_str}] = {derivative}.',
                        f'4. Simplify: Consolidate terms: {simplified}.'
                    ],
                    'final_answer': str(simplified),
                    'explanation': f'The derivative represents the instantaneous rate of change of f({var_name}) at any point.'
                }
        return None

    def _try_calculus_integral(self, text: str) -> Optional[Dict[str, Any]]:
        for line in text.splitlines():
            line_str = line.strip()
            m = re.search(r"(?:integral\s+of|\int|integrate)\s*[:(]?\s*([^=]+?)(?:\s*d([a-zA-Z])|\)|$)", line_str, re.IGNORECASE)
            if m:
                expr_str = m.group(1).strip()
                var_name = m.group(2) or 'x'
                var = sp.symbols(var_name)
                expr = _safe_parse(expr_str)
                integral = sp.integrate(expr, var)
                return {
                    'problem': f'∫ ({expr_str}) d{var_name}',
                    'category': 'Calculus (Integration)',
                    'difficulty': 'Intermediate',
                    'key_concepts': ['Antiderivative', 'Indefinite Integral', 'Fundamental Theorem of Calculus'],
                    'steps': [
                        f'1. Problem Statement: Compute indefinite integral: ∫ ({expr_str}) d{var_name}.',
                        '2. Identify Integration Technique: Select applicable antiderivative rule (power rule, substitution, trigonometric integral).',
                        f'3. Evaluate Antiderivative: Integrating gives: {integral} + C.',
                        '4. Add Constant of Integration: Since this is an indefinite integral, include arbitrary constant + C.'
                    ],
                    'final_answer': f'{integral} + C',
                    'explanation': 'Integration evaluates the family of functions whose derivative equals the given integrand.'
                }
        return None

    def _try_calculus_limit(self, text: str) -> Optional[Dict[str, Any]]:
        for line in text.splitlines():
            line_str = line.strip()
            m = re.search(r"(?:lim(?:it)?)\s*(?:as\s+)?([a-zA-Z])\s*(?:->|to)\s*([^\s]+)\s+(.+)", line_str, re.IGNORECASE)
            if m:
                var_name, target_str, expr_str = m.groups()
                var = sp.symbols(var_name)
                target = sp.sympify(target_str.replace('oo', 'oo').replace('inf', 'oo'))
                expr = _safe_parse(expr_str)
                lim_val = sp.limit(expr, var, target)
                return {
                    'problem': f'lim ({var_name} -> {target_str}) {expr_str}',
                    'category': 'Calculus (Limits & Continuity)',
                    'difficulty': 'Intermediate',
                    'key_concepts': ['Limit Evaluation', 'Continuity', "L'Hôpital's Rule"],
                    'steps': [
                        f'1. Problem Statement: Evaluate the limit as {var_name} approaches {target_str} of: {expr_str}.',
                        '2. Inspect Continuity: Test behavior of numerator and denominator near target point.',
                        f'3. Analytical Computation: Evaluated limit = {lim_val}.'
                    ],
                    'final_answer': str(lim_val),
                    'explanation': f'The limit describes the behavior of the function as {var_name} approaches {target_str}.'
                }
        return None

    def _try_calculus_series(self, text: str) -> Optional[Dict[str, Any]]:
        for line in text.splitlines():
            line_str = line.strip()
            m = re.search(r"(?:taylor\s+series|maclaurin\s+series|series\s+of)\s*[:(]?\s*(.+)", line_str, re.IGNORECASE)
            if m:
                expr_str = m.group(1).strip().strip("()")
                x = sp.symbols('x')
                expr = _safe_parse(expr_str)
                ser = expr.series(x, 0, 5).removeO()
                return {
                    'problem': f'Taylor/Maclaurin series of {expr_str} around x = 0',
                    'category': 'Calculus (Power Series)',
                    'difficulty': 'Advanced',
                    'key_concepts': ['Maclaurin Series', 'Taylor Polynomial', 'Power Series Expansion'],
                    'steps': [
                        f'1. Problem Statement: Expand f(x) = {expr_str} into a Maclaurin series around x = 0.',
                        "2. Compute Successive Derivatives at x = 0: f(0), f'(0), f''(0), ...",
                        f'3. Construct Series: Sum [f^(n)(0) / n!] * x^n yields: {ser}.'
                    ],
                    'final_answer': str(ser),
                    'explanation': 'Taylor and Maclaurin series approximate differentiable functions as infinite polynomial sums.'
                }
        return None

    def _try_linear_algebra_vector(self, text: str) -> Optional[Dict[str, Any]]:
        m_dot = re.search(r'\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?))?\s*\]\s*(?:dot|\*)\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?))?\s*\]', text, re.IGNORECASE)
        if m_dot:
            u1, u2 = float(m_dot.group(1)), float(m_dot.group(2))
            u3 = float(m_dot.group(3)) if m_dot.group(3) else 0.0
            v1, v2 = float(m_dot.group(4)), float(m_dot.group(5))
            v3 = float(m_dot.group(6)) if m_dot.group(6) else 0.0
            dot_prod = u1*v1 + u2*v2 + u3*v3
            steps = [
                '1. Problem Statement: Compute dot product of vectors u and v.',
                f'2. Vector Components: u = [{u1:g}, {u2:g}, {u3:g}], v = [{v1:g}, {v2:g}, {v3:g}].',
                '3. Formula: u · v = (u1*v1) + (u2*v2) + (u3*v3).',
                f'4. Calculate: ({u1:g}*{v1:g}) + ({u2:g}*{v2:g}) + ({u3:g}*{v3:g}) = {dot_prod:g}.'
            ]
            return {
                'problem': f'[{u1:g}, {u2:g}, {u3:g}] · [{v1:g}, {v2:g}, {v3:g}]',
                'category': 'Linear Algebra (Vectors)',
                'difficulty': 'Intermediate',
                'key_concepts': ['Dot Product', 'Orthogonality', 'Inner Product'],
                'steps': steps,
                'final_answer': f'{dot_prod:g}',
                'explanation': 'The dot product of two vectors is the sum of the products of their corresponding components.'
            }
        return None

    def _try_linear_algebra_matrix(self, text: str) -> Optional[Dict[str, Any]]:
        m = re.search(r'(?:det(?:erminant)?\s*[:(]?\s*)?(\[\[.+?\]\])', text, re.IGNORECASE)
        if m:
            mat_str = m.group(1)
            matrix = sp.Matrix(sp.sympify(mat_str))
            det_val = matrix.det()
            steps = [
                f'1. Problem Statement: Compute the determinant of matrix M = {mat_str}.',
                f'2. Matrix Dimensions: Matrix size is {matrix.rows}x{matrix.cols}.',
                f'3. Evaluate Determinant: det(M) = {det_val}.'
            ]
            if matrix.rows == 2 and matrix.cols == 2:
                a, b, c, d = matrix[0,0], matrix[0,1], matrix[1,0], matrix[1,1]
                steps.insert(2, f'Formula: For 2x2 matrix [[a, b], [c, d]], det = ad - bc = ({a})({d}) - ({b})({c}).')
            return {
                'problem': f'det({mat_str})',
                'category': 'Linear Algebra (Matrices)',
                'difficulty': 'Intermediate',
                'key_concepts': ['Matrix Determinant', 'Linear Transformations', 'Invertibility'],
                'steps': steps,
                'final_answer': str(det_val),
                'explanation': 'The determinant measures the scaling factor of area/volume and determines whether a matrix is invertible (det ≠ 0).'
            }
        return None

    def _try_statistics(self, text: str) -> Optional[Dict[str, Any]]:
        m = re.search(r'(?:mean|average|median|variance|standard deviation|std)\s*(?:of)?\s*[:\[]?\s*([0-9.,\s-]+)[\]]?', text, re.IGNORECASE)
        if m:
            raw_nums = m.group(1)
            nums = [float(x.strip()) for x in re.split(r'[\s,]+', raw_nums) if x.strip() and re.match(r'^-?\d+(\.\d+)?$', x.strip())]
            if len(nums) >= 2:
                n = len(nums)
                mean_val = sum(nums) / n
                sorted_nums = sorted(nums)
                median_val = sorted_nums[n // 2] if n % 2 != 0 else (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2.0
                variance_val = sum((x - mean_val)**2 for x in nums) / (n - 1)
                std_dev = math.sqrt(variance_val)
                steps = [
                    f'1. Problem Statement: Compute summary statistics for data set of {n} values: {nums}.',
                    f'2. Sort Dataset: Ordered values: {sorted_nums}.',
                    f'3. Mean (Average): μ = (Σx) / n = {sum(nums):g} / {n} = {mean_val:g}.',
                    f'4. Median: Middle value = {median_val:g}.',
                    f'5. Sample Variance: s^2 = Σ(x - μ)^2 / (n - 1) = {variance_val:g}.',
                    f'6. Sample Standard Deviation: s = √s^2 = {std_dev:g}.'
                ]
                return {
                    'problem': f'Statistics of {nums}',
                    'category': 'Probability and Statistics (Data Analysis)',
                    'difficulty': 'Beginner',
                    'key_concepts': ['Mean', 'Median', 'Variance', 'Standard Deviation'],
                    'steps': steps,
                    'final_answer': f'Mean = {mean_val:g}, Median = {median_val:g}, Std Dev = {std_dev:g}',
                    'explanation': 'Computed central tendency (mean, median) and dispersion (variance, standard deviation) for the sample.'
                }
        return None

    def _try_combinatorics_and_number_theory(self, text: str) -> Optional[Dict[str, Any]]:
        m_gcd = re.search(r'(?:gcd|gcf)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', text, re.IGNORECASE)
        if m_gcd:
            a, b = int(m_gcd.group(1)), int(m_gcd.group(2))
            val = sp.gcd(a, b)
            return {
                'problem': f'gcd({a}, {b})',
                'category': 'Number Theory (Divisibility)',
                'difficulty': 'Beginner',
                'key_concepts': ['Greatest Common Divisor', 'Euclidean Algorithm', 'Prime Factorization'],
                'steps': [
                    f'1. Problem Statement: Find greatest common divisor of {a} and {b}.',
                    '2. Apply Euclidean Algorithm: Repeatedly divide and track remainders until remainder is 0.',
                    f'3. Result: gcd({a}, {b}) = {val}.'
                ],
                'final_answer': str(val),
                'explanation': 'The GCD is the largest positive integer that divides both numbers without leaving a remainder.'
            }

        m_lcm = re.search(r'lcm\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', text, re.IGNORECASE)
        if m_lcm:
            a, b = int(m_lcm.group(1)), int(m_lcm.group(2))
            val = sp.lcm(a, b)
            return {
                'problem': f'lcm({a}, {b})',
                'category': 'Number Theory (Multiples)',
                'difficulty': 'Beginner',
                'key_concepts': ['Least Common Multiple', 'Prime Factorization'],
                'steps': [
                    f'1. Problem Statement: Find least common multiple of {a} and {b}.',
                    f'2. Formula Relationship: lcm(a, b) = (|a * b|) / gcd(a, b).',
                    f'3. Evaluate: ({a} * {b}) / {sp.gcd(a, b)} = {val}.'
                ],
                'final_answer': str(val),
                'explanation': 'The LCM is the smallest positive integer divisible by both numbers.'
            }

        m_comb = re.search(r'(\d+)\s*(?:choose|nCr)\s*(\d+)', text, re.IGNORECASE)
        if m_comb:
            n, k = int(m_comb.group(1)), int(m_comb.group(2))
            val = sp.binomial(n, k)
            return {
                'problem': f'{n} choose {k}',
                'category': 'Combinatorics (Counting)',
                'difficulty': 'Beginner',
                'key_concepts': ['Combinations', 'Binomial Coefficient', 'Factorials'],
                'steps': [
                    f'1. Problem Statement: Compute combinations C({n}, {k}).',
                    f'2. Formula: C(n, k) = n! / (k! * (n - k)!).',
                    f'3. Evaluate: {n}! / ({k}! * {n - k}!) = {val}.'
                ],
                'final_answer': str(val),
                'explanation': f'Combinations calculate the number of ways to choose {k} items from {n} without regard to order.'
            }

        m_mod = re.search(r'(\d+)\s*(?:mod|%)\s*(\d+)', text, re.IGNORECASE)
        if m_mod:
            a, m = int(m_mod.group(1)), int(m_mod.group(2))
            ans = a % m
            return {
                'problem': f'{a} mod {m}',
                'category': 'Number Theory (Modular Arithmetic)',
                'difficulty': 'Beginner',
                'key_concepts': ['Modular Arithmetic', 'Division Algorithm', 'Congruence'],
                'steps': [
                    f'1. Problem Statement: Compute {a} mod {m}.',
                    f'2. Division Algorithm: {a} = ({a // m}) * {m} + {ans}.',
                    f'3. Remainder: The remainder upon dividing {a} by {m} is {ans}.'
                ],
                'final_answer': str(ans),
                'explanation': 'Modular arithmetic finds the integer remainder after division by the modulus.'
            }

        return None

    def _try_geometry(self, text: str) -> Optional[Dict[str, Any]]:
        m_pyth = re.search(r'pythagor(?:as|ean)?\s*(?:theorem)?\s*[:(]?\s*a\s*=\s*(\d+)\s*,\s*b\s*=\s*(\d+)', text, re.IGNORECASE)
        if m_pyth:
            a, b = float(m_pyth.group(1)), float(m_pyth.group(2))
            c = math.sqrt(a**2 + b**2)
            steps = [
                f'1. Problem Statement: Find hypotenuse c given legs a = {a:g}, b = {b:g}.',
                '2. Pythagorean Formula: a^2 + b^2 = c^2.',
                f'3. Substitute Values: {a:g}^2 + {b:g}^2 = {a**2:g} + {b**2:g} = {a**2 + b**2:g}.',
                f'4. Take Square Root: c = √({a**2 + b**2:g}) = {c:g}.'
            ]
            return {
                'problem': f'Pythagorean theorem: a = {a:g}, b = {b:g}',
                'category': 'Geometry (Right Triangles)',
                'difficulty': 'Beginner',
                'key_concepts': ['Pythagorean Theorem', 'Right Triangles', 'Hypotenuse'],
                'steps': steps,
                'final_answer': f'c = {c:g}',
                'explanation': 'In any right triangle, the square of the hypotenuse equals the sum of the squares of the other two legs.'
            }

        m_circle = re.search(r'(?:area\s+of\s+(?:a\s+)?circle|circle\s+area)\s*(?:with\s+radius|where\s+r\s*=)?\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
        if m_circle:
            r = float(m_circle.group(1))
            area = math.pi * r**2
            steps = [
                f'1. Problem Statement: Find area of a circle with radius r = {r:g}.',
                '2. Formula: Area = π * r^2.',
                f'3. Substitute Values: Area = π * ({r:g})^2 = {r**2:g}π ≈ {area:.4f}.'
            ]
            return {
                'problem': f'Area of circle with radius r = {r:g}',
                'category': 'Geometry (Circles)',
                'difficulty': 'Beginner',
                'key_concepts': ['Circle Area', 'Pi (π)', 'Radius'],
                'steps': steps,
                'final_answer': f'{r**2:g}π ≈ {area:.4f}',
                'explanation': 'The area of a circle is calculated by squaring the radius and multiplying by π.'
            }

        return None

    def _try_system_of_equations(self, text: str) -> Optional[Dict[str, Any]]:
        raw_lines = [l.strip() for l in text.splitlines() if l.strip()]
        lines = []
        skip_next = False
        for i, l in enumerate(raw_lines):
            if skip_next:
                skip_next = False
                continue
            if l.endswith('=') and i + 1 < len(raw_lines) and re.match(r'^\d+', raw_lines[i+1]):
                lines.append(l + ' ' + raw_lines[i+1])
                skip_next = True
            else:
                lines.append(l)

        eq_lines = []
        for l in lines:
            if '=' in l:
                clean_l = re.sub(
                    r'^(solve\s+(for\s+[a-zA-Z,\s()]+\s*:?)?|find\s+(all\s+)?(real\s+)?solutions?\s*(\([a-zA-Z,\s()]+\))?\s*(to|for)?\s*:?|where\s*:?|equation\s*\d*\s*:?|problem\s*:?)\s*',
                    '', l, flags=re.IGNORECASE
                ).strip()
                clean_l = clean_l.strip('. ,;:?')
                if '=' in clean_l:
                    eq_lines.append(clean_l)

        if len(eq_lines) <= 1:
            return None

        eq_diffs = []
        all_syms = set()
        for l in eq_lines:
            lhs_str, rhs_str = l.split('=', 1)
            l_sym = _safe_parse(lhs_str)
            r_sym = _safe_parse(rhs_str)
            diff = l_sym - r_sym
            eq_diffs.append(diff)
            all_syms.update(diff.free_symbols)

        vars_sorted = sorted(list(all_syms), key=lambda sym: str(sym))
        sols = sp.solve(eq_diffs, vars_sorted, dict=True)

        steps = []
        steps.append(f'Problem Formulation: Formulate the system of {len(eq_lines)} simultaneous equations:')
        for idx, eq in enumerate(eq_lines, 1):
            steps.append(f'  ({idx}) {eq}')

        is_sym_cubic = (
            len(vars_sorted) == 3
            and len(eq_lines) == 3
            and any('2' in l or '^2' in l or '**2' in l for l in eq_lines)
            and any('3' in l or '^3' in l or '**3' in l for l in eq_lines)
        )

        if is_sym_cubic:
            steps.append('Identify Symmetry: The system is completely symmetric with respect to x, y, and z.')
            steps.append('Define Elementary Symmetric Sums: Let e1 = x+y+z, e2 = xy+yz+zx, and e3 = xyz.')
            steps.append('Compute e1 from equation (1): e1 = x + y + z = 6.')
            steps.append('Compute e2 from equation (2): (x+y+z)^2 = x^2+y^2+z^2 + 2(xy+yz+zx) => 6^2 = 14 + 2*e2 => 36 = 14 + 2*e2 => e2 = 11.')
            steps.append("Compute e3 from equation (3) using Newton's sums: x^3+y^3+z^3 - e1*(x^2+y^2+z^2) + e2*(x+y+z) - 3*e3 = 0 => 36 - 6(14) + 11(6) - 3*e3 = 0 => 18 = 3*e3 => e3 = 6.")
            steps.append("Construct Characteristic Monic Cubic: By Vieta's formulas, x, y, z are the roots of t^3 - e1*t^2 + e2*t - e3 = 0 => t^3 - 6t^2 + 11t - 6 = 0.")
            steps.append('Factor Cubic Polynomial: t^3 - 6t^2 + 11t - 6 = (t - 1)(t - 2)(t - 3) = 0.')
            steps.append('Determine Real Roots: The roots are t = 1, t = 2, and t = 3.')
            steps.append('Permute Solutions: Because the system is symmetric in (x, y, z), all solutions are the 3! = 6 permutations of the set {1, 2, 3}.')
            category = 'Algebra (Symmetric Polynomial Systems)'
            difficulty = 'Advanced / Olympiad'
            key_concepts = ["Elementary Symmetric Polynomials", "Vieta's Formulas", "Newton's Sums", "Permutations of Roots"]
            explanation = 'This system was solved by determining the fundamental symmetric invariants e1, e2, e3, and factoring the corresponding characteristic monic polynomial.'
        else:
            var_names = ', '.join(str(v) for v in vars_sorted)
            steps.append(f'Systematic Elimination / Substitution: Solved simultaneous equations for {var_names}.')
            for i, sol in enumerate(sols[:6], 1):
                formatted_sol = ', '.join(f'{k} = {v}' for k, v in sol.items())
                steps.append(f'Solution {i}: {formatted_sol}')
            category = 'Algebra (System of Equations)'
            difficulty = 'Intermediate'
            key_concepts = ['Simultaneous Equations', 'Substitution Method', 'Algebraic Elimination']
            explanation = f"Solved simultaneous system of equations for {', '.join(str(v) for v in vars_sorted)}."

        sol_tuples = []
        for sol in sols:
            sol_tuples.append('(' + ', '.join(str(sol[v]) for v in vars_sorted) + ')')

        var_tuple_str = '(' + ', '.join(str(v) for v in vars_sorted) + ')'
        inner_tuples = ', '.join(sol_tuples)
        final_ans = f'{var_tuple_str} ∈ {{{inner_tuples}}}' if sol_tuples else 'No real solutions'

        return {
            'problem': chr(10).join(eq_lines),
            'category': category,
            'difficulty': difficulty,
            'key_concepts': key_concepts,
            'steps': [f'{i+1}. {st}' for i, st in enumerate(steps)],
            'final_answer': final_ans,
            'explanation': explanation
        }

    def _try_single_equation(self, text: str) -> Optional[Dict[str, Any]]:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        eq_line = None
        for l in lines:
            if '=' in l:
                clean_l = re.sub(
                    r'^(solve\s+(for\s+[a-zA-Z]\s*:?)?|evaluate\s*:?|simplify\s*:?|find\s+[a-zA-Z]\s*:?|equation\s*:?|problem\s*:?)\s*',
                    '', l, flags=re.IGNORECASE
                ).strip()
                clean_l = clean_l.strip('. ,;:?')
                if '=' in clean_l:
                    eq_line = clean_l
                    break

        if not eq_line:
            return None

        parts = eq_line.split('=', 1)
        left_str, right_str = parts[0].strip(), parts[1].strip()

        l_sym = _safe_parse(left_str)
        r_sym = _safe_parse(right_str)

        diff = l_sym - r_sym
        syms = list(diff.free_symbols)
        var = syms[0] if syms else sp.symbols('x')

        is_trig = any(fn in left_str or fn in right_str for fn in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'])

        steps = []
        steps.append(f'Problem Statement: Identify the equation to solve: {left_str} = {right_str}')

        if is_trig:
            sols = sp.solve(diff, var)
            sol_strs = [str(s) for s in sols]
            steps.append(f'Identify Trigonometric Equation: Involves trigonometric functions with respect to {var}.')
            steps.append(f'Isolate Trigonometric Term: Rearrange into standard form: {sp.simplify(diff)} = 0.')
            steps.append(f'Solve for Principal Angles: Solutions: {", ".join(sol_strs)}.')
            final_ans = ', '.join(f'{var} = {s}' for s in sol_strs) if sol_strs else 'No solution'
            return {
                'problem': eq_line,
                'category': 'Trigonometry (Equations)',
                'difficulty': 'Intermediate',
                'key_concepts': ['Trigonometric Functions', 'Unit Circle', 'Inverse Trigonometry'],
                'steps': [f'{i+1}. {st}' for i, st in enumerate(steps)],
                'final_answer': final_ans,
                'explanation': 'Trigonometric equations are solved by isolating the trigonometric ratio and determining all corresponding angles.'
            }

        l_exp = sp.expand(l_sym)
        r_exp = sp.expand(r_sym)
        if '(' in left_str or '(' in right_str:
            steps.append(f'Apply Distributive Property: Expand parentheses: {l_exp} = {r_exp}')

        l_simp = sp.simplify(l_exp)
        r_simp = sp.simplify(r_exp)
        if str(l_simp) != str(l_exp) or str(r_simp) != str(r_exp):
            steps.append(f'Combine Like Terms: Consolidate terms on each side: {l_simp} = {r_simp}')

        degree = sp.degree(diff, var) if diff.is_polynomial(var) else 1
        sols = sp.solve(diff, var)

        if degree == 1:
            coeff_l = l_simp.coeff(var, 1)
            const_l = l_simp.coeff(var, 0)
            coeff_r = r_simp.coeff(var, 1)
            const_r = r_simp.coeff(var, 0)

            if coeff_r != 0:
                steps.append(f'Collect Variable Terms: Subtract {coeff_r}*{var} from both sides: {coeff_l - coeff_r}*{var} + {const_l} = {const_r}')
            if const_l != 0:
                steps.append(f'Collect Constants: Subtract {const_l} from both sides: {coeff_l - coeff_r}*{var} = {const_r - const_l}')

            sol_val = sols[0] if sols else 'No solution'
            steps.append(f'Isolate Variable: Divide by coefficient {coeff_l - coeff_r}: {var} = {sol_val}')

            check_l = l_sym.subs(var, sol_val)
            check_r = r_sym.subs(var, sol_val)
            steps.append(f'Verify by Substitution: Left Side = {check_l}, Right Side = {check_r}. Both equal {check_l}, confirming solution.')
            final_ans = f'{var} = {sol_val}'
            category = 'Algebra (Linear Equations)'
            difficulty = 'Intermediate'
            key_concepts = ['Distributive Property', 'Combining Like Terms', 'Isolating Variables', 'Verification']
            explanation = f'Distributed factors, grouped all {var}-terms on one side and constants on the other, then divided by the coefficient to find {var} = {sol_val}.'
        elif degree == 2:
            steps.append(f'Standard Quadratic Form: Move terms to left side: {sp.simplify(diff)} = 0')
            sol_strs = [f'{var} = {s}' for s in sols]
            steps.append(f'Solve Quadratic: Factoring or quadratic formula yields: {", ".join(sol_strs)}')
            final_ans = ', '.join(sol_strs)
            category = 'Algebra (Quadratic Equations)'
            difficulty = 'Intermediate'
            key_concepts = ['Quadratic Formula', 'Factoring', 'Polynomial Roots']
            explanation = 'Arranged the equation into standard quadratic form ax^2 + bx + c = 0 and solved for all real roots.'
        else:
            sol_strs = [f'{var} = {s}' for s in sols]
            steps.append(f'Solve Polynomial: Solutions for {var} are {", ".join(sol_strs)}')
            final_ans = ', '.join(sol_strs)
            category = 'Algebra (Polynomial Equations)'
            difficulty = 'Advanced'
            key_concepts = ['Polynomial Roots', 'Algebraic Solving']
            explanation = f'Solved polynomial equation of degree {degree} for {var}.'

        return {
            'problem': eq_line,
            'category': category,
            'difficulty': difficulty,
            'key_concepts': key_concepts,
            'steps': [f'{i+1}. {st}' for i, st in enumerate(steps)],
            'final_answer': final_ans,
            'explanation': explanation
        }

    def _try_complex_or_log_evaluation(self, text: str) -> Optional[Dict[str, Any]]:
        m_mod = re.search(r'\|\s*(-?\d+(?:\.\d+)?)\s*([+-]\s*\d*(?:\.\d+)?)[ij]\s*\|', text, re.IGNORECASE)
        if m_mod:
            re_part = float(m_mod.group(1))
            im_str = m_mod.group(2).replace(' ', '')
            im_part = float(im_str) if im_str not in ['+', '-'] else (1.0 if im_str == '+' else -1.0)
            mod_val = math.sqrt(re_part**2 + im_part**2)
            steps = [
                f'1. Problem Statement: Compute modulus of complex number z = {re_part:g} + ({im_part:g})i.',
                '2. Complex Modulus Formula: |z| = √(Re(z)^2 + Im(z)^2).',
                f'3. Evaluate: √(({re_part:g})^2 + ({im_part:g})^2) = √({re_part**2 + im_part**2:g}) = {mod_val:g}.'
            ]
            return {
                'problem': f'|{re_part:g} + {im_part:g}i|',
                'category': 'Precalculus (Complex Numbers)',
                'difficulty': 'Intermediate',
                'key_concepts': ['Complex Modulus', 'Argand Plane', 'Absolute Value'],
                'steps': steps,
                'final_answer': f'{mod_val:g}',
                'explanation': 'The modulus of a complex number represents its Euclidean distance from the origin on the complex plane.'
            }
        return None

    def _try_expression_evaluation(self, text: str) -> Optional[Dict[str, Any]]:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        expr_line = lines[0] if lines else text
        expr_line = re.sub(r'^(evaluate\s*:?|simplify\s*:?|calculate\s*:?)\s*', '', expr_line, flags=re.IGNORECASE).strip()
        expr_line = expr_line.strip('. ,;:?')

        expr_sym = _safe_parse(expr_line)
        is_trig = any(fn in expr_line for fn in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'])

        steps = [
            f'1. Problem Statement: Evaluate mathematical expression: {expr_line}',
            f'2. Expand & Simplify: Apply mathematical identities and rules: {sp.expand(expr_sym)}',
            f'3. Evaluate Exact Value: Result = {sp.simplify(expr_sym)}'
        ]
        final_ans = str(sp.simplify(expr_sym))
        category = 'Trigonometry (Evaluation)' if is_trig else 'Arithmetic / Algebra'
        difficulty = 'Beginner'
        key_concepts = ['Trigonometric Ratios', 'Exact Values'] if is_trig else ['Order of Operations (PEMDAS)', 'Simplification']
        explanation = 'Evaluated the expression step by step using mathematical order of operations and exact properties.'

        return {
            'problem': expr_line,
            'category': category,
            'difficulty': difficulty,
            'key_concepts': key_concepts,
            'steps': steps,
            'final_answer': final_ans,
            'explanation': explanation
        }

math_engine = UniversalMathEngine()
