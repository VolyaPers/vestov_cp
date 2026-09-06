# Employee / calendar / shifts: реализация E01–E17

Дата: 2026-09-06. Изменения локальные, без коммитов и публикации. Реальные данные исходной БД не изменялись. Интеграционные мутации выполнены только над временными fixtures в `vestov_fix_20260906`; тест удаляет только созданные им записи.

## Что исправлено

| Аудит | Реализация |
|---|---|
| E01–E05, E08, E16 | Единые `calendar.ts`, `vacationBalanceCalculator.ts` и `sickLeaveBalanceCalculator.ts`. Год стажа определяется годовщиной; конец цикла — день перед следующей годовщиной. Первый год доступен целиком в обеих половинах, последующие vacation cycles делятся 50/50. Расход распределяется по фактическим датам, включая половины дней, середину года и годовщину. |
| E05 | Сохранённые `totalDays + adjustmentDays` — индивидуальная квота. Для отсутствующих записей применяется точная настройка типа/года, затем default для более поздних годов, затем исходная политика 16/20/24 vacation, 7 sick, 5 personal. Существующие значения не переписываются при чтении и при изменении глобальных настроек. |
| E02–E04, E17 | `leaveLifecycle.ts`: create/edit/approve/deny/cancel/archive/bulk проходят один транзакционный путь и employee advisory lock. Проверяются итоговые даты, доступ, квота, пересечение всех pending/approved типов, совместимость половин и переход статусов. История `leaveRequestEvents` сохраняется; DELETE архивирует. Закрытая заявка не редактируется. Сотрудник не отменяет уже начатый approved leave. |
| E03, E05 | Все старые write endpoints внутри `vacation.ts` заменены. Initialize циклов идемпотентен, будущий цикл не меняет текущий. Ручные и массовые изменения баланса не могут стереть подтверждённый расход. Настройки, квоты, циклы и типы пишут immutable `leaveAdminEvents`. Legacy `/admin/leave-requests` переадресует root в тот же lifecycle. |
| E06, E09 | Shift start/end/pause/resume и preferred schedule сохраняются под одним employee lock. БД дополнительно ограничивает одну открытую смену, один открытый перерыв и один активный график на weekday. Start/pause повторяемы без дубликатов; finish закрывает открытый перерыв и смену атомарно. Preferred update сохраняет ID/FK, отключает удалённые weekdays, не удаляет историю. |
| E07, E11, E14 | Единый effective-day resolver применяется сотруднику, админу и клиенту. Учитываются timezone, дата, DST, overnight, day override, day-off и approved leave. В выходные разрешён реальный график. Информационная метка праздника не подменяет расписание. AM leave сдвигает expected start на вторую половину смены; full leave/dayoff исключает missed. |
| E12–E13 | Сотрудник определяется через `resolveEmployeeId`, связь `teamMemberId` не зависит от совпадения email. Все employee endpoints проверяют свой ID, все admin mutations требуют admin. Client preferred/overrides/team ограничены компанией и периодом assignment/service; overrides дополнительно проверяются на точную дату. Клиенту не передаются причины отпусков, комментарии, суммы или личные поля. |
| E10, E14 | Employee leave chips открывают подробности. Pending можно исправить или отозвать, будущий approved — отменить, закрытый — архивировать. Canceled/denied не выглядят активным отсутствием в календаре. Half-day controls передаются на сервер. API failures не маскируются успешным закрытием admin create form; ошибки/повторная загрузка видимы. |
| E15 | Shift/break note сохраняется в БД. Новый `ShiftHistory` показывает сотруднику и админу факт начала/завершения, net work minutes, перерывы и комментарии. Net time вычитает объединение перерывов, ограниченное границами смены: исторические overlap pauses не списываются дважды. Slack/email работают после commit и не превращают сохранённую операцию в ошибку. |

## Интерфейс и совместимость

- Dashboard, balances и roadmap читают одну квоту. Roadmap отражает сохранённые карьерные настройки, отдельно объясняет индивидуальную текущую квоту. Компенсационный остаток Dashboard берётся из backend limits и учитывает reserved + paid.
- `PreferredShiftsEditor` содержит 7 дней, подхватывает загруженные props, сохраняет dirty draft при ошибке. Display использует дату соответствующего weekday для timezone/DST и отмечает overnight.
- Reminder не появляется на полный отпуск/dayoff; dismiss привязан к сотруднику и локальной дате. При нескольких проектах автоматический выбор возможен только для единственного подходящего проекта в локальный weekday сотрудника.
- Admin Calendar использует `/shifts/calendar/all`; half-day leave оставляет реально доступную часть рабочего дня. Старый скрытый weekday/public-holiday default удалён.
- `VacationBalanceCard` для админа загружает sick balance выбранного сотрудника, а не admin identity. Кнопка Review individual allocation открывает реальную форму `totalDays`, `adjustmentDays`, reason; сервер проверяет и сохраняет журнал before/after.
- `TeamMemberDetails` больше не отправляет скрытые 30 vacation / 10 sick и числовые ID типов 1/2. Цикл создаётся с годовщины по настройкам сервера. Поддержан virtual current cycle без записи на GET.
- Старые stored inclusive `cycleEnd` отображаются по корректной годовщине с предупреждением о сверке. GET не переписывает сохранённую историю; нормализация — отдельное административное действие.
- Ненужный исторический автоматический rollover заблокирован с понятным 409. UI не вызывал его; индивидуальное исключение оформляется audited adjustment. Отображение «до 5 дней» честно описывает eligibility for compensation review, а не обещает автоматическую выплату.

