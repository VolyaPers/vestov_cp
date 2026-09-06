# Аудит кабинета сотрудника, календаря, отпусков и смен — 2026-09-06

> Исторический аудит до исправлений. Текущее состояние и проверки: [результат реализации](results.md).

Проверка кода текущего checkout, схемы БД, маршрутов и существующих тестов. Внешние сервисы и БД не изменялись. Здесь «подтверждено» означает доказанный путь в коде; 5 дополнительных изолированных проверок исполнили функции, извлечённые из исходников, с фиктивными зависимостями. Это не утверждение о пройденном end-to-end на развёрнутом сайте. AGENTS.md внутри проекта и в поиске по соседним проектам для Vestov HUB не найден.

## Что действительно подключено в интерфейсе

| Действие / экран | Реальная реализация | Статус аудита |
|---|---|---|
| Dashboard: профиль, остаток отпуска, компенсации, roadmap | 4 GET через Promise.all, ручной расчёт остатка | Подключено; неверный остаток отпуска E08; любая ошибка одного запроса обрушает весь dashboard |
| My Profile: Edit / Save / Cancel; телефон, location, bio | GET vacation/my-profile → PUT admin/team-members/:id | Подключено, whitelist полей есть; рассинхронизация email/teamMemberId E13 |
| Dashboard: timezone, preferred shifts, переключение рабочего дня, Copy Monday to all, Save Shifts | PUT shifts/timezone/me, PUT shifts/preferred/me | Подключено; сохранение ломается после смены с FK E06; ошибки сохранения только console, stale props E14 |
| Sidebar: Start / Break / Resume / End, confirmation и hold 3s | POST shifts/start, break/start, break/end, end | Реальные записи и socket/Slack вызовы есть; race conditions E09, ошибочный late/missed E07, notes теряются E15 |
| My Calendar: Balance / Calendar / Requests; prev/next/Today | EmployeeVacations.tsx, отпуск/баланс/расписание/overrides GET | Подключено; недостоверные статусы E10, TZ E14, пропавшие выходные E11 |
| Calendar: + leave request и Submit Request в отдельной вкладке | POST vacation/requests | Подключено; first-year block E01, баланс/циклы E02–05, чужие employeeId E12 |
| Calendar: click shift / Day Off / save / reset | PUT и DELETE shifts/overrides/me/:date | Реальные записи есть; overrides не учитываются late/missed; выходные и праздники недоступны для override |
| Calendar: кнопка уже существующего отпуска | Рендерит `<button>`, onClick отсутствует | Не работает: не открывает детали, редактирование или отмену E10 |
| My Leave Requests | История, status, reason, decisionReason, old/future cycle | Просмотр подключён; у сотрудника нет UI отмены/редактирования уже отправленного запроса |
| Roadmap | GET roadmap + стаж/льготы | Подключено; 365-day стаж против anniversary cycles E16 |
| Sick leave balance сотрудника | API есть, в EmployeeVacations карточка sick leave закомментирована | Нельзя видеть остаток sick leave в актуальном календаре; отдельная VacationBalanceCard показывает отпуск |
| Фактическая история смен и ручная корректировка time entries сотрудником/админом | GET history существует; в актуальном employee UI нет таблицы факта/коррекции, shift API не содержит edit actual shift | Пробел функционала, не выдаётся за сломанную существующую кнопку |

Актуальный маршрут `/employee/vacations` открывает EmployeeVacations (`src/components/TeamMemberLayout.tsx:150–155`). Старые EmployeeCalendar.tsx и EmployeeLeaveRequest.tsx не подключены; их дефекты не включены в число ошибок актуального интерфейса.

## Подтверждённые дефекты и план

### E01 — P1 — Первый год: любой отпуск во втором полугодии отклоняется при положительном балансе

`server/src/utils/vacationBalanceCalculator.ts:383–391` выставляет firstHalfRemaining=totalRemaining и secondHalfRemaining=0 для первого года. Но валидатор на `:696–705` всегда выбирает остаток полугодия по дате, не учитывая исключение первого года. UI обещает доступность всех 16 дней в первый год.

