# Аудит зарплат, финансов, инвойсов и reimbursements — 2026-09-06

> Исторический аудит до исправлений. Текущее состояние и проверки: [результат реализации](results.md).

## Область и ограничения доказательств

Проверены исходники UI → API → схема БД, существующие вычисления и связи между ними. Рабочие данные не читались и не изменялись, HTTP-запросы и отправка писем не выполнялись. Приложение не модифицировалось. Применимых AGENTS.md в корне/вложенных каталогах и родителях Projects, home не обнаружено. Проверки ниже различают воспроизведённые чистыми функциями дефекты и выводы из трассировки кода. Наличие реальных API и таблиц не доказывает успешную работу на текущем deployment.

Воспроизводимый harness: `node output/audit-2026-09-06/payroll-repro.cjs`; результаты: `payroll-repro.txt`. Он извлекает настоящие функции из TypeScript AST и настоящие фрагменты invoice calculator, не импортируя приложение/БД. Финальный запуск: PASS, 6 наблюдаемых расхождений. Последняя историческая ставка в выводе — отдельно отмеченный пример формулы из UI, не запуск API.

## Общий вывод

Сейчас зарплатный раздел является ручным журналом выплат с клиентским расчётом предполагаемого долга. Полноценного серверного начисления по ставке на нужную дату, табелю, оплачиваемым/неоплачиваемым отсутствиям и утверждённому периоду нет. Реальные действия записи, редактирования, удаления и истории присутствуют, но текущие инварианты не позволяют считать результат надёжным payroll ledger. Счета клиентам имеют подтверждённое расхождение между preview и сохраняемой детализацией.

## Подтверждённые проблемы

### PAY-01 — P1. Сервер не защищает от повторной/лишней/некорректной выплаты

- Код: `server/src/routes/finances.ts:697-706,723-746`; generic обход: `:361-390,425-445`; структура `server/src/db/schema.ts:260-273`.
- `/salaries/record` проверяет лишь truthy employee/amount/date и наличие сотрудника, затем вставляет сумму. Нет серверной проверки положительности, соответствия `amount = paidBase + extras`, лимита остатка, проверки salaryMonth, блокировки начисления на период или idempotency key. Параметры salaryMonth/base/paidNow/remaining служат только письму (`:758-771`).
- Сценарий: два администратора открывают одну месячную выплату и каждый записывает полный остаток; повтор того же запроса также создаёт отдельную транзакцию. В UI в обеих вкладках всё допустимо. Это доказано кодом, не запускалось с БД.
- Влияние: двойная выплата/учёт; сервер способен сохранить отрицательную сумму и произвольные несовпадающие детали. Generic transaction update позволяет обходить любую будущую проверку salary endpoint, если оставить его без общего правила.
- План: серверный payroll service; обязательная схема запроса и decimal money; период/начисление с блокировкой и атомарным контролем остатка; уникальный idempotency key; единый mutation path для salary вместо generic unrestricted updates. Явная корректирующая проводка для уже закрытого периода.
- Приёмка: параллельные полные выплаты дают одну запись + конфликт; повтор ключа возвращает тот же результат; отрицательные/NaN/невалидная дата/неизвестный период/несовпадающий total отклоняются до записи; ошибка email не создаёт повторную выплату.

### PAY-02 — P1. Зарплатные данные хранятся в свободном description и портятся обычным текстом

- Код: `src/pages/admin/FinancesPage.tsx:478-553,1313-1323,1482-1503`; `server/src/routes/finances.ts:697-703,727-733`; schema `server/src/db/schema.ts:260-273`.
- salaryMonth, plannedBase, paidBase и extras не имеют типизированных колонок/строк начисления. UI восстанавливает их regex-ами из `description` и разделяет по `+`. При отсутствии формата месяц берётся из даты фактической выплаты, база — из amount.
- Воспроизведено harness: выплата `Health + Dental: $100` парсится как `Dental: $100`; default `Health + Dental` считается неоплаченным и снова предлагается к выплате $100. Note `project A + project B` при редактировании остаётся `project A`.
- Влияние: повтор доплаты, потеря пояснений, изменение зарплатного периода/остатка при редактировании текста или импорте старого платежа. Изменение финансовых данных зависит от пунктуации.
- План: payroll periods/accruals/payment allocations/extras как структурированные поля; description только вывод. Однократная миграция с маркировкой неоднозначных legacy записей для сверки; суммы платежей не «угадывать» молча.
- Приёмка: любой Unicode и `+`, `—`, `:`, currency symbols в названиях/заметках переживают save → reload → edit; сумма/период неизменны; legacy records явно требуют reconciliation, если парсинг ненадёжен.