## Проверки

1. `node --import tsx --test server/src/utils/calendar.test.ts` — **13/13 PASS**. Первый/последующий год, unlock, half-day overlap, midpoint/anniversary split, leap year/Feb29, индивидуальные квоты, настройки, timezone, overnight/DST, full/half leave, dayoff/weekend, clipping/union фактических перерывов.
2. `EMPLOYEE_CALENDAR_TEST_DATABASE_URL=postgresql://localhost:5432/vestov_fix_20260906 node --import tsx --test server/src/tests/employeeCalendar.integration.test.ts` — **PASS**, финальный запуск около 2 секунд. Используются настоящие Express routers и PostgreSQL transactions; аутентификация только собственными fixture principals без сессий реальных людей. Проверены:
   - linked employee с отличающимся login email; чужие IDs дают 403;
   - GET баланса не создаёт цикл; archived не возвращается, archived edit 409;
   - approve первого года во второй половине, cross-type overlap rejection, exact partial edit, oversized future request rejection;
   - две конкурентные approval при недостаточном общем остатке — только одна успешна; bulk не обходит проверку;
   - complementary AM/PM разрешены, cancel/archive сохраняют 3 события;
   - старые initialize paths, идемпотентность, exact anniversary end, future/current separation;
   - историческое inclusive cycleEnd отображается canonical без изменения записи;
   - negative/reduced/bulk balance update rejects, explicit adjustment имеет immutable before/after;
   - allocation setting действует на новую квоту, изменение setting не переписывает уже сохранённую;
   - closed payroll препятствует cancel approved leave; guard получает payroll lock после employee lock;
   - 10 параллельных стартов создают 1 смену, 10 pause создают 1 перерыв; concurrent resume/end оставляет закрытые shift/break;
   - изменение preferred после FK-referenced shift успешно; плохой график не разрушает старый; notes и net minutes возвращаются history.
3. Клиентский агент дополнительно проверил real-router `/shifts/overrides/all`: при assignment 10–20 числа override за 9-е скрыт, за 19-е доступен, чужая компания 403 — **PASS**.
4. `npx tsc --project server/tsconfig.json --noEmit --pretty false` — **PASS**.
5. `npx tsc --noEmit --pretty false` — **PASS** после правок компонентов.
6. `git diff --check` — **PASS**. Переформатирование 11 backend/test файлов выполнено с проверкой идентичного parsed AST до/после.

## Существенные границы

- В копии найдена сохранённая настройка vacation year 1 = 15. Она теперь действительно действует; типовая политика 16 применяется при отсутствии настройки. Сохранённые индивидуальные allocations сохранены и требуют явной сверки там, где отличаются от настройки.
- Сумма cash-out автоматически не рассчитывается и не выплачивается: задана только eligibility до 5 дней, денежная корректировка требует отдельной записи в финансах. Не придуман hourly rate или иной новый payroll policy.
- Календарный ручной edit меняет **плановый график** дня. Ручная корректировка фактических clock-in/clock-out не добавлялась: существующего UI действия для неё не было. Фактическая история теперь видна.
- Внешние Slack/email были отключены в интеграционных тестах. Production deployment и реальные уведомления этим отчётом не подтверждаются. Browser QA реальных компонентов координирует root отдельным fixture harness.

## Дополнение: согласованность timestamp / UTC

В browser QA root обнаружил createdAt на 3 часа позже adminRespondedAt. Причина подтверждена исходным кодом установленного Drizzle: `timestamp` без timezone записывает `Date.toISOString()` и при чтении добавляет UTC, а PostgreSQL `DEFAULT now()` приводил к timestamp в локальном TimeZone соединения. Это затрагивало автоматически созданные audit/created timestamps, а не календарные `DATE`.

- `db/connection.ts` и `db/index.ts` задают `TimeZone=UTC` в startup options **до первого SQL**, сохраняя остальные URI/PGOPTIONS параметры. UTC добавлен последним, чтобы старый timezone из URI не переопределял его.
- `db/migrate.ts` задаёт `SET LOCAL TIME ZONE 'UTC'` внутри транзакции. Отдельный session-store pool оставлен с прежней семантикой `session.expire`; после commit его timezone не меняется.
- `db/timestamp.integration.test.ts` — **PASS** на `vestov_fix_20260906`, Node TZ `America/New_York`, контрольный PostgreSQL TZ `Europe/Kyiv`: сдвиг до фикса **10 799 981 мс**, через настоящий application pool **−8 мс**, с унаследованным PGOPTIONS **−6 мс**. Проверены URI override, сохранение statement_timeout, новые параллельные подключения, `timestamptz`, неизменный календарный DATE и восстановление timezone session pool после транзакции.
- Тест использует только временную таблицу с rollback, не меняет application rows или browser QA fixtures. Migration preflight tests — **2/2 PASS**; server TypeScript и diff check — **PASS**.

Исправление действует на новые записи после перезапуска процесса. Исторические timestamp могут содержать смесь локальных DEFAULT и явных UTC значений; они намеренно не пересчитывались. Для исправления конкретной старой записи нужно подтвердить источник и фактическое время, а не вычитать одинаковое число часов из всей таблицы.
