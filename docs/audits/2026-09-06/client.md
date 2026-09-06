# Аудит кабинета клиента — 2026-09-06

> Исторический аудит до исправлений. Текущее состояние и проверки: [результат реализации](results.md).

Область: текущий checkout Vestov HUB, все семь компонентов `src/pages/client`, их навигация и API: проекты/команда, календарь, feedback, документы, счета, профиль. Исправления в приложение не вносились. Производственная/локальная прикладная БД не изменялась, уведомления не отправлялись.

Метод: трассировка UI → API → запросы/DTO + запуск 14 воспроизводимых проверок текущих обработчиков/функций на синтетических данных. Скрипт `client-contract-probes.mjs` извлекает реальные функции через TypeScript AST и выполняет их с имитацией БД. Он не импортирует server startup, не соединяется с БД/сетью. Результаты: `client-contract-probes.json`. Это подтверждение логики и API-контрактов, а не полный браузерный E2E и не проверка текущих производственных данных. Условия, требующие конкретных данных (несколько компаний у пользователя, half-day, override), указаны явно.

Дополнительно после запуска основным агентом изолированной копии БД выполнены 4 live anonymous GET проверки на `http://localhost:3001`; `client-live-get-probes.json` сохраняет только status/shape. Оба `/api/invoices/test-*/0` реально отвечают 200 без логина; обычный `/api/invoices/client/0/totals` отвечает 401, `/api/shifts/preferred` — 403. Это подтверждает доступность debug обхода HTTP middleware без раскрытия настоящих финансовых данных.

`AGENTS.md` внутри проекта и родительской папки Projects не найден. В памяти совпадений по Vestov HUB не найдено; старые решения не использовались.

## Главный результат

Кабинет не готов к достоверному использованию клиентами: календарь теряет employee ID, изменения смен и типы отсутствий; денежные Pending/Overdue показываются нулями независимо от долга; API изоляция клиентов нарушена, включая возможность менять ставки/назначения через прямой API. Есть рабочая структура интерфейса и реальные backend операции, но она не гарантирует правильную бизнес-картину.

P1 — до следующего допуска реальных клиентов/финансового использования; P2 — следующий обязательный этап исправлений. P0 не назначен: критичность фактической эксплуатации/доступности production не проверялась.

## Подтвержденные дефекты

### C01 — P1. Клиент может менять чужие ставки и назначения через API

- Источники: `server/src/routes/services.ts:993-1015` PATCH assignment; `951-984` DELETE assignment; `901-943` POST assignment; `660-701` DELETE service; `794-838` PUT client; `1060-1087` legacy pricing. Регистрация содержит только `requireAuth`; `server/src/middleware/auth.ts:21-25` проверяет факт входа, не роль/компанию/accessLevel.
- PATCH использует только assignment ID в WHERE, не проверяя даже совпадение clientId/serviceId из URL. Клиент с `read` доступом проходит ту же ветку, что администратор.
- Воспроизведение в probe: authenticated `role=client`, запрос с чужими clientId/serviceId/assignmentId и `hourlyRate:1` достигает mock `db.update`, возвращает 200. Реальных изменений ставок не делалось.
- Влияние: порча состава команд, расчетных ставок и договорных данных; удаление/деактивация чужих проектов. UI запрет не защищает API.
- План: общий server-side ACL для company/service/assignment; административные финансовые/кадровые действия — admin; независимые write/admin document permissions не должны давать право менять цены. WHERE связывает все IDs.
- Приемка: клиент A, клиент B, read/write/admin-access клиент и team_member получают 403 на изменение ставок/назначений; проверяется неизменность БД. Администратор меняет правильное назначение, несовместимые IDs отклоняются.

### C02 — P1. Утечка данных сотрудников и календарей других клиентов

- Источники: `server/src/routes/shifts.ts:1290-1321` разрешает client и читает расписания всех active сотрудников; `1467-1497` разрешает client и читает overrides всех сотрудников за месяц. `server/src/routes/services.ts:846-856` `/developers` возвращает полные строки billable teamMembers; `864-893` назначенных в произвольный client/service без проверки доступа.
- Воспроизведение: GET клиента `/shifts/preferred` и `/shifts/overrides/all?month=2026-09` в probe возвращают сотрудника чужой компании; нет запроса membership. Чужой сотрудник может быть скрыт в UI, но уже присутствует в JSON.
- План: отдельный минимальный client DTO и client/project scope из активного доступа + назначений. Глобальные списки только admin. Не отдавать внутреннюю полную запись teamMembers клиенту.
- Приемка: два клиента с разными командами; каждый видит только свои допустимые события, чужой ID/отозванный доступ дают 403/404; сотрудник, общий для двух проектов, не раскрывает другие проекты/внутренние поля.

