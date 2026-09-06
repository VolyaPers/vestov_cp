# Реализация клиентского кабинета и проверка целостности

Проверено локально 2026-09-06. Рабочая БД и production не изменялись; интеграционные тесты используют `vestov_fix_20260906`, собственные записи и временную папку uploads с очисткой. Это подтверждение исходного кода и локальных сценариев, а не production-приёмка.

| Дефекты аудита | Реализованное поведение |
| --- | --- |
| C01–C02 | Изменения ставок/назначений только admin; чтение компании, сотрудников и календарей через общий ACL; цены, bot configuration и приватные причины отсутствия исключены из клиентских DTO. |
| C03, C08 | Клиентский UI использует issued invoices и фактические pending/overdue totals; финансовый backend исправлен финансовым агентом. |
| C04, C14 | Feedback проверяет компанию, активный проект и актуального сотрудника; смена проекта сбрасывает получателя, поздний ответ старого запроса игнорируется. Submit → admin response → reload проверен реальным API. |
| C05–C07, C10–C11 | Employee ID отделён от assignment ID. Календарь использует общий resolver, конкретные даты, timezone, overrides и половины дней; учитывает сроки проекта/назначения/найма. Public leave DTO обрезан до разрешённых дат. Видны тип отсутствия, scheduled interval и available hours; отсутствие настроенного расписания обозначено отдельно. |
| C09 | Один выбранный client workspace используется dashboard, portal, calendar, feedback, documents и invoices. Сервер требует явный clientId для нескольких компаний. |
| C12 | Контакты доступны своему клиенту в минимальном DTO, без внутренних notes. Avatar upload проверяет admin до записи файла; старый файл сохраняется до успешной записи нового URL. |
| C13 | Ошибка загрузки показывается с Retry; preview/download использует авторизованный запрос; смена компании сбрасывает состояние страницы. |
| C15–C16 | Dashboard показывает актуальную команду и проекты, договорные даты/статус и имя вошедшего пользователя. Нереализованные recent/pending request панели заменены реальной историей feedback выбранной компании. Dormant messages API исправлен на sender OR receiver; новые pages не добавлялись. |

Дополнительно выполнен порученный блок ADM06/07: создание внутреннего доступа без локального password, статусы Clerk pending/linked, генерация invitation link с `notify:false`, понятное восстановление пароля через Clerk, защита последнего admin/собственной деактивации. Hard delete разрешён только для неиспользованной, не связанной с историей учётной записи; удаление истории и каскадная чистка сотрудников убраны.

Независимая проверка общих изменений выявила и закрыла дополнительные границы:

- Employee document access и Socket notifications учитывают даты и состояние целевого проекта, даже если другой проект той же компании активен.
- Clerk linking использует compare-and-set по текущему Clerk ID, email и active status. Два конкурентных linking запроса не перепривязывают одну локальную запись.
- Удаление документов и деревьев папок сначала коммитит изменения БД. Ошибка БД сохраняет файлы и записи; общие URL сохраняют файл, пока остаётся другая ссылка. Перемещение содержимого удаляемой папки выполняется одной транзакцией. Проверяются имена, ID, parent/service consistency и циклы.
- Старые миграции, которые удаляли legacy developers, assignments или `users.client_id`, не запускаются автоматически при наличии в этих источниках данных: обновление останавливается с объяснением и откатом.

## Выполненные проверки

- `server/src/services/clientWorkspace.test.ts`: 6 тестов дат, идентичности, DTO, allocation и leave redaction.
- `server/src/services/userInvitation.test.ts`: 3 теста invitation без отправки почты, повторного использования и ограничений доступа.
- `server/src/db/migrate.test.ts`: 2 теста preflight legacy-данных.
- `server/src/routes/client-workspace.integration.test.ts`: реальные routes/DB; company/role ACL, stale project access, dashboard scopes, calendar/half-day/override privacy, feedback roundtrip, Users deletion safeguards, mocked invitations.
- `server/src/socket.integration.test.ts`: реальные Passport sessions и Socket.IO polling; anonymous/admin-room negatives, минимальные payload, отозванные проекты/назначения/membership/session/user/admin privileges и impersonation.
- `server/src/routes/document-integrity.integration.test.ts`: реальные FK rollback, дерево папок, shared files, unauthorized avatar без записи файла, конкурентный Clerk CAS с задержкой в тестовом trigger.
- Повторён `server/src/routes/foundation.integration.test.ts`: документы/приватные uploads/ACL и stable employee identity проходят после изменений.
- TypeScript frontend и server: успешно.

Итого: 11 unit tests и 4 integration suites успешно. Все внешние Clerk операции в этих проверках заменены fixture-данными или gateway mock; приглашения и письма не отправлялись. Реальный Clerk onboarding и production deployment не проверялись. Browser QA выполняется родительским агентом отдельно. Если удаление файла после успешного DB commit не удалось из-за файловой системы, запись уже недоступна через API; оставшийся файл требует служебной очистки, ошибка логируется.
