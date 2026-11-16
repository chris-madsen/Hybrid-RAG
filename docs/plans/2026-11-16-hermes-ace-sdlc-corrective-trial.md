# Hermes: довести до конца интеграционное испытание ACE staged SDLC

**Тип:** рабочий протокол тестирования самого SDLC, не второй G11 task tracker. **Статус:** planning-only, G02=REVIEW_REQUIRED, product implementation и external provider/agent/Harbor egress НЕ разрешены. **Язык:** русский. **Исполнитель:** один Hermes agent в активной сессии.

## 1. Контекст проекта и состояние

ACE — modular monolith TypeScript + Effect с функциональным DDD, bounded contexts, pure/immutable domain state, Event Storming, TypeSpec как источником выбранных public wire, и Design by Contract Бертрана Мейера. Не проектировать с нуля: проверить фактическое состояние и минимальную AS-IS→TO-BE дельту, не дублировать доменных владельцев, сервисы, Gateway или benchmark runner.

Пайплайн: Research → существующий OpenSpec Requirements → `ace-architecture-design` → human G02 decision → `ace-to-tickets` (~1000 handwritten changed lines в т.ч. tests, гибкий бюджет) → `ace-phase-plan` (подробные `phases/<ID>.md`) → только с отдельного разрешения один approved Apply phase → Verify. `ace-stage-handoff` допускает **неблокирующие stacked Draft PR на стадиях подготовки**, но не автоматические G02, merge или provider egress.

Читать **полностью в актуальном checkout**: `AGENTS.md`, `docs/operations/staged-sdlc-pipeline.md`, `docs/operations/ai-assisted-sdlc.md`, `.agents/skills/ace-sdlc/SKILL.md`, `.agents/skills/ace-stage-handoff/SKILL.md`, `.agents/skills/ace-architecture-design/SKILL.md`, `.agents/skills/ace-to-tickets/SKILL.md`, `.agents/skills/ace-phase-plan/SKILL.md`, `.agents/skills/domain-modeling/SKILL.md`, `.agents/skills/codebase-design/SKILL.md`, compatibility overlay, accepted ADR-007/009/012/015/017/019 и OpenSpec changes 002, 010, 013.