### C03 — P1. Финансовая информация доступна без входа или без доступа к компании

- Источники: `server/src/routes/invoice.ts:24-77` `/test-totals/:clientId` и `/test-service-totals/:clientId` зарегистрированы ДО `router.use(requireAuth)` на строке 80. `1035-1059` client totals и `1067-1090` service totals после auth, но без проверки client membership.
- Воспроизведение: probe без user получает 200 и суммы по произвольному clientId; обычный клиент получает totals другой компании. Полный список invoice защищен отдельно, это не закрывает обход через totals.
- План: убрать production debug endpoints; один ACL на все invoice list/detail/totals/calculation routes.
- Приемка: аноним — 401 на все финансовые endpoints; клиент A — 403 на суммы/сервисы B; свой разрешенный клиент видит согласованные суммы.

### C04 — P1. Feedback можно читать/создавать в контексте чужого проекта

- Источники: `server/src/routes/feedback.ts:184-208` получает участников любого service ID с одним requireAuth. `216-259` POST берет clientId из предоставленного service ID, не проверяет, что пользователь имеет к нему доступ; `261-275` проверяет лишь принадлежность employee к сервису. Без service ID принадлежность employee вообще не проверяется. Legacy `server/src/routes/client.ts:174-190` также не проверяет принадлежность employee.
- Воспроизведение: probe клиента A получает участников service B и создает mock feedback для service B (200), membership query отсутствует.
- План: требовать role client (или явно предусмотренное admin действие), действующую clientUsers связь и service membership; teamMember обязательно принадлежит разрешенному сервису; тип feedback вычисляет сервер. Убрать/выравнять legacy endpoint.
- Приемка: общий feedback на выбранную компанию, на проект/команду, на сотрудника сохраняется и виден автору/admin; чужой проект/сотрудник и отозванный доступ отвергаются без записи.

### C05 — P1. Календарь клиента сопоставляет assignment ID с employee ID; часы смен отсутствуют или принадлежат другому человеку

- Источники: `server/src/routes/vacation.ts:3862-3878` отправляет `{id: assignment.id, teamMemberId: employee.id}`. `src/pages/client/ClientTeamStatus.tsx:51-59` ожидает `developerId`; строка `733` вызывает `getShiftTimeForMember(member.developerId || member.id, date)`. `171-179` ищет employee.id.
- Воспроизведение: API fixture `{id:800, teamMemberId:42}` + расписание сотрудника 42. Реальная UI функция с 800 возвращает null. Если assignment.id совпал с чужим employee.id, возможно неверное время; глобальный endpoint C02 делает это особенно опасным.
- План: общий тип clientCalendarMember с явным employeeId, отдельным assignmentId и projectId; убрать any и fallback между разными сущностями.
- Приемка: несовпадающие IDs, несколько назначений одного человека, удаленные назначения; расписание всегда принадлежит ожидаемому сотруднику, дубли исключены или показаны явно по проектам.

### C06 — P1. Однодневные изменения смен/выходной игнорируются, рабочие дни считаются из другого источника

- Источники: `ClientTeamStatus.tsx:160-167` ищет `o.employeeId`, а `shifts.ts:1482-1497` возвращает `o.override.employeeId`. `ClientTeamStatus.tsx:235-263` определяет Working только из assignment.workSchedule либо fallback Mon–Fri, вообще не из preferred schedules/overrides. `239-242` безусловно объявляет жестко заданные праздники выходными для всех.
- Воспроизведение: день с `isDayOff=true` override и обычным понедельником. Даже при правильном employee ID функция возвращает обычные 09–18, `isDayOff=false`; список Working оставляет сотрудника (probe). Смена в субботу при default workSchedule не появится.
- План: один resolver availability на дату: срок назначения/проекта → график → override/выходной → approved absence/half-day → holidays по согласованной настройке. Все календарные метрики/карточки используют его.
- Приемка: day off убирает рабочую емкость; добавленная смена в выходной появляется; измененное время видно; индивидуальная рабочая смена в праздник не исчезает без основания; изменения одинаковы в employee/admin/client.

### C07 — P1. Sick leave и vacation не различаются в клиентском календаре; наружу уходит приватная причина