### PAY-03 — P1. Исторический долг пересчитывается по сегодняшней ставке и сегодняшним extras

- Код: `src/pages/admin/FinancesPage.tsx:1364-1389,1411,1437-1451`; `server/src/routes/finances.ts:1106-1133`; история возвращается только endpoints `:1235-1253,1303-1317`.
- Для любого неоплаченного месяца UI берёт `member.monthlyRate` и текущие monthlySalaryExtras. Rate history не загружается `/salaries` и не участвует в начислениях. `effectiveDate` сохраняется в истории, но изменение `teamMembers.monthlyRate` происходит немедленно независимо от неё.
- Сценарий: январь/февраль были по $1000 и не оплачены; в сентябре установить $2000 + $50 subscription. Старые месяцы становятся по $2050. Если повышение вступает только в октябре, текущая сентябрьская форма всё равно сразу предлагает новую ставку. Для частично оплаченного месяца базой становится первая найденная description-запись, а extras всё равно сегодняшние.
- Влияние: исторический долг/аванс неверны; будущие ставки работают заранее; нет проставленного снимка начисления.
- План: effective-dated salary contracts и extras; сервер определяет условия на payroll period, учитывает явно согласованное правило изменения внутри месяца; закрытые начисления неизменны, корректируются отдельным adjustment.
- Приёмка: повышение в сентябре не меняет январь; effective date в будущем не меняет текущую ставку; backdated rate change запускает понятный пересчёт только открытых периодов; изменение названия subscription не создаёт старый долг заново.

### PAY-04 — P1. Ввод extras допускает деньги без названия, а невалидные суммы проходят клиентскую проверку

- Код: `src/pages/admin/FinancesPage.tsx:1396-1404,1489-1492,3388-3406`; API нормализатор `server/src/routes/finances.ts:96-114`.
- Общая сумма берёт каждый extra.amount, но описание включает строку только при наличии label AND amount. `salaryCanSave` не валидирует все компоненты; `min=0` на input не заменяет проверку, сохранение выполняет обычный onClick.
- Воспроизведено: base/payment $1000 + extra $50 с пустым label → `salaryCanSave=true`, total $1050; extra исчезает из description и server email extras.
- Влияние: выплаченная сумма не соответствует расшифровке; последующее редактирование теряет безымянные $50. Аналогично отрицательные компоненты не запрещены логикой save.
- План: одинаковая строгая component schema на UI/server; исключить незаполненную строку из total либо требовать её заполнить; запретить отрицательные компоненты кроме явного signed adjustment type.
- Приёмка: строка с суммой без названия не сохраняется; total совпадает с суммой сохранённых строк после повторного открытия; negative/base/zero и decimal edge cases проверяются на сервере.

### INV-01 — P1. Preview счёта и сохранённые строки расходятся при выборе людей и режима оплаты

- Код preview: `server/src/routes/invoice.ts:895-925,943-967`; create `:382-437`; update `:570-627`; UI removal `src/components/EnhancedInvoiceForm.tsx:341-365`, mode changes `:695-724`, submit `:520-529`.
- Preview фильтрует assignment по наличию ключа developerRates. Create/update заново выбирают всех active assignments и не применяют этот фильтр: удалённый в UI сотрудник возвращается в сохранённые строки.
- Create/update используют `devRates.fixedPrice || stored.fixedPrice` и приоритет любой положительной fixedPrice. Preview уважает explicit 0 и hourly mode.
- Воспроизведено извлечёнными настоящими вычислениями: сохранённый fixedPrice $4000, пользователь выбрал hourly $25 × 10h → preview $250, saved detail $4000. Explicit fixedPrice=0 → preview 0, saved detail $4000. В заголовок invoice.amount пишется присланный frontend amount (`:349-352`), а не сумма реально сохранённых строк, поэтому один счёт имеет разные итоги.
- Добавление не назначенного на сервис человека меняет только local state (`EnhancedInvoiceForm.tsx:391-430`), сервер считает/сохраняет только имеющиеся assignments: добавленный человек исчезает из серверной калькуляции.
- План: один общий серверный invoice calculator для preview/create/update с явным list of lines, stable assignment IDs и rateMode; `??`/presence semantics; сохранять рассчитанный сервером total и snapshot line items атомарно. Добавить человека в invoice line можно только через выбранную разрешённую модель назначения, без неявного изменения команды.
- Приёмка: remove/add developer, hourly ↔ fixed, zero, default rate, один человек в двух проектах и разные assignment IDs; preview = stored total = sum line items = клиентский invoice view после reload.

