# Дополнительный аудит Reports, Users и feedback migrations — 2026-09-06

> Исторический аудит до исправлений. Текущее состояние и проверки: [результат реализации](results.md).

Приложение не менялось. Не выполнялись HTTP, операции БД, migrations, письма и вызовы Clerk. Изучены исходники и уже записанное родительским аудитом runtime-доказательство на изолированной копии. `admin-extra-repro.cjs` извлекает настоящие вычисления и handlers из TypeScript AST, запускает с in-memory mocks; `admin-extra-repro.txt`: PASS, 6 сценариев.

## ADM-01 — P1. Reports складывает денежные строки вместо сумм

- Источник DTO: `server/src/db/schema.ts:532` — decimal без numeric mode; `server/src/routes/invoice.ts:104-128` возвращает `invoices.amount` без преобразования, без поля total. `src/lib/api.ts:609-615,218-221` возвращает JSON без нормализации. Установленный Drizzle `node_modules/drizzle-orm/pg-core/columns/numeric.cjs:34-38,55-57` явно использует string и оставляет string при mapFromDriverValue. `pg` numeric parser в чистом repro также даёт string.
- Ошибка UI: `src/pages/admin/ReportsPage.tsx:60-61` неверно объявляет amount/total как number. Суммирование `:198,263-265,272-277,304` использует `+` без conversion.
- Воспроизведено настоящими AST expressions и pg parser: два paid invoice `100.25`, `200.75` → totalRevenue и monthly revenue `'0100.25200.75'`, currency display `$NaN` вместо $301.00. Один invoice может выглядеть правдоподобно из-за преобразования строки при форматировании; второй ломает итог.
- Влияние: Total Revenue, Revenue Growth/Trend, Top Clients и growth percent недостоверны.
- План: money DTO/adapter с однозначным представлением decimal (либо integer minor units); единая server aggregation, общие shared types; убрать утверждение number для непроверенного JSON. Не решать только Number() в одном виджете.
- Приёмка: 0/1/2+ invoices, string decimals, несколько клиентов/месяцев, нулевые amounts; сумма всех client/period buckets = total; ни NaN, ни конкатенации. Для финансовых значений сохранять центы, даже если компактный график округляет отображение.

## ADM-02 — P2. Reports читает несуществующие поля billable/isActive

- UI: `ReportsPage.tsx:52,281-283,490,762-775` читает `m.billable` и `c.isActive`. Реальные DTO: `/admin/team-members` возвращает `isBillable` (`server/src/routes/admin.ts:647,663`); `/services/clients` возвращает `status` (`server/src/routes/services.ts:338-354`), не isActive. `api.getClients()` направляет именно туда (`src/lib/api.ts:351-352`).
- Воспроизведено: команда с `isBillable=true` и `false` отображается 0 billable / 2 non-billable / 0% utilization; один active и один inactive client дают Active Clients = 2.
- План: shared response types + boundary validation; использовать canonical isBillable/status; отдельно определить utilization (сейчас это доля billable people, не доля использованных рабочих часов — либо корректно назвать, либо считать по capacity).
- Приёмка: смешанная команда и inactive client дают ожидаемые показатели на всех карточках; неизвестный status не считается активным молча; отсутствие обязательного DTO поля приводит к видимой диагностике, не к нулевой метрике.

## ADM-03 — P2. Revenue Growth сравнивает разные наборы клиентов и перекрывающиеся периоды

- Код: `ReportsPage.tsx:126-141` фильтрует текущие invoices по selectedClient; `:272-277` previousRevenue берёт все clients. `:267-270` всегда сдвигает даты на один месяц независимо от выбранного диапазона/granularity.
- Воспроизведено: selectedClient=1; в прошлом месяце client1=$100, client2=$900 → previousRevenue=$1000 вместо $100. При квартальном/годовом/custom диапазоне сдвиг на один месяц создаёт перекрытие и неверную базу сравнения. Это отдельный дефект после исправления money strings.
- План: единый filter DTO и previous-period helper; одинаковый client scope и предыдущий равный период (или явно подписанный YoY/MoM).
- Приёмка: фильтр одного клиента не меняется из-за invoices другого клиента; month/quarter/year/custom comparisons имеют непересекающийся корректный предыдущий период, включая февраль/leap day/end-of-month.