- Источники: `server/src/routes/vacation.ts:3796-3822` выбирает `leaveRequests` без join leaveTypes, затем распространяет всю request. `schema.ts:461-477` содержит `leaveTypeId`, но нет `leaveType`; есть reason/decisionReason/requestedBy. UI `ClientTeamStatus.tsx:41,483,529,631-632,667-679,803` ожидает строку leaveType и сравнивает Vacation/Sick Leave.
- Воспроизведение: probe approved leaveTypeId=2 возвращает JSON без leaveType, но с reason. UI попадает в «другой тип» и не отображает подпись Sick Leave/Vacation.
- План: client DTO с типом отсутствия (или согласованным общим Away), датами и half-day, исключить персональные медицинские/внутренние причины и служебные поля. Join/маппинг leaveTypes; хранить стабильный type code.
- Приемка: sick leave/vacation корректно помечены, pending/denied/canceled не занимают клиентский календарь, reason/decisionReason никогда не попадают в client JSON.

### C08 — P1. Клиент видит Pending/Overdue = $0 даже при непогашенных счетах

- Источники: `src/pages/client/ClientInvoices.tsx:114,121-124` берет pendingAmount/overdueAmount или 0; `server/src/routes/invoice.ts:1041-1059` возвращает только totalInvoiced/totalPaid. Probe: неоплаченные 1000 → `{totalInvoiced:1000,totalPaid:0}`; UI pending и overdue = 0.
- Также list `invoice.ts:163` не фильтрует draft; totals включают все статусы. Draft не должен автоматически считаться выпущенным долгом; бизнес-правило видимости необходимо зафиксировать.
- План: общий invoice totals DTO с billed/paid/open/overdue, единый статусный lifecycle и cutoffDate; возвращать суммы decimal-safe, согласовать включение draft/canceled и распределение pending/overdue.
- Приемка: fixture с draft, pending, overdue, paid, canceled; суммы карточек равны выбранным строкам и серверной сумме, переход due date обновляет overdue, $0 только при реальном нуле.

### C09 — P1. Несколько компаний у одного пользователя поддерживаются несогласованно

- Источники: `ClientLayout.tsx:91-105` получает все разрешенные компании, но всегда ставит первую, переключателя/setCurrentClient кроме этого места нет. `server/src/auth/passport.ts:263-275` выбирает первую связь limit(1) без order. Shifts `971-986`, vacation `3766-3780`, schedules `3840-3852` также берут первую, календарные API не принимают client/project context. Invoice list `invoice.ts:140-143` сравнивает с единственным req.user.clientId, хотя services ACL поддерживает clientUsers.
- Влияние: разрешенная компания B открывается через URL/feedback, но ее invoices получают 403, Team Status остается от компании A. General feedback `feedback.ts:247-257` также идет в первую компанию. Schedules `vacation.ts:3845` не проверяет isActive связи.
- План: выбранный разрешенный clientId в маршруте/контексте, явный project filter; membership проверяется на каждый запрос, query keys содержат user/client/project, invoices используют clientUsers. Удалить зависимость авторизации от first association.
- Приемка: один контакт в двух компаниях, обе поочередно открываются; все разделы меняют контекст согласованно; отзыв доступа сразу закрывает календарь и данные. Два проекта с одинаковым названием не смешиваются.

### C10 — P1. Сроки участия в проектах и историческая доступность считаются несогласованно

- Источники: `vacation.ts:79-128` выбирает назначения «на сегодня», не на просматриваемый месяц, не проверяет startDate. `3861-3876` schedules после helper заново берет все active назначения без endDate. Shifts `999-1004,1035-1040` проверяет только isActive сервисов/назначений, без дат. Portal `243-253` считает active назначения даже у ended сервисов, `387` показывает все сервисы/`420` все назначения с badges.
- Влияние: будущий сотрудник появляется до начала участия; закончивший назначение может оставаться Working; при листании прошлых месяцев отсутствия/команда отражают текущий состав. Счетчики портала и календаря расходятся.
- План: единые диапазоны эффективности project/assignment: start <= displayedDate <= end, с isActive для управляемой отмены; отдельные «активные проекты» и раскрываемая история. Состав/absence query определяется периодом просмотра, а не сегодняшним днем.
- Приемка: назначение 10–20 сентября видно только в эти дни; будущий проект не active сейчас; сотрудник двух проектов не удваивает общую численность; история марта сохраняет мартовский состав.

### C11 — P2. Half-day, последний день отсутствия и часовые пояса искажают доступность