Воспроизведение: стаж менее года, активный цикл 01.01–31.12, не использовано ни дня; запрос 1 дня на 07.09. Получено в source-derived probe: `allowed:false`, «Only 0.0 days available … You have 16.0 total days».

Фикс: валидировать первый год через totalRemaining; полугодовую политику применять с явно заданного года. Acceptance: 1 день после midpoint первого года проходит, 17 дней при остатке 16 — нет; UI и API показывают одинаковый остаток.

### E02 — P1 — Будущие и неактивные циклы пропускают любой размер отпуска; будущий approve выключает текущий цикл

`vacationBalanceCalculator.ts:659–670` возвращает allowed=true без проверки при будущем или неактивном цикле; `:686–689` делает то же для другого цикла. Утверждение в комментарии о будущей проверке не реализовано автоматическим job. `server/src/routes/vacation.ts:1758–1775` уже при одобрении будущего отпуска деактивирует все циклы и активирует будущий. `/employment-cycle/:id` и `/balances/:id` требуют одновременно isActive и попадание сегодняшней даты (`:692–695`, `:741–744`), поэтому после approve будущего отпуска текущий цикл и balances становятся 404; sick calculator начнёт читать будущий цикл.

Воспроизведение: запрос на 365 дней в будущем/неактивном прошлом цикле — обе изолированные проверки получили allowed=true. Approval отпуска следующего года до его начала исполняет указанную смену isActive.

Фикс: отделить текущий цикл от периода заявки; проверять каждый период по собственной аллокации, не переключать текущий цикл при бронировании. Acceptance: будущий отпуск ограничен будущей квотой; после его approve текущий vacation/sick balance и cycle неизменны; будущая заявка видна отдельно.

### E03 — P1 — Разные способы approve/edit обходят правила баланса, статуса и конкурирующих запросов

Обычный approve `vacation.ts:1633–1738` проверяет pending и баланс. Admin create-and-approve (`:1350–1424`) проверяет даты/overlap, затем сразу пишет approved; admin edit (`:1467–1558`) не перепроверяет квоту; bulk action (`:3306–3339`) напрямую пишет approved/denied/canceled без загрузки предыдущего статуса или проверки баланса. Обычный approve тоже не использует транзакцию/блокировку: два запроса могут одновременно проверить один остаток и оба записать approved (`:1664`, `:1785`).

Воспроизведение: при 1 доступном дне создать admin calendar отпуск на 10 дней с autoApprove; либо создать несколько pending запросов и bulk approve все; либо увеличить уже approved запрос с 1 до 10 дней. Код не содержит блокирующей проверки. Concurrent approval — риск целостности, отдельно не прогонялся против БД.

Фикс: общий транзакционный сервис переходов состояния, пересчёт/locking на сотруднике+цикле, единые проверки для create, edit, одиночного и массового approve; если бизнес разрешает превышение — явный override с причиной и журналом. Acceptance: все пути дают одинаковый результат; повтор/параллельное подтверждение не удваивает списания и не допускает превышения.

### E04 — P1 — Пересечение типов отпуска и переход через границы периода учитываются неправильно

Overlap фильтруется по одному leaveTypeId (`vacation.ts:1273–1281`, `:1388–1396`, `:1514–1523`): Vacation и Sick Leave на те же дни разрешены одновременно. Расход vacation целиком относится к циклу и полугодию даты начала (`vacationBalanceCalculator.ts:254–260`, `:354–367`); generic balances, наоборот, не считают заявку вообще, если endDate вышла за границу цикла (`vacation.ts:785–789`). Sick calculation также относит весь расход к startDate (`sickLeaveBalanceCalculator.ts:91–100`).

Воспроизведение: approved Vacation 30.06–02.07 пересекает midpoint — 3 дня уходят в первое полугодие. 31.12–02.01 — один экран учитывает 3 дня в старом цикле, другой 0. Второй Sick Leave на эти же даты проходит overlap.

Фикс: нормализовать отсутствие до дневных/полудневных интервалов, разбивать расход по циклам/полугодиям; явный процесс замены vacation на sick leave. Acceptance: один интервал отсутствия списывается ровно один раз; сумма частей равна количеству дней; generic/card/payroll получают одинаковые части.