## ADM-04 — P2. Просроченные invoices в Reports превращаются в Draft

- Код: `ReportsPage.tsx:313-332` объявляет overdue, но любое состояние кроме paid/sent прибавляет draft; overdue вообще отсутствует в chart rows.
- Сценарий: сохранённый invoice status=overdue отображается на pie chart как Draft. Для sent с просроченной dueDate нет derived overdue check (`:320-322`).
- План: exhaustive canonical status mapping; единое правило overdue с invoice list/финансами; unknown state отображать отдельно, не маскировать под draft.
- Приёмка: paid/sent/draft/overdue и неизвестный status дают корректные сегменты, сумма count равна набору фильтрованных invoices.

## ADM-05 — P1. Feedback блокируется отсутствующей колонкой: миграционный путь не соответствует runtime schema

- Runtime на изолированной копии, подтверждение уже выполненного родительским аудитом запроса: `output/audit-2026-09-06/api-repro.json:195-197` — `/feedback/admin` HTTP 500. `output/audit-2026-09-06/server.log:758-770` — `column feedback.client_service_id does not exist`, PostgreSQL 42703.
- Требуемая текущая схема: `server/src/db/schema.ts:412-425`: client_service_id, admin_response, admin_responded_by, admin_responded_at. Admin/client feedback selects и joins требуют эти поля (`server/src/routes/feedback.ts:17-50,85-104`); create пишет clientServiceId (`:278-290`), response пишет admin fields (`:314-322`). Это ломает не одну карточку, а чтение/создание/ответ при старой схеме.
- Единственный CREATE feedback в versioned SQL — `server/drizzle/0000_jittery_quicksilver.sql:53-63`, без этих четырёх колонок. Во всех `server/drizzle/*.sql` ALTER feedback с ними отсутствует. Их нет отдельной миграцией в journal.
- Они добавлены ad-hoc **только** в manual runner `server/src/migrate.ts:159-168`. Startup runner `server/src/index.ts:95-112,132-138` вызывает Drizzle и ensure user/contacts/finance/ClickUp/project bot; feedback ensure отсутствует. Поэтому запуск через npm dev/start с прежней БД проблему не закрывает.
- Дополнительный clean-install дефект: manual runner сначала выполняет schemaFixes (`migrate.ts:171-178`), а лишь потом Drizzle (`:182-184`). На пустой БД feedback ещё нет → ALTER errors проглатываются → Drizzle создаёт старую feedback → отсутствующие колонки не проверяются повторно. При существующей feedback успешный manual run способен исправить её. Render сейчас запускает manual migration перед start (`render.yaml:7`), поэтому без production-проверки нельзя заявлять, что **production** имеет этот дефект. Подтверждён isolated clone, плюс дефект воспроизводимости startup/clean install по коду.
- Journal gap шире feedback: 10 SQL файлов `0026`–`0035` не зарегистрированы (`server/drizzle/meta/_journal.json:180-199` перепрыгивает 0025 → 0036 → 0037): documents folders, transactions, integrations, timezone/preferred shifts, overrides, calendar visibility, finance categories, field cleanup, Clerk user id, ClickUp. Некоторые компенсируются ensure*; это не повод считать все 10 сломанными, но канонический migration ledger неполон. У 0036 timestamp также меньше 0025 — требует проверки применённой истории до исправления, а не переписывания прошлых записей.
- План: новая additive versioned migration для feedback полей/FK/indexes с монотонным timestamp и journal entry; canonical миграционный путь; верификация схемы после миграции; критическая ошибка должна завершать deployment неуспехом. Review и reconcile уже применённых ad-hoc изменений и незарегистрированных SQL, не запускать их слепо повторно на production.
- Приёмка: fresh DB и upgrade from pre-feedback snapshot получают одинаковую schema; повторный migrate идемпотентен; изолированные admin list, client own list, submit general/employee feedback, admin respond и client read response дают 200/201 и сохраняют значения. Smoke/health не green при отсутствующих требуемых колонках.

## ADM-06 — P2. Users edit принимает новый password, ничего с ним не делает и сообщает success