- Источники: `ClientTeamStatus.tsx:244-251` любое отсутствие удаляет человека из рабочих независимо от halfDayStart/halfDayEnd. `290-294` currentVacations сравнивает endDate в 00:00 с текущим временем; последний день после полуночи перестает быть current. `225-228` парсинг date-only через new Date имеет сдвиг в западных timezone. `165-178` convertTime не получает просматриваемую date, а `src/lib/timezone.ts:39-44` использует следующий понедельник, поэтому исторический/будущий DST может быть неверен; dayOffset игнорируется. `182-186` live time использует browser timezone, а заголовок обещает viewer timezone.
- Probe half-day: remaining work count 0 вместо половины дня.
- План: date-only календарные операции без UTC parse, timezone-aware интервалы на конкретную дату; сохранять день при переходе midnight; half-day дает частичную занятость.
- Приемка: последний день до 23:59 остается Away, half-day оставляет 0.5 емкости, Europe/Kyiv↔America/New_York в недели разных DST, overnight смена на правильных датах, viewer TZ соответствует отображенным часам.

### C12 — P2. Контакты портала никогда не доступны клиенту

- Источники: `ClientPortal.tsx:162-168` вызывает `/client-contacts/client/:clientId`; `server/src/routes/client-contacts.ts:37-42` дает 403 всем не-admin. UI `474` скрывает блок, если contacts пустые.
- Воспроизведение: source handler probe для client возвращает 403 без запроса данных.
- План: отдельный scoped client-readable DTO контактных лиц/менеджера; не раскрывать внутренние notes. Ошибку загрузки показывать явно.
- Приемка: клиент видит разрешенные контакты своей компании и работающие mailto/tel; чужие и внутренние контакты не доступны.

### C13 — P2. Ошибки загрузки маскируются под отсутствие данных/нулевые метрики

- Источники: `ClientFeedbackPage.tsx:75-87` catch только console; `ClientTeamStatus.tsx:97-153` использует data ?? [] без обработки isError; `ClientInvoices.tsx:55-67` catch console → No invoices; `ClientDocuments.tsx:120-123,133-145` аналогично; `ClientPortal.tsx:150-178` скрывает секционные ошибки.
- Влияние: 403, 500, offline дают «Нет счетов», «0 работают», «Нет feedback» вместо сигнализации отказа. Пользователь принимает технический сбой за реальный рабочий/финансовый статус.
- План: explicit loading/error/empty/success для каждого запроса, retry, сохранить предыдущие данные с пометкой stale; финансовый ноль только из успешного ответа.
- Приемка: 401/403/500/network delay на каждом разделе показывают корректное сообщение и retry; реальные empty сохраняют отдельную формулировку.

### C14 — P2. Feedback после смены проекта сохраняет выбранного сотрудника из предыдущего проекта

- Источники: `ClientFeedbackPage.tsx:66-73` сбрасывает selectedDeveloperId только для general/пустого service; при переходе A→B не сбрасывает. `91-100` асинхронный loadDevelopers не защищен от гонки, `119-125` отправляет старое selectedDeveloperId.
- Воспроизведение: выбрать A/сотрудник X, выбрать B и отправить без нового employee. Получится 400 «Team member not found» либо feedback ошибочно относится X, если он также есть в B; быстрый A→B может оставить список A.
- План: атомарно сбрасывать employee при любом смене project; query key serviceId или AbortController; disable submit пока контекст не загружен.
- Приемка: service switch очищает recipient, быстрая смена/медленный ответ A не перезаписывает B, team feedback без сотрудника сохраняется без ошибок.

### C15 — P2. Dashboard показывает старую модель команды и жестко заданный Active

- Источники: `server/src/routes/client.ts:30-34,46-52` использует teamMembers.clientId и clients.activeServices, тогда как реальное назначение находится в clientServiceTeamMembers/clientServices. Pending считает только последние 5 запросов. `ClientDashboard.tsx:133,182-185` Contract Active константа; `ClientPortal.tsx:391` выводит serviceTypeName, игнорируя serviceTitle.
- Влияние: login landing `/client/dashboard` может показывать 0 специалистов/сервисов при наполненном портале; inactive контракт Active; несколько проектов одного типа неразличимы по названию. Это реальный экран, хотя боковая Overview ведет на портал.
- План: один dashboard DTO из актуальных assignments/services/invoices/request aggregates; состояния из БД/дат, проект обозначается serviceTitle + type вторично. Счет pending по всем открытым, не по recent sample.
- Приемка: dashboard, portal, Team Status показывают одинаковые активные команды/проекты, ended контракты не Active, два проекта одного типа различимы.