### FIN-01 — P1. Клиентские платежи попадают в неправильный период; paid без даты исчезает из финансов

- Код: `server/src/routes/finances.ts:206-219,241-253,561-575`; UI actual date `src/pages/admin/FinancesPage.tsx:1194-1206`. Paid status допускается отдельно: invoice create `server/src/routes/invoice.ts:340-360`; UI selector `src/components/InvoiceList.tsx:449-464`, paidAt field `:514-520`.
- Фильтры и monthly bucket используют invoiceDate, несмотря на `paidAt IS NOT NULL` и отображение строки по paidAt. Счёт от августа, оплаченный в сентябре, включается в августовские client payments и отсутствует в сентябрьских.
- Смена только status на paid с пустым paidAt сохраняется, но полностью исключается из finance overview/client-payments.
- План: определить cash/accrual явно. Для Client Payments использовать paidAt/payment transaction date; для начисленной выручки — отдельный отчёт. Единый payment event, paid state derive из оплаты либо строгая дата при ручном mark-paid.
- Приёмка: invoice August / payment September присутствует в September cash report и не August; одинаковые даты/суммы в таблице и диаграмме; paid без даты невозможно; частичная оплата не приравнивается к полной.

### REIM-01 — P1. «Total Paid» означает загруженный чек, а фактическая выплата не учтена

- Код: upload `server/src/routes/reimbursements.ts:1098-1114` меняет approved → confirmed; `src/pages/admin/AdminReimbursements.tsx:196-204,260-264` считает confirmed как Total Paid. `server/src/db/schema.ts:490-510` не содержит payment link/paidAt/paid amount; route не вставляет financialTransactions.
- Сценарий: сотрудник загрузил чек после approval, деньги ещё не отправлены. UI уже увеличивает Total Paid, но расход в Finances не возникает. Если бухгалтер добавит вручную salary extra, reimbursement остаётся не связанным с проводкой; защита от повторной выплаты невозможна.
- Влияние: интерфейс неверно сообщает факт оплаты; касса и задолженность по компенсациям не сверяются. Кроме того Total Paid считает requests всех годов независимо от выбранного yearFilter.
- План: отделить evidence_confirmed/ready_for_payment/paid; payment allocation с FK к financial transaction/payroll component; показывать подтверждённое обязательство и фактически оплаченную сумму отдельно; применить годовой фильтр к показателям.
- Приёмка: upload receipt не увеличивает Paid; одна оплата в зарплате закрывает reimbursement ровно один раз и отражается одним расходом; смена года согласованно фильтрует list и totals.

### REIM-02 — P1. Параллельные reimbursement requests обходят годовой лимит

- Код: `server/src/routes/reimbursements.ts:297-342,355-369`; approval `:804-819` не перевалидирует лимит.
- До insert лимит вычисляется отдельным select, нет transaction/locking/idempotency. Два одновременных запроса видят один остаток и оба резервируют его. Например остаток $100, два expense $200 → каждый резервирует $100, общий выход за лимит $100.
- План: атомарно блокировать entitlement сотрудник/careerYear, валидировать остаток и резервировать; idempotency key; state changes conditional on expected prior state, чтобы approve/reject не перетирали друг друга.
- Приёмка: два параллельных запроса не выходят за лимит; повтор запроса не дублирует; reject возвращает резерв ровно один раз; конфликтующие approve/reject дают один подтверждённый переход.

### FIN-02 — P2. Диаграммы и Total Expenses игнорируют extra_payment, хотя backend включает его в P&L

- Код backend `server/src/routes/finances.ts:259-273,299-304`; UI `src/pages/admin/FinancesPage.tsx:1687-1689,1695,1706-1708,1717-1719,1728-1730`.
- Для legacy/imported/API transaction type extra_payment сумма входит backend netProfitLoss, но UI Total Expenses, monthly expenses и cumulative P&L пропускают её. Type всё ещё допускается schema/generic API.
- Сценарий: только extra_payment $100 → Net P&L -$100, Total Expenses $0, cumulative chart $0.
- План: единый набор totals из backend; либо миграция/запрет extra_payment с сохранением категории, либо явное включение во все суммы и charts.
- Приёмка: income − total expenses = net P&L = cumulative за одинаковый период для всех типов, включая legacy.

