# План применения AI-assisted SDLC в ACE

## A. Подключение инструкций

1. Главным источником правил остаётся корневой `AGENTS.md`.
2. Для выполнения задач используется `docs/operations/ai-assisted-sdlc.md`.
3. Агент читает существующие OpenSpec и ADR, а не заводит второй набор архитектурных норм.
4. Подробные команды для отдельных этапов доступны в `source/commands/`; готовые нейтральные промпты — в `PROMPTS-ACE.md`.
5. Уровень процесса выбирается по риску изменения: T0, T1, T2.

## B. Сквозная проверка на реальной задаче

1. Найти незакрытый баг или небольшую фичу, проверив свежую ветку, реализацию и открытые PR.
2. Выполнить фактологический Research с ссылками `path:line`.
3. Подготовить краткий Design и получить одобрение принципиальных решений.
4. Записать фазы в существующем OpenSpec/исполнительном плане.
5. Для багов воспроизвести RED, затем добиться GREEN после исправления.
6. Выполнять четыре последовательные проверки: build, architecture, security, plan completeness.
7. Запустить применимые real-provider проверки, отдельно зафиксировать тесты, которые не запускались.
8. Запушить изменения в отдельный PR и получить точный SHA, результаты CI и человеческое ревью.
9. После завершения провести cross-phase проверку всей доработки.

## C. Дополнительные quality gates

Исследовать текущие GitHub Actions, secret scanning, зависимости, соблюдение архитектурных границ и ссылки документации. Добавлять только недостающие проверки, которые дают измеримую пользу. Не копировать Go-oriented инструменты в TypeScript проект.

## Не делать

- Не вводить Claude TeamCreate/TaskCreate как зависимость.
- Не создавать новый orchestrator для SDLC.
- Не дублировать OpenSpec, ADR или CI.
- Не выдавать самопроверку одного агента за независимое ревью.
- Не выдавать mock-only тест за подтверждение реального provider-E2E.

## Критерий завершения

Минимум один реальный PR с прохождением необходимых стадий, воспроизводимыми тестами и наблюдаемыми результатами quality gates; затем можно подкреплять описание этого подхода в CV ссылкой на PR.

## Quality Gates extension — execute as small follow-up PRs

See [research comparison](QUALITY-GATES-VIDEO-SPHERICON-ACE.md), [gate catalog](QUALITY-GATES-CATALOG.md), and [implementation plan](QUALITY-GATES-IMPLEMENTATION-PLAN.md).

Current implementation status:
1. **QG0 — ACTIVE:** offline local Markdown links with positive/negative fixtures.
2. **QG1 — ACTIVE:** PR secret scanning plus actionlint/zizmor workflow checks; scheduled history scan remains report-only.
3. **QG2 — ACTIVE / report-only:** ACE-specific ast-grep architecture rules with valid/invalid fixtures and source scan.
4. **QG3 / G02 — ACTIVE procedural gate:** T2 implementation requires a pre-code acceptance crosswalk and owner decisions; it is intentionally not an automatic architectural approval.
5. **QG4 — ACTIVE report-only:** Knip dependency/unused-code reporting plus scheduled OSV advisory reporting.
6. **QG5 — ACTIVE for accepted Gateway v1:** in-place compatibility guard plus TypeSpec regeneration/DTO/schema compatibility.
7. **QG6 — ACTIVE:** nightly/full deterministic-property verification and OSV reporting are complemented by pinned CodeQL and a targeted mutation gate for accepted security invariants; remote external links are scheduled nonblocking signal.
8. **QG7/8 conditional:** typed SCIP/easement or additional toolchain managers are not required for SDLC closure unless a measured invariant cannot be proved with the existing graph/tests.

Do not copy Sphericon's PostgreSQL/Go SQL testing, frontend bundle-size gate, worktree isolation daemon or TypeSpec generators as mandatory ACE checks. Existing ACE deterministic tests, real providers and release supply-chain proof remain independent authoritative checks.

Any future gate/tool extension must still show a clean fixture and deliberately violating fixture, observed commands and GitHub CI result at the exact PR SHA. Do not relabel optional/planned gates as required closure criteria.

## Owner decision update — TypeSpec and functional domain

- TypeSpec is **selected**, no longer a speculative P2 option. Introduce it through staged TS-00..06 tasks in [codegen coverage](TYPESPEC-CODEGEN-COVERAGE.md).
- For each material T2 design begin with Event Storming, derive readonly ADTs/pure invariants, and keep Effect use cases at I/O boundaries.
- Codegen output target is wider than DTO types: client SDK, server handler/route interfaces, runtime validation, mechanical mappings, typed permission metadata, mocks/fixtures, docs and reproducibility.
- Require fail-on-unmapped fields/enums, schema compatibility and actual wire roundtrip. No claim all targets are available from TypeSpec alone.
- The ACE-selected subset from the pinned Matt v1.3.2 release is vendored and byte-manifested; see the [vendor record](MATT-POCOCK-SKILLS.md). Its compatibility overlay preserves the one-agent/OpenSpec process; file presence alone is not agent-use evidence.
- Don't invoke upstream `implement-spec` as a multi-agent executor. The one-agent ACE process remains canonical.
