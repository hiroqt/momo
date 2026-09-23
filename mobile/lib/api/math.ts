import { apiFetch, BASE_URL } from './client';

export interface MathSolveResponse {
  problem: string;
  category?: string;
  difficulty?: string;
  key_concepts?: string[];
  steps: string[];
  final_answer: string;
  explanation: string;
}

export interface MathSolveParams {
  base64_image?: string;
  equation_text?: string;
}

export async function solveMathProblem(params: MathSolveParams): Promise<MathSolveResponse> {
  return apiFetch<MathSolveResponse>('/api/math/solve', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export { BASE_URL };