### C16 — P2 / уточнение границ. Запросы и сообщения описаны, но полного клиентского workflow нет

- `src/lib/navigation.ts:89-104` и ClientLayout routes `229-235`: нет страниц Service Requests/Messages. Dashboard показывает Recent requests, но нет создания/обсуждения. README обещает обе функции; в текущем UI обещание слабее, поэтому не считать несуществующую кнопку сломанной.
- `server/src/routes/client.ts:199-208` сообщения фильтруются senderId=currentUser AND receiverId=currentUser: обычные диалоги никогда не попадут. Это dormant backend bug, пока messaging не подключен к UI.
- План: принять продуктовый scope. Если нужны requests/messages, реализовать создание, статус, историю и scoped conversation ACL; исправить AND на правильный participants predicate. Иначе убрать недостоверные обещания/неиспользуемые API. Не превращать feedback в скрытую замену ticket workflow без договоренности.
- Приемка: все видимые обещания имеют достижимый пользовательский путь; входящее и исходящее сообщения появляются только у участников, клиент может проследить отправленный запрос до результата.

## Что уже подключено к реальным операциям

Это подтверждено исходным кодом, не следует понимать как completed production E2E:

- Overview `/client/portal/:id` действительно загружает клиента, проекты и назначения. `services.ts:553-581` проверяет активный clientUsers доступ для client; batch assignment endpoint `468-505` также ограничивает клиентов. Есть полезный server-side ACL, который надо распространить на остальные endpoints.
- Feedback UI поддерживает general, service/team и конкретного сотрудника; рейтинг/текст проверяются, POST сохраняет feedback и list его читает; admin respond `feedback.ts:300-329` реально сохраняет ответ, автора/дату, reviewed. Клиент list `80-123` читает только собственные feedback, а UI показывает adminResponse. Нужны fixes C04/C14 и явное решение, должны ли коллеги из той же компании видеть общий history.
- Approved leave действительно выбирается только для участников активных проектов; фильтр approved исключает pending/denied/canceled. Ошибки в DTO/датах/контексте перечислены выше.
- Live shifts выбираются по реальным open shifts и active breaks; current company scope присутствует. Есть WebSocket-trigger refetch и fallback refresh. Интеграционный путь start→break→end должен быть E2E проверен после исправлений.
- Documents UI действительно имеет download (binary API), preview, folders и upload для write/admin client access. Server documents ACL проверяет основной агент; этот отчет не подтверждает файлы на production. Preview использует сырой `/api/documents/preview/:id` (`ClientDocuments.tsx:227-228`, `ClientPortal.tsx:219-220`), поэтому отдельно проверить bearer-only auth/split deployment в браузере.
- Invoice list/detail диалог подключены: View открывает существующую запись. UI не обещает оплату/PDF-кнопку, поэтому отсутствие payment/PDF flow само по себе здесь не записано как неработающая кнопка.
- Profile — реальное чтение currentUser и доступных компаний. Это read-only экран; кнопки редактирования нет, отсутствие редактирования не заявлено дефектом.

## Порядок исправлений и общий сценарий приемки

1. **Изоляция и права:** C01–C04, приватный leave DTO из C07, legacy document bypass (`client.ts:125-138`, основной аудит документов). Общий ACL и негативные API тесты до UI polishing.
2. **Одна модель client/project/employee/date:** C05–C07, C09–C11. Типизированный calendar response вместо набора несовместимых any; один resolver, используемый employee/admin/client и финансовыми расчетами.
3. **Финансовое представление:** C08 + dashboard C15, после согласования lifecycle invoice и базовых payroll правил с финансовым аудитом.
4. **Завершение пользовательских путей:** C12–C14, документы preview/upload/download, multi-company navigation, решение по C16.
5. **E2E на отдельной БД:** admin создает клиента A/B, проекты с разными датами, 3 сотрудников (один в двух проектах), клиент с read и write; назначает смены, day off override, half-day/sick/vacation; employee создает заявку → admin approve → все три календаря совпадают; отмена восстанавливает доступность; клиент оставляет team и employee feedback → admin отвечает → клиент видит ответ после reload; счета разных статусов дают точные totals; файлы проверяются на download/preview/upload и tenant isolation; 500/offline никогда не заменяются нулями. Провести desktop/mobile браузерную проверку и API bypass tests.

Использованные evidence-файлы находятся рядом с отчетом. Для повторного безопасного запуска: `node output/audit-2026-09-06/client-contract-probes.mjs` из корня репозитория.