- UI явно обещает `Password (leave empty to keep current)` (`src/pages/admin/UsersPage.tsx:681-690`). Handler формирует updateData без password (`:173-182`), затем имеет пустой if с комментарием skip (`:184-188`) и сообщает success (`:190-193`).
- Воспроизведено AST-extracted handler: непустой password → api.updateUser вызван без password, success alert. Никаких настоящих записей/API не выполнялось.
- Backend generic PUT поддерживает локальный password hash (`server/src/routes/users.ts:343,365-368`), но слепо подключить его к UI недостаточно: основной вход работает через Clerk (`src/App.tsx:68-76,159-164`, `src/pages/AuthPage.tsx:78-102`). Смена локального пароля не сменит Clerk credential.
- План: отображать identity provider и поддерживаемое действие (Clerk reset/invite или явно legacy local reset); убрать ввод, который не исполняется. При provider action результат/ошибка должен соответствовать фактической операции. Для legacy local UI использовать admin reset path с audit; не просить старый пароль пользователя у администратора.
- Приёмка: Clerk-user получает рабочее provider reset action; local-user только при поддерживаемом legacy flow действительно меняет credential; success недопустим без фактического выполнения; пустое поле ничего не меняет.

## ADM-07 — P2. Users creation требует бессмысленный local password при обязательном Clerk sign-in

- `UsersPage.tsx:129-145` требует username/password до API. API уже допускает password/username optional: `server/src/routes/users.ts:276-303`; `userService.ts:47-48,100-118` генерирует username от email и random local password при отсутствии, но всегда создаёт local row/authProvider=local; Clerk user/invitation этим путём не создаётся.
- AuthPage говорит: local password registration removed, use invited/existing Clerk account (`AuthPage.tsx:78-102`). App не допускает local session без signed-in Clerk (`App.tsx:68-76,159-164`). Clerk sync умеет привязать **существующего** Clerk пользователя по email (`server/src/routes/auth.ts:139-186`). Поэтому новый local row с введённым admin password не гарантирует готовый вход, а для уже существующего Clerk user этот password лишний.
- Воспроизведено handler: пустой local password блокирует create до API, несмотря на заполненные email/name/role и backend support.
- План: привести create-user к выбранной identity модели: создать внутренний доступ по email/role/member/client assignments, привязать или пригласить через Clerk, показывать pending/linked/active. Не выдавать local password за рабочие учётные данные Clerk. Если legacy auth оставляется, явно разделить режимы и UI.
- Приёмка: admin создаёт доступ без local password; invited/existing Clerk user входит именно с заданной ролью и team/client scope; pending invite понятен; duplicate/failed invite не создаёт ложное состояние «готов к входу». Реальную отправку приглашений выполнять только в согласованном test recipient/environment.

## ADM-08 — P2. Reports маскирует неудавшуюся загрузку под нулевые данные

- Код: `ReportsPage.tsx:98-123` извлекает data с default=[] и isLoading, но ни один query error; после loading показывает KPI/empty state (`:351-369` и далее).
- Сценарий: invoices/team/services endpoint 500/403 → после retries отображаются $0/0 members/no data вместо ошибки. В сочетании с поломанной schema это особенно вводит администратора в заблуждение.
- План: per-query error state + retry; отличить zero result от unavailable; partial dashboard явно помечает недоступный блок и не строит производные KPI из неполных данных.
- Приёмка: искусственные 500/403/timeout показывают причину и retry; доступные блоки остаются читаемыми; финансовая сумма не заменяется нулём при ошибке.

## Что подключено и порядок фиксов

Reports действительно получает invoices/team/clients/services и имеет frontend filters/charts, но вычисления/контракты выше нарушены. Users create/update/status/membership операции имеют реальные API; конкретно password edit — заглушка. Feedback endpoints реализованы, но изолированная БД не соответствует используемой схеме.

1. ADM-05: восстановить воспроизводимую schema на isolated database и включить feedback runtime smoke.
2. ADM-01..04,08: общий DTO/decimal aggregation/filter contract, затем все reports labels/charts/errors.
3. ADM-06..07: привести onboarding/reset к Clerk, с ясным состоянием приглашения/привязки.
4. Acceptance через независимые fixtures: 2 clients active/inactive, 2 people billable/non, 2 invoices с decimal cents, paid/overdue states, selected-client previous period, API failures, existing/new Clerk identity; внешние рассылки тестов отключены.