### E05 — P1 — Админская настройка квоты отпуска не является источником истины

`vacationBalanceCalculator.ts:201–223` берет hardcoded 16/20/24 по стажу и из leaveBalances читает только adjustmentDays, игнорируя totalDays. Generic `/balances/:id` использует именно totalDays (`vacation.ts:811–822`). При создании циклов default Vacation=20 (`vacationBalanceCalculator.ts:566–583`, `vacation.ts:289–306`). Настройки leaveAllocationSettings учитываются при создании rows, но основной vacation calculator их totalDays не использует.

Воспроизведение: админ выставляет totalDays=30; основной employee balance/валидатор продолжает использовать 16/20/24, generic balance показывает 30. Для первого года после автоинициализации возможны 16 vs 20 без ручных изменений.

Фикс: единая versioned policy/аллокация по циклу, однозначный приоритет индивидуальных overrides. Acceptance: изменение аллокации 20→30 отражается одинаково в UI, заявке, approval и финансовом расчёте; история закрытых периодов не переписывается без аудита.

### E06 — P1 — Save Shifts перестаёт работать после первой смены по этому расписанию

`shifts.ts:1181–1194` и `:1260–1273` удаляют все shiftSchedules перед вставкой. `/start` сохраняет scheduleId (`:304–313`, `:355–358`). `server/src/db/schema.ts:620` и обе миграции `server/drizzle/0014_add_shifts_system.sql:17`, `0025_abnormal_scarecrow.sql:205–206` задают FK shifts.scheduleId→shiftSchedules.id без ON DELETE SET NULL/CASCADE. Поэтому DELETE referenced schedule отклоняется БД; endpoint возвращает 500. Это следует из кода и затем подтверждено независимым READ ONLY запросом фактической схемы тестовой копии: присутствуют оба FK `shifts_schedule_id_fkey` и `shifts_schedule_id_shift_schedules_id_fk`, оба без ON DELETE SET NULL/CASCADE. Сам API update после shift не запускался из-за automatic approval review.

Фикс: upsert стабильных записей либо версионировать график и хранить snapshot расписания смены; транзакция; проверить/очистить дубликаты перед unique(employee, weekday). Acceptance: начать/закончить смену, изменить preferred schedule, сохранить успешно; историческая смена сохраняет первоначальный график, новые используют изменённый.

### E07 — P1 — Late/missed shifts игнорируют timezone, day overrides, approved leave и праздники

`shifts.ts:11–23` использует setHours в timezone процесса; `:289–313` берет день недели сервера и только weekly shiftSchedules. `/admin/late` (`:802–858`) также использует серверные сутки, без shiftScheduleOverrides/leaveRequests. Календарь при этом скрывает график на approved leave/holiday (`EmployeeVacations.tsx:726–746`).

Воспроизведение: сотрудник America/New_York, график 09:00, вход 07.09.2026 13:00Z = 09:00 Нью-Йорка; source-derived probe на UTC сервере получил isLate=true и lateMinutes=240. Перенос дня на 12:00 или Day Off не меняет late/missed API. Одобренный отпуск при отсутствии shift попадает в missed.

Фикс: один effective schedule resolver по employee timezone + конкретной дате + override + approved leave/holiday; UTC instants для факта. Acceptance: 09:00 New York не late; Day Off/approved leave не missed; override 12:00 используется; кейсы перехода полуночи и DST.

### E08 — P1 — Dashboard остаток отпуска вычитает все годы и теряет half-days/adjustments

`EmployeeDashboard.tsx:153–167` берет все approved заявки `/my-requests`, суммирует календарную длину диапазонов без cycleId/isOldCycle/isFutureCycle/halfDay. `/my-requests` возвращает всю историю и эти признаки (`vacation.ts:577–582`, `:634–656`). Затем `EmployeeDashboard.tsx:276,322` вычитает всё из базовой годовой квоты roadmap. На отдельной странице Balance используется другой калькулятор.

Воспроизведение: 10 дней прошлого года + 2 текущего, текущая квота 20: dashboard показывает 8 вместо 18; half-day 0.5 выводится как 1; будущая одобренная заявка уменьшает текущий dashboard.