Изучить live GitHub SHA/state каждого PR:
- [#259](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/259): базовый skill pipeline (пока Draft).
- [#260](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/260): фактическое G11 Research; existing G11 Requirements из слитого #255 переиспользованы.
- [#261](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/261): provisional G11 architecture и открытые G02 решения.
- [#262](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/262): архитектурно обусловленный DAG из C01–C10 в canonical `tasks.md`.
- [#263](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/263): phase checker + negative regression suite.
- [#264](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/264): 10 linked executable phase briefs, X handoff; это НЕ продуктовая реализация.
- Это поручение: отдельный Draft PR на исправленной ветке #264. **Не объединять** с альтернативными #256 (8 частей) и #258 (10 частей).

Цель: доказать, что **реальный Hermes Skill runtime** может пройти pipeline, сохранять зависимости/версионность, получать настоящие проверки, без несанкционированной реализации G11.

## 2. Твои недоработки в первом прогоне — что уже исправлено и что осталось

### H-01: Не было настоящего вызова Skills (главный блокер)

В твоём Research #260 указано: Hermes v2026.9.24 был запущен из `/media/ilja/DATA/soft/consillium/harness`, а новые `.agents/skills` лежали в другом checkout. Активный Skill index не содержал project skills; project trust не был подтверждён. Ты *читал Markdown и вручную применял инструкции*, что нельзя записывать как Skill invocation.

**Задание:** определить реальный root процесса/TUI Hermes, открыть новую сессию из корректного worktree с #259 или его потомком, проверить документированные `hermes skills list` / `hermes skills trust` (сверить `--help` и версию); не менять глобальное доверие/config без решения владельца. Получить конкретный log/trace *фактического invocation* хотя бы одного нового ACE Skill и evidence перехода к следующему. Если host поддерживает только manual-read, честно отметить `NOT_OBSERVED` и описать отсутствующий механизм. Не подменять вызов чтением `SKILL.md`.

### H-02: Недостаточная валидация DAG и AC

Изначально #263 regex пропускал неизвестный ID `C100` и привязывал AC к наличию **где-либо** в `tasks.md`, а не к собственной фазе. Исправление в #263 усовершенствовано: generic phase IDs, CSV DAG, missing/self/cycle/duplicate dependencies, checkbox-to-link parity, **точное соответствие AC каждой фазы её DAG строке**, полное покрытие всех spec scenarios и input fingerprints.

**Задание:** выполнить настоящие позитивные и негативные тесты из исправленного `test/ace-sdlc-pipeline.test.mjs`, затем повторить их независимо в disposable fixture. Обязательно: `C100` неизвестный → BLOCKED; `P01` валидная альтернатива → PASS; malformed `C01; owner G02` → BLOCKED; циклы → BLOCKED; чужой/лишний AC в фазе → BLOCKED, даже когда AC встречается в другой строке; непокрытый AC → BLOCKED; missing checkbox/link → BLOCKED; design/spec изменены → STALE/BLOCKED; symlink → BLOCKED. Фиксировать exit code и SHA, а не только сообщение.

### H-03: Исправлял архитектурный owner Harbor слишком поздно

В первоначальном #262 C08–C10 ссылались на исторический Codex `harbor-four-arm`, а в #264 ты переключился на существующий двухветочный Hermes feedback loop. Само обнаружение правильно, но **поменять owner в X без обновления P** нарушает stage ownership. Исправление перенесено в #262; #264 теперь должен содержать только собственные фазовые brief и ссылки, без «скрытого» изменения plan decisions.

**Задание:** проверить раздельный three-dot diff, фактические tree blobs и parent ancestry #261→#262→#263→#264. Ожидание: #261 меняет только `design.md`; #262 только `tasks.md`; #263 только checker/test; #264 только 10 `phases/C*.md` + ссылки и cross-phase handoff в `tasks.md`. Ни один потомок не должен отменять исправленный родительский design/script. Проверить source/runtime и ADR, не считать GitHub Files API истинным, если он закешировал старую выдачу.

### H-04: У модели попытки терялась идентичность, у C02 не было доказательства безопасности retry

В исходном `design.md` вариант `Authorized` терял body/provider/model binding из `Planned`. В #261 теперь предлагается неизменяемый `AttemptBinding` во всех фазах, с требованием реальной atomic consume/CAS/fencing для конкуренции и рестарта. Это только **proposal**, не принятый wire или state-store.

Pinned Bifröst вызывает ACE `PreLLMHook` выше своего внутреннего `executeRequestWithRetries`. **Один входящий Chat запрос может дать больше одной физической callback/send** даже при `MaxRetries=0` через `extraAttempts`. Запрет fallback сам по себе не запрещает inner retries.

**Задание:** проверить C01/C02/ C04 и G02 варианты DEC-G11-01/02/03. До live C02 нужен pinned-runtime **mock proof** отсутствия любого неавторизованного second-send либо одобренный per-dispatch guard. Если нет — `C02 BLOCKED`, независимо от отдельных разрешений на provider. Доказанный single-dispatch режим **не есть** позитивный G11-009 retry-enabled acceptance. Не выдумывать второй proxy, новый hook, TypeSpec wire или CAS store. Представить владельцу архитектурные альтернативы, не принимать их за него.

### H-05: Неверные метаданные X PR и непротестированный parent drift

Файлы #264 содержали `output X Draft PR not created` и старый worktree SHA после создания PR. Исправлено в фазовых файлах: immutable design/spec input hashes, mutable current PR HEAD запрашивать у GitHub. Теперь нужно протестировать настоящую реакцию на *изменение родительского входа*.

**Задание:** создать только одноразовые безопасные sandbox branch/PR для эксперимента, не переписывать настоящие G11 требования. Изменить fixture design/spec в родителе, записать Git blob before/after; child должен получить `STALE` / exit 2, потом адресно reconcile/refresh и вернуть PASS. Проверить правильный child-only three-dot diff, а после **имитации squash merge в disposable base ветку** — restack/retarget тестового child. Настоящие #259–264 не мержить и не закрывать; не оставлять бессмысленные временные PR без описания/отчёта. Если изолированный реальный PR-тест технически невозможен — `NOT_RUN`, не PASS.

### H-06: Реальная совместимость Hermes ingress не определена

Текущий `scripts/harbor_hermes_codex_oauth.py` настраивает `openai-codex`, но не доказан Bifröst endpoint; ACE Bifröst plugin поддерживает только `/v1/chat/completions`. **Нельзя предполагать**, что запросы Hermes OAuth Responses внезапно станут Chat Completions. C07 owner route remains `BLOCKED`. Проверить native documented protocol/API, предложить владельцу совместимые варианты с доказательствами, не переключая agent напрямую к provider и не создавая second ACE ingress.

## 3. Точная последовательность испытания

**S0 — remote и host preflight.** Повторно прочитать Git/branch/PR/state/HEAD, проверить clean worktrees и `sdlc:preflight`/`worktree:preflight`. Точная версия/путь процесса Hermes, trust policy, pinned OpenSpec 1.17.0, Node/npm, source SHA; не давать неподтверждённую информацию из старого Research. Не менять main/owner ветки ради удобства.

**S1 — реальный Skills smoke.** Активный Hermes из корректного project checkout, подтверждение discovery/trust + реальный invocation. Отдельно отметить для каждого `ace-stage-handoff`, `ace-architecture-design`, `ace-to-tickets`, `ace-phase-plan`, `domain-modeling` и `codebase-design`: `DISCOVERED / INVOKED / MANUAL_READ / BLOCKED / NOT_OBSERVED`. Если active session не поддерживает это, дать точную инструкцию оператору и отчёт о блокере, не фальсифицировать.

**S2 — dry-run фазовых планов.** Из последнего #264 HEAD:
~~~bash
npm run test:ace-sdlc-pipeline
npm run test:matt-pocock-skill-vendor
npm run test:sdd-prepare
npm run check:ace-phase-plan -- --change 013-gateway-g11-production-acceptance --phase C01 --json
# Повторить для C02…C10, каждый со своим exit и input SHA
npm run check:sdd-prepare -- --change 013-gateway-g11-production-acceptance --tier T2 --json
npm run verify:pr
~~~
Каждый из десяти должен дать `READY_FOR_PHASE_REVIEW` **только структурно**; пробелы в Git SHA/AC/checkbox/dependency должны блокировать. Отдельно OpenSpec strict в закреплённой версии (11 active changes historically passed, не переносить результат на новый SHA). Реальные тестовые команды в мини-планах помечены PLANNED/NOT_RUN, в частности будущий `scripts/bifrost-g11-wire-e2e.mjs`; не запускать файл, которого ещё нет.

**S3 — negative fixture suite.** Выполнить H-02, сохранить `test name | source SHA | exit | observed | expected`, обязательно включая независимый AC drift и C100. Не изменять canonical G11 change ради отрицательного теста.

**S4 — реальные stage handoff/STALE/restack.** Выполнить H-05 на disposable repo branches. Отдельно проверить, что следующий этап **планирования** может открыться до merge родителя без автоматического owner approval; G02 и egress остаются жесткими STOP. Если host завершается после одного PR, записать реальную границу продолжения и checkpoint — не обещать фоновую работу от Markdown Skill.

**S5 — семантическое архитектурное ревью** без реализации: точный Bifröst pin, две retry границы, C02 single-dispatch proof requirement, C04 owner alternatives, C07 Hermes ingress, C08–C10 настоящее Hermes feedback ownership, frame/exceptional условия, правильные TypeSpec owner и тестовые швы. Если обнаружено новое противоречие, менять **исходную стадию** и только затем ремонтировать descendants; не править архитектуру тайно в phase-файлах.

**S6 — CI и handoff:** проверить все PR по **последнему exact HEAD и проверенному checkout/merge SHA**. Основной ACE verification, OpenSpec structural, Security и Gateway audit vs QG6/CodeQL учитывать раздельно. QG6 ранее RED: 8 HIGH findings в старых файлах (`node-workspace-port.ts`, Harbor holdout scripts, `gateway-projection-http.ts` и др.). Не подавлять и не объявлять полный зелёный результат. Создать отдельную scoped security-задачу/предложение без посторонних source изменений в SDLC PR.

## 4. Acceptance matrix — доказательства, а не декларации

| ID | Необходимое наблюдение |
| --- | --- |
| HTEST-01 | Host Hermes в верном checkout, root/trust/skill index записаны |
| HTEST-02 | Реальный Skill invocation зафиксирован, не только Markdown read |
| HTEST-03 | Architecture-first с существующими DDD owners и G02 не нарушен |
| HTEST-04 | DAG accepts P01 и rejects C100/cycles/malformed/unknown |
| HTEST-05 | Per-phase AC exact mapping + complete spec AC coverage, invalid drift rejects |
| HTEST-06 | G11 C01…C10 все проверены на одном source SHA с actual exit |
| HTEST-07 | C02 no-second-send guard не подменён `MaxRetries=0` и не пропущен |
| HTEST-08 | PR #261→#264 имеют правильных родителей и чистый stage diff |
| HTEST-09 | Parent spec/design mutation даёт реальный STALE, child revalidates after repair |
| HTEST-10 | Sandbox squash/restack/retarget сохраняет child-only diff |
| HTEST-11 | One-phase Apply / G02 / provider egress реально блокируются без разрешения |
| HTEST-12 | CI/CodeQL и skipped tests честно привязаны к конкретным SHA |
| HTEST-13 | Session resume/checkpoint доказан или явно NOT_OBSERVED |

Для каждого: `PASS / FAIL / PARTIAL / BLOCKED / NOT_RUN` плюс настоящий log, команду, exit, SHA и ссылку. Структурный `READY_FOR_PHASE_REVIEW` ≠ G02 approval. Mock provider receipt ≠ actual provider-send proof. Skill file read ≠ Skill invocation. Нет автоматического merge, Bifröst-by-pass или исправления продукта.

## 5. Что предоставить владельцу

Один итоговый отчёт на русском с: (1) актуальные Git branches/base/heads, (2) Skill invocation matrix, (3) 10 phase checker results, (4) negative fixture matrix, (5) реальные sandbox staged PR/STALE/rebase observations, (6) нерешённые решения C04/C07 и условие C02, (7) CI/QG6 на exact SHA, (8) минимальные bugfix PR + причины и ретест, (9) remaining owner's decisions и (10) честный verdict `READY_FOR_OWNER_REVIEW / PARTIALLY_VERIFIED / BLOCKED / FAILED`. Не считать выполненными G11 Acceptance IDs и не запускать G11 Apply.

**Основная задача:** доказать жизнеспособность *самого skill-based SDLC конвейера*. Исходное испытание дало важные документы и ошибку checker, но не наблюдаемый Skill invocation и не эксперимент с parent drift. Именно эти пробелы ты обязан закрыть или воспроизводимо отметить препятствие.
