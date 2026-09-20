# Design Specification: Self-Improving AGENTS.md via Obsidian Knowledge Vault

- **Date:** 2026-09-20
- **Status:** Approved
- **Scope:** Architectural / Subsystem Design

---

## 1. Executive Summary

This specification establishes a persistent, self-improving memory and rule distillation architecture for AI agents operating in this repository. By integrating the existing Obsidian vault at `/Users/arnel/nvidia-hackathon` with `AGENTS.md`, the platform transitions from static agent instructions to a dynamic, dual-tier learning system:

1. **Tier 1 (Core Working Instructions):** `AGENTS.md` remains high-signal, concise, and focused. It contains project rules, standard workflows, and a curated registry of **Graduated Agent Invariants** (summarized directives with direct links to full technical specifications).
2. **Tier 2 (Episodic & Deep Semantic Memory):** The `vault/` directory in the project root stores exhaustive post-mortems, exploratory learnings, bug traces, anti-patterns, and the full deep-dive markdown specifications for graduated rules.

Agents actively query the Obsidian vault before planning tasks (Pre-flight Recall), capture surprises and fixes upon completion (Post-flight Reflection), and graduate recurring invariants into `AGENTS.md` without instruction bloat or drift.

---

## 2. Architecture & Directory Structure

All agent notes reside in a dedicated top-level `vault/` directory, immediately indexable by Obsidian, browsable via the Obsidian Graph View, and queryable by agents using Obsidian MCP tools.

```text
vault/
├── index.md                     # Map of Content (MOC): Master index of topics, tags, and rules
├── templates/                   # Reusable note templates for agents
│   ├── learning-template.md     # Template for episodic learnings
│   ├── anti-pattern-template.md # Template for documented traps/failure modes
│   └── graduated-rule-template.md # Template for comprehensive rule specifications
├── learnings/                   # Daily findings, platform quirks, library edge cases
│   └── YYYY-MM-DD-<slug>.md
├── anti-patterns/               # Patterns and practices that failed and must never repeat
│   └── AP-<slug>.md
└── graduated/                   # Comprehensive deep-dive specifications for graduated rules
    └── RULE-<XXX>-<slug>.md
```

---

## 3. Note Schemas & Metadata Standard

Every note created in `vault/` MUST include YAML frontmatter compliant with the following standards:

### 3.1 Episodic Learning Note (`vault/learnings/YYYY-MM-DD-<slug>.md`)
```yaml
---
type: learning
title: "[Brief descriptive title]"
tags: [learning, <domain>, <tech-stack>]
date: YYYY-MM-DD
status: draft # Options: draft, candidate, graduated, archived
related_files:
  - path/to/file.ext
---

## Summary
Brief description of the finding or unexpected behavior.

## Context & Problem
What was attempted, what occurred, and what went wrong or surprised the agent.

## Solution & Workaround
The validated fix with code snippets and explanation.

## Key Takeaway
One or two sentences summarizing the operational rule.
```

### 3.2 Anti-Pattern Note (`vault/anti-patterns/AP-<slug>.md`)
```yaml
---
type: anti-pattern
title: "[Name of the anti-pattern]"
tags: [anti-pattern, <domain>, <risk-type>]
date: YYYY-MM-DD
severity: medium # Options: low, medium, high, critical
symptom: "[Observable error or regression]"
---

## What NOT to do
Code example or behavioral pattern that caused issues.

## Why it fails
Technical root cause (e.g., event loop starvation, re-render loop, memory leak).

## Approved Alternative
How to implement the requirement properly.
```

### 3.3 Graduated Rule Specification (`vault/graduated/RULE-<XXX>-<slug>.md`)
```yaml
---
id: RULE-XXX
title: "[Full Rule Name]"
tags: [graduated-rule, <domain>, architecture]
date_graduated: YYYY-MM-DD
agents_md_section: "35. Graduated Agent Invariants"
status: active # Options: active, superseded, deprecated
---

# RULE-XXX: [Full Rule Name]

## 1. Executive Summary
High-level overview of the invariant and why it is mandatory.

## 2. Technical Context & Root Cause
Deep dive into the underlying platform constraints, architectural boundaries, or edge cases.

## 3. Canonical Approved Implementation
Complete, production-ready code showing the compliant pattern.

## 4. Prohibited Patterns (Anti-Patterns)
Explicit examples of disallowed code and why they break.

## 5. Verification & Testing Checklist
Deterministic verification steps, test commands, and assertions required whenever this area is modified.

## 6. Provenance & References
Links to the original learning note(s) in `[[vault/learnings/...]]` and git commit/PR hashes where this pattern was validated.
```

---

## 4. Self-Improvement Lifecycle & Graduation Engine

The self-improvement lifecycle operates through four distinct phases:

```text
┌───────────────────────────────────────────────────────────┐
│ Phase 1: Pre-Flight Knowledge Recall (Step 0)             │
│ • Agent executes obsidian_search_notes by domain/tag      │
│ • Reads active rules and relevant anti-patterns           │
│ • Incorporates constraints into task implementation plan  │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ Phase 2: Task Execution & Friction Tracking               │
│ • Executes task using established engineering principles   │
│ • Tracks edge cases, surprises, bugs, or user corrections │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ Phase 3: Post-Flight Reflection & Ingestion               │
│ • Was a non-trivial edge case or bug resolved?            │
│ • If YES: Write note to vault/learnings/ or anti-patterns/│
│ • Update vault/index.md (Map of Content)                  │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
                Does it meet Graduation Criteria?
                     ├───────────────────┐
                     │ NO                │ YES
                     ▼                   ▼
              [Retain in vault/]   ┌──────────────────────────────────┐
                                   │ Phase 4: Distillation            │
                                   │ 1. Create vault/graduated/       │
                                   │    RULE-XXX-<slug>.md            │
                                   │ 2. Append summarized rule to     │
                                   │    AGENTS.md Section 35          │
                                   │ 3. Update vault/index.md         │
                                   └──────────────────────────────────┘
```

### 4.1 Graduation Criteria
A note in `vault/` qualifies for graduation to `AGENTS.md` if and only if:
1. **Systemic Scope:** It applies across multiple modules, files, or recurring agent tasks (e.g. all Expo gesture screens, all RAG chunking pipelines, all Supabase RLS migrations).
2. **PRD Alignment:** It complies strictly with `ARD_PRD.md` (no dilution of document retention, user quotas, or auth invariants).
3. **High Signal & Enforceable:** It can be expressed as an actionable directive with clear DOs and DON'Ts.

### 4.2 Formatting of Graduated Appendices in `AGENTS.md`
When graduating, `AGENTS.md` Section 35 receives an appended rule block:
```markdown
### RULE-XXX: [Title]
- **Context**: [1-2 sentences on why this rule exists].
- **Directives**:
  - **DO**: [Specific approved practice].
  - **DON'T**: [Specific prohibited practice].
- **Full Specification**: [Detailed Spec & Case Study](file:///Users/arnel/nvidia-hackathon/vault/graduated/RULE-XXX-<slug>.md)
```

---

## 5. `AGENTS.md` Modifications

`AGENTS.md` will be updated with:
1. **Section 34: Self-Improvement & Obsidian Knowledge Protocol**:
   - Instructs agents to perform Pre-Flight Recall before planning.
   - Instructs agents to perform Post-Flight Reflection upon task completion.
   - Prescribes how to graduate rules and maintain `vault/`.
2. **Section 35: Graduated Agent Invariants**:
   - The living index of distilled, active rules with links to `vault/graduated/`.
3. **Update to Section 31 (Agent Workflow)**:
   - Prepends Step 0: "Search Obsidian Vault for relevant domain knowledge and active rules."
   - Appends Step 11: "Conduct self-improvement reflection; log new learnings to Obsidian vault; graduate systemic invariants if applicable."

---

## 6. Obsidian MCP Tool Integration

| Step | MCP Tool | Arguments / Example |
| :--- | :--- | :--- |
| Pre-Flight Search | `obsidian_search_notes` | `{"query": "tag:#mobile #reanimated"}` |
| Read Constraint | `obsidian_get_note` | `{"file": "vault/graduated/RULE-001.md"}` |
| Ingest Learning | `obsidian_write_note` | `{"file": "vault/learnings/2026-09-20-tab-pager.md", "content": "..."}` |
| Ingest Anti-Pattern | `obsidian_write_note` | `{"file": "vault/anti-patterns/AP-unbounded-tabs.md", "content": "..."}` |
| Author Graduated Spec | `obsidian_write_note` | `{"file": "vault/graduated/RULE-001-tab-transitions.md", "content": "..."}` |
| Update MOC | `obsidian_patch_note` / `obsidian_append_to_note` | Update `vault/index.md` with new backlinks |

---

## 7. Safety Guardrails & Conflict Resolution

1. **`ARD_PRD.md` is Supreme:** Under no circumstances may an agent create a learning, anti-pattern, or graduated rule that conflicts with or alters the core product and architecture requirements in `ARD_PRD.md`.
2. **No Duplication:** Before creating any note or rule, agents must run `obsidian_search_notes` to verify whether an existing note or rule already addresses the topic. If an existing note exists, update or refine it rather than creating duplicates.
3. **Summary Self-Sufficiency:** The summary appended to `AGENTS.md` must be comprehensive enough for standard execution without forcing the agent to read the 500-line specification unless deep architectural modifications are underway.
4. **Git Versioning:** While `.obsidian/` is excluded from git to avoid local workspace churn, all files in `vault/` (`*.md`) are tracked in git alongside the codebase.

---

## 8. Initial Bootstrap Deliverables

Upon approval of this spec and implementation plan execution, the system will deliver:
1. `vault/` directory with `templates/`, `learnings/`, `anti-patterns/`, `graduated/`.
2. Core templates: `learning-template.md`, `anti-pattern-template.md`, `graduated-rule-template.md`.
3. Master Map of Content: `vault/index.md`.
4. Initial seeded learning note reflecting recent real work (e.g. mobile navigation and floating nav bar refactors).
5. Initial seeded graduated rule: `RULE-001` with deep-dive in `vault/graduated/` and summarized entry in `AGENTS.md`.
6. Updated `AGENTS.md` with Sections 34, 35, and revised Section 31.