### FIN-03 — P2. Checkbox recurring сохраняет только флаг и не делает транзакцию повторяющейся

- Код UI `src/pages/admin/FinancesPage.tsx:3252-3266`; server create/update `server/src/routes/finances.ts:390,445`; schema `server/src/db/schema.ts:270`.
- Поиск `isRecurring` в server/src показывает только schema, CRUD, audit. Нет периода, nextRun, schedule или генератора финансовых записей.
- Влияние: видимое обещание recurring не реализовано как автоматическое повторение. Если это только метка, интерфейс этого не объясняет.
- План: либо обозначить как метку recurring expense без обещания автоплатежа, либо добавить schedule/runs/idempotency/end date, preview next occurrence и формирование обязательств.
- Приёмка: выбранная семантика явно описана; при автоматическом режиме следующий период появляется один раз и может быть остановлен.

### FIN-04 — P2. История зарплат и фильтры журнала скрывают корректировки под другим типом

- Код edit/delete вызывают generic API: `src/pages/admin/FinancesPage.tsx:1498-1503,1557-1563`; backend пишет `transaction_updated`/`transaction_deleted`, entityType `transaction` (`server/src/routes/finances.ts:474-486,527-539`). UI предлагает фильтры `salary_payment_updated`/`salary_payment_deleted` и `salary_payment` (`FinancesPage.tsx:2830-2832,2848`).
- Сценарий: изменить/удалить salary через Salary tab, отфильтровать Finance Activity Logs по соответствующему salary action → запись не найдётся. Она есть только как generic transaction event.
- Также /salaries recentPayments ограничен 50 записями всех лет (`finances.ts:633-648`), год salary tab не фильтрует Payment History; старые payments за пределами последних 50 недоступны для редактирования в этом списке.
- План: семантические salary events для любых salary mutations; фильтры только для реально генерируемых событий; пагинация и явный year/month для payout history.
- Приёмка: создание/изменение/удаление зарплаты находится одинаково в card History и global salary filters; старые выплаты доступны через пагинацию/период.

### REIM-03 — P2. Сотруднику показываются разные доступные суммы компенсаций

- Код: `/limits` резервирует pending + approved + confirmed (`server/src/routes/reimbursements.ts:120-122,145-153`); EmployeeDashboard считает used только approved + confirmed (`src/pages/employee/EmployeeDashboard.tsx:179-181,278-279`).
- Сценарий: лимит $300, pending request $100. Reimbursements показывает $200 available, Dashboard — $300 remaining.
- План: общий server entitlement DTO с allocated/reserved/used/available и единые labels для всех виджетов.
- Приёмка: при pending → approved → evidence → paid → rejected/cancelled каждый экран показывает одинаковый доступный остаток и раздельную резервацию.

## Функциональные пробелы относительно требуемого точного учёта — правила нужно формализовать

Эти пункты не означают, что выбранная бизнес-политика неверна: текущая реализация не содержит данных/расчёта, позволяющего подтвердить её.

1. **Начисление зарплаты и табель (высокий приоритет):** `/salaries` читает только teamMembers и financialTransactions (`finances.ts:598-684`), UI использует monthlyRate. Ни shifts/breaks, ни ClickUp time, ни leave requests/paid flag не участвуют. Hourly employee без monthlyRate автоматически не получает сумму даже с отработанными часами. Ставку помесячно можно ввести вручную, но это не проверяемое автоматическое начисление.
2. **Источники часов и двойной учёт:** есть `time_entries` (`schema.ts:211-220`), `clickup_time_entries` (`:350-372`) и actual shifts/breaks (`:617-639`). Нет payroll source-of-truth, approval/lock периода и распределения часов между несколькими активными проектами для начисления. Требуется определить, что оплачивается: присутствие по shifts, утверждённый ClickUp time или ручной табель; одно время не суммировать дважды. Invoice hours также приходят вручную, не из календаря (`invoice.ts:410-418,923-925`).
3. **Неполный месяц/найм/неоплачиваемый отпуск:** долг стартует по `startDate.slice(0,7)` и начисляет полный месяц (`FinancesPage.tsx:1366-1382`); нет prorating в этом расчёте. Статус сотрудника не ограничивает долг; общего employment endDate в teamMembers нет. Необходимо утвердить пропорцию и правила paid sick/vacation/unpaid, праздников, сверхурочных, перерывов, изменения ставки внутри месяца.
4. **Валюта:** UI жёстко USD (`FinancesPage.tsx:336-340`); salary/transactions/invoices schema не содержит currency (`schema.ts:66-68,260-273,528-544`). Для только USD это допустимое ограничение, для разных валют нельзя суммировать суммы без currency и dated conversion policy. Курс и налоги не следует придумывать.
5. **Кабинет сотрудника:** обнаружен salary email (`finances.ts:758-773`), но нет employee payroll endpoint/page в employee pages. Требуемую прозрачность обеспечат payslip по периоду, утверждённые часы/отсутствия, компоненты начисления, аванс/остаток, фактические выплаты; доступ только к своему teamMemberId. Это дополнение к текущему интерфейсу, не существующая сломанная кнопка.
6. **Record Payment:** endpoint регистрирует запись и письмо, не инициирует банковский перевод. Лейбл Record корректен для ручного подтверждения факта; нельзя называть это интеграцией автоматической выплаты. Требуются payment reference/date/status и reconciliation, если система должна подтверждать фактический перевод.

