Problem & Solution — Product (Goals & scope)

Problem (short): teams waste time finding gaps in APIs because writing exhaustive tests is slow and error-prone; NL test intents are underspecified and developers miss edge-cases.
Solution (short): provide a tool that turns short natural-language pointers into broad, prioritized request-variation test suites, runs those tests (auto/manual), and surfaces all non-2xx results with the exact request that triggered them — so teams discover issues fast without writing dozens of hand-crafted tests.

Ready-to-paste summary (longer, for the top of the Goals & scope section)

Problem — why we’re building this (product perspective)

API owners (devs, PMs, QA) often miss edge cases because writing combinatorial test variations across many fields is tedious.

Natural-language test intents (e.g., “ensure to test when amount is 0”) are concise, but teams need those intents expanded into many concrete requests that exercise type, boundary, encoding, and cross-field failure modes.

Current tools either require lots of manual test authoring, focus only on response matching, or lack straightforward replay and triage workflows for failures. That slows debugging and increases production incidents.

Solution — what Phase-1 delivers

A lightweight UI + runner that accepts NL pointers and automatically generates prioritized test variations per pointer (always including the user-requested checks).

Runs tests in auto or manual mode and logs every non-2xx or malformed response, along with the exact request payload and headers that triggered it.

Provides a failure inspector with replay and masked-secrets support so teams can triage and reproduce issues quickly.

Phase-1 focuses on finding failures (broad request generation + execution + logging) rather than strict response assertions — enabling rapid discovery of unexpected behavior.

How this maps to Goals & Scope

Generate broad coverage from short NL inputs → ensures user pointers are always included and emphasized.

Prioritize and run tests (user_requested first; auto/manual toggles) → enables safe, manageable execution.

Surface failing requests and provide replay → shortens the feedback loop for debugging and fixing issues.

Keep Phase-1 deliberately simple: mockable generator & runner, no production writes by default, and easy swap-in points for LLMs and backend runners later.


Core features to implement now:

NL composer UI with “AI Generate Tests” (mocked LLM for Phase-1 — use existing mock generator).

Test queue: list tests, tags, run_mode (auto/manual), user_requested flag.

Runner: sequentially execute auto tests, record start/end/time, response object, and log if status !== 2xx.

Results inspector: show request, masked headers, response body/status, and replay button.

Logging: store logs for each run (request, response, timestamps, error flags, minimal diff info).

Safety: sandbox mode / no writes by default for production-critical endpoints (Phase-1: mockApi simulates server).

Mock data: include mock_tests.json (already in canvas) and an initial set of APIs (orders, users).