Фикс: dashboard читает общий баланс API, без повторного бизнес-расчета в React. Acceptance: dashboard=My Calendar balance при прошлых/будущих циклах, half-days и корректировках.

### E09 — P1 — Начало смены/перерыва не атомарно, возможны дубликаты и неконсистентный статус

`shifts.ts:269–286→352–364` делает SELECT no active→INSERT без lock/transaction/unique. Тот же шаблон у breaks `:542–571`. Закрытие перерыва и смены — раздельные UPDATE (`:449–470`, `:672–683`). В схеме `schema.ts:617–641` отсутствуют partial unique на один active shift / active break; в просмотренных shift migrations также отсутствуют. Две вкладки либо retry на медленном соединении могут создать две активные смены; текущая выбирает последнюю, end выбирает первую (`:108–109` vs `:433`).

Фикс: транзакционные state transitions, partial unique indexes, idempotency для повторного действия; guarded updates. Acceptance: параллельные Start дают ровно 1 активную смену; параллельные Break ровно 1 break; End и Break одновременно оставляют completed без открытых breaks.

### E10 — P2 — My Calendar показывает отменённые/отклонённые заявки как обычное отсутствие; кнопки события не действуют

`EmployeeVacations.tsx:470–475` фильтрует только диапазон; `:699–720` отличает только pending, поэтому denied/canceled визуально почти как approved. Этот же `<button>` не имеет onClick. История `:846–900` не предлагает cancel/edit; API cancel есть.

Воспроизведение: отклонить/отменить заявку и открыть её месяц — chip остаётся; нажатие на существующий отпуск ничего не делает. Изолированный probe реальной getLeaveForDay получил все 4 статуса.

Фикс: в календаре отсутствие только approved, pending отдельно; denied/canceled в истории или явном фильтре. Event click открывает детали + разрешённые действия (включая withdrawal pending). Acceptance: cancel сразу убирает отсутствие; история и details объясняют статус; нет интерактивных кнопок без действия.

### E11 — P2 — Календарь и редактор не поддерживают weekend shifts, holiday логика только визуальная

`EmployeeVacations.tsx:659,727,746` допускает вывод/редактирование shift только Monday–Friday и не holiday. `PreferredShiftsEditor.tsx:9–15` содержит только 5 будних дней; при сохранении перезаписывает все server rows и тем самым убирает weekend schedules. Праздники — хардкод внутри React (`EmployeeVacations.tsx:94–120`), в расчетах отпуска берутся все календарные дни (`vacation.ts:61–76`), а missed API продолжает ждать смену. Политика оплаты/списания праздничных и выходных дней не определена общим механизмом.

Фикс: единый корпоративный/проектный календарь и поддержка 7 дней, правил выходных/праздников, ночных смен. Acceptance: субботняя смена видна и редактируется, изменение понедельника не стирает субботу; праздник дает согласованные календарь/норму/leave-day count. Требуется бизнес-решение: отпуск в календарных или рабочих днях, какие праздники являются нерабочими.

### E12 — P1 — Сотрудник/клиент может читать чужие отпуска и создавать заявку на чужого сотрудника

POST vacation/requests (`vacation.ts:1139–1163`, `:1291–1305`) использует employeeId из body без сверки с session teamMemberId и без ограничения role. requireAuth проверяет лишь вход (`middleware/auth.ts:21–25`). GET `/requests/:employeeId` (`vacation.ts:949–984`), `/employment-cycle/:employeeId` (`:680–698`), `/balances/:employeeId` (`:730–747`) не ограничены владельцем. Дополнительно клиенту разрешены global preferred и overrides (`shifts.ts:1290–1321`, `:1467–1497`) и preferred произвольного сотрудника (`:1212–1231`) без проверки принадлежности активному проекту.

Фикс: единая server-side scope policy own employee/admin/client active project; employeeId выводить из сессии; клиентские DTO исключают private reason/balance. Acceptance: сотрудник A не читает и не создает отпуск B; клиент X не получает schedules сотрудников Y никаким URL; admin сохраняет доступ.

### E13 — P2 — Связанный employee профиль виден по teamMemberId, но смены/override/save profile требуют совпадающего email

