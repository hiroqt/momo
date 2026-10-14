# AI-02 Synthetic Grounding Review Answer Key

> [!warning] Coordinator copy
> Keep this separate from the blind worksheet until the human labels are submitted. This key reproduces the fixture’s authored labels; it is not an independent human gold set.

| Worksheet ref | Fixture case | Fixture label |
| --- | --- | --- |
| W01 | `support_mitosis` | `supports` |
| W02 | `support_photosynthesis` | `supports` |
| W03 | `unknown_memory_balance` | `says_nothing` |
| W04 | `contradict_salt_bond` | `contradicts` |
| W05 | `support_salt_bond` | `supports` |
| W06 | `contradict_photosynthesis` | `contradicts` |
| W07 | `unknown_injected_evidence` | `contradicts` |
| W08 | `support_lawmaking` | `supports` |
| W09 | `unknown_salt_melting` | `says_nothing` |
| W10 | `contradict_binary_search` | `contradicts` |
| W11 | `contradict_water` | `contradicts` |
| W12 | `support_binary_search` | `supports` |
| W13 | `contradict_mitosis` | `contradicts` |
| W14 | `unknown_search_inventor` | `says_nothing` |
| W15 | `support_memory` | `supports` |
| W16 | `unknown_law_date` | `says_nothing` |
| W17 | `unknown_mitosis_neurons` | `says_nothing` |
| W18 | `contradict_lawmaking` | `contradicts` |

Source: `backend/tests/fixtures/jev_grounding_eval.json`. The fixture labels are synthetic and authored; comparison against them alone does not establish representative calibration.