## Что уже реализовано в UI → API, с оговоркой о runtime

| Операция | Что реально подключено | Ограничение проверки |
|---|---|---|
| Salary cards, year selection, YTD totals | GET `/finances/salaries`; реальные teamMembers/transactions | YTD по cash transactionDate, debt по ненадёжному тексту/текущим условиям |
| Record Payment / Advance | POST `/finances/salaries/record`; транзакция + audit; salary email с обработкой неудачи | Нет серверного остатка/idempotency; не банковский перевод |
| Edit/Delete Salary | Generic PUT/DELETE financial transaction, обновление списка | Инварианты и event types неверны; destructive operations не запускались |
| Rate / Default Extras / History | Данные сохраняются, есть effectiveDate history и audit | История ставок не определяет accrual; будущая дата применяется сразу |
| Manual income/expense CRUD/categories/search/filter | Реальные REST CRUD и audit logging | Валидация amount/type слабая; recurring только метка |
| Finance overview/charts | Агрегация SQL transactions + paid invoices | Ошибка дат Client Payments и omission extra_payment |
| Invoice create/edit/detail + manual/service mode | Реальные invoice/service/developer tables и transactions | Preview != persisted details в описанных случаях |
| Reimbursement request / approve / reject / receipt | Реальные endpoints, лимит 50% до остатка, права admin/owner для операций | Нет атомарной резервации и факта платежа; upload не запускался |
| Reimbursement limit across career years | careerYear и pending reservation в `/limits` | Dashboard использует другую метрику available |

## Очерёдность реализации и приёмки

1. **Структура payroll и сверка существующих денег:** задать currency/pay basis/time basis/leave policies; structured accruals + components + payment allocations; миграция legacy descriptions с reconciliation report. Никаких автоматических перерасчётов закрытых периодов без review расхождений.
2. **Серверные денежные инварианты:** PAY-01..04 и REIM-02, единая decimal arithmetic, period locks, идемпотентность, transactional audit. Тесты concurrent/retry нужны до запуска новых write flows.
3. **Начисление по календарю:** единый утверждённый источник часов, per-day overlap resolution (shift/break/leave), prorating и ставки на дату; табель/пояснение суммы и статус периода; сохранение снимка расчёта.
4. **Согласование инвойсов и финансов:** INV-01, FIN-01/02; единый калькулятор; invoice cash payment events; проверка sum(line items)=total на server и после reload.
5. **Reimbursements до фактической выплаты:** REIM-01/03, payment linkage, total labels/filters, исключение повторной оплаты через salary extra.
6. **Прозрачность UI:** employee payslip, сверяемый долг и payment history; FIN-03/04; все ошибки save видимы пользователю (сейчас salary catch во многих местах только console.error, например `FinancesPage.tsx:1528-1530,1564-1565`).
7. **Изолированная интеграционная матрица:** тестовая БД/fixture, запрет внешних notifications; затем browser E2E тремя ролями. Сотрудники monthly/hourly, два проекта, смена ставки 15-го, будущая ставка, hire/end mid-month, paid/unpaid sick/vacation, half-day, overnight + timezone/DST, paid/unpaid breaks, перекрывающиеся timesheets, два аванса, повтор concurrent request, correction после закрытия, reimbursement в авансе и финале, invoice preview/reload, late client payment, currency mixed rejection. Данные проверки не должны попадать в production.