Профиль/current/preferred используют teamMemberId прежде email (`vacation.ts:139–159`, `shifts.ts:60–79`, `:1129–1135`). Start/end/break/history/override — только email (`shifts.ts:256,413,506,620,719,1335,1371,1436`). Save profile owner тоже email (`admin.ts:76–81`). При валидной связи user.teamMemberId и разных email UI загружается, но эти действия возвращают 404/403.

Фикс: единый resolver identity by teamMemberId, email fallback только контролируемая миграция; проверка активности. Acceptance: изменение email сотрудника не ломает связанному пользователю смены, профиль и календарь.

### E14 — P2 — Сохранение timezone/графика может выглядеть успешным при ошибке; календарь берет другой timezone

`EmployeeDashboard.tsx:121–130` сразу меняет local timezone и при PUT ошибке только console (без rollback). Save Shifts ошибки тоже только console (`:102–118`). Calendar подписывает время `currentUser.timezone || browser` (`EmployeeVacations.tsx:141–146`), тогда как PUT timezone/me пишет teamMembers.timezone (`shifts.ts:1111`) и GET preferred возвращает его (`:1147`); это разные поля. PreferredShiftsEditor берет schedules только в useState initializer (`:48–51`), не обновляя при позднем GET или внешнем обновлении props; dashboard грузит profile и preferred независимо (`EmployeeDashboard.tsx:85–87`).

Фикс: общий query cache, canonical employee timezone, явные success/error и rollback, синхронизация полученных props без потери черновика. Acceptance: задержанный preferred GET отображает сохранённый график, не default 09–18; ошибка сохранения явно видна; timezone после reload одинаковая на Dashboard/Calendar/admin/client.

### E15 — P2 — Комментарий к смене/перерыву отправляется в Slack, но не сохраняется для учёта

Sidebar предлагает shiftNote и breakNote (`ShiftWidget.tsx:115–119`, `:129–137`). Shift insert `shifts.ts:353–364` не пишет notes; break insert `:558–564` также игнорирует notes; текст используется лишь notify и socket (`:367–375`, `:574–603`). В schema notes у обоих существует (`schema.ts:627,639`).

Фикс: сохранять нормализованный comment в notes и отдавать в details/history; Slack только побочный канал. Acceptance: комментарий доступен после reload и в истории при недоступном Slack.

### E16 — P2 — Разные алгоритмы стажа и границ циклов; GET баланса может менять учёт

`employment.ts:20–28` считает каждый год как 365 дней; vacation cycles anniversary-based (`vacationBalanceCalculator.ts:85–108`). Через високосный год квота/roadmap переключится раньше anniversary. `calculateVacationBalance(employeeId,currentDate)` при этом берет careerYear от фактического now через calculateEmploymentMetrics, игнорируя переданный currentDate (`:81–83`). Автосоздание цикла `calculateCycleStartForDate` использует local midnight, затем пишет `.toISOString().split('T')[0]` (`:457`, `:530–531`): на timezone Europe/Kyiv это может сдвинуть дату назад на день. Автоинициализация другой функции завершает цикл прямо в anniversary, без -1 дня (`vacation.ts:242–245`), создавая пересечение границ. GET баланса запускает создание и переключение циклов (`vacationBalanceCalculator.ts:128–134,525–547`); это опасная скрытая запись при простом открытии страницы и источник race duplicates.

Фикс: один calendar-date utility и политика anniversary; explicit provisioning/rollover job в транзакции; read endpoints без записей. Acceptance: leap-year/29 Feb/month-end/timezone fixtures; исторический currentDate возвращает историческую квоту; repeated GET не меняет таблицы, active cycle единственный и покрывает today.

### E17 — P1 — Сотрудник может отменить уже использованный approved leave и удалить журнал

`vacation.ts:1853–1864` разрешает requestedBy-owner cancel любого статуса кроме canceled, не проверяя прошлые даты/закрытый payroll. После этого баланс автоматически возвращает все дни, так как считает только approved. DELETE `:1908–1931` разрешает тому же owner удаление любого не-approved запроса и сначала удаляет audit events. Комбинация cancel→delete убирает даже историю ранее использованного approved отпуска. В текущем UI сотрудника cancel нет, но API доступен напрямую.

Фикс: withdrawal только pending/future по политике; прошлый approved — корректировка админом с неизменяемым журналом и financial adjustment; не удалять учетный факт/audit. Acceptance: после закрытия периода employee не может вернуть использованные дни или стереть историю; исправление администратора прозрачно связано с исходной записью.

## Проверки и ограничения текущих тестов

Запущено `node output/audit-2026-09-06/employee-calendar-probes.mjs`: 5 изолированных characterization probes прошли, воспроизведя дефекты first-year second-half, unlimited future, unlimited inactive past, timezone late, canceled/denied calendar. Скрипт читает реальные функции из исходников и инжектирует фиктивные cycle/balance зависимости; сеть и БД не используются.

Playwright shift-management существующий тест не доказывает рабочую смену: `playwright/shift-management.spec.ts:97–102` выходит при уже активной смене; `:119–125` считает успехом даже оставшуюся Start Shift после ошибки; break tests пропускаются по существующему состоянию (`:176–180`). Cypress calendar/leave тесты в основном проверяют наличие текста/кнопок и условно выполняют действия. Существующие E2E не запускались, потому что включают записи в реальные учётные записи и внешние уведомления.

Нужен изолированный test DB + clock fixtures + fixture employee/client/admin. После исправлений обязательны: остатки 16/20/24 и overrides; 1st-year second-half; half days; midpoint/cycle boundary; overlaps разных типов; массовые и параллельные approve; future/current cycle; cancel закрытого периода; shift start/break/end concurrent; сохранение schedule после фактической смены; timezone/DST/night shift; canceled event disappearance; endpoint scope между двумя сотрудниками и двумя клиентами; persistence после reload.

## Рекомендуемый порядок работ

1. Сначала закрыть чужой доступ и возможность переписывать прошедший учёт: E12, E17.
2. Ввести единую политику leave allocation/cycle/day count и общий транзакционный сервис: E01–05, E08, E16. Пересчитать копию существующих данных и составить сверку расхождений до миграции.
3. Исправить модель shift schedule/fact, атомарность, employee identity и timezone: E06–07, E09, E13–15.
4. Привести календарь в соответствие реальным состояниям: E10–11, детали и withdrawal, видимый sick balance, согласованность обновлений между ролями.
5. Прогнать тестовую матрицу выше и связать результаты с payroll-проверками (фактические часы/перерывы/approved leave/оплачиваемые дни и закрытие периода). Manual correction фактических смен и сотруднический payslip следует отдельно оформить как недостающие функции, если они входят в задуманный продукт.

## Дополнение: попытка API-воспроизведения на отдельной копии БД

После основного анализа подготовлен bounded script `employee-api-repro.mjs` для синтетического сотрудника в `vestov_audit_20260906`: preferred → start → повторное сохранение preferred, затем 6 конкурентных Start и завершение только синтетических смен. Root подтвердил отдельную базу, localhost:3001 и отключённые внешние интеграции. До исполнения automatic approval review отклонил команду: чтение session cookie из временного файла для изменяющих API-вызовов и эти изменения не были явно авторизованы пользователем. Скрипт не запускался, эта попытка не создала/изменила записи. Обход блокировки не предпринимался. `employee-api-repro.json` фиксирует blocked, а не выдуманный результат. Для этой дополнительной проверки требуется явное разрешение на указанные действия в тестовой копии; 5 изолированных source-derived probes выше уже выполнены и не зависят от этой блокировки.

Независимая проверка фактической схемы тестовой БД разрешена и выполнена в `BEGIN READ ONLY` с последующим `ROLLBACK`, без cookie. Подтверждены оба FK shifts.schedule_id → shift_schedules.id без каскадных действий; поля shifts.notes и shift_breaks.notes существуют; у shifts и shift_breaks из UNIQUE-индексов только PK(id), то есть запрета двух активных записей действительно нет. На shift_schedule_overrides, напротив, есть UNIQUE(employee_id, override_date); дубли overrides не заявлены как подтверждённая проблема. Результат добавлен в `employee-api-repro.json.independentReadOnlyDatabaseCheck`.
