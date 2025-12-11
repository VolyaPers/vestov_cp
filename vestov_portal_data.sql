--
-- PostgreSQL database dump
--

\restrict Lmu6x0Iw4mNFwp4joFShpBImMQ1Nor1RvjcFuKYO9CjPgen9cDXjbURwkLtE2UP

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: volodymyrshapovalov
--



--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.clients VALUES (1, 'Chronogrid', 'Technology', 'John Smith', 'john.smith@techcorp.com', '+1-555-0123', '123 Tech Street, Silicon Valley, CA', 'active', 'outstaffing', '2024-01-01', '2024-12-31', 150.00, 'monthly', '["Software Development", "UI/UX Design"]', 5, '2025-09-06 10:46:41.348479', '2025-10-28 10:53:01.97', '/uploads/logos/logo-1761648781961-274765820.jpg');
INSERT INTO public.clients VALUES (4, 'Marrew Tech', NULL, 'Jack', NULL, NULL, NULL, 'active', NULL, '2025-09-21', NULL, NULL, 'monthly', NULL, 0, '2025-11-02 20:19:08.7933', '2025-11-02 20:19:08.7933', NULL);


--
-- Data for Name: client_contacts; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.client_contacts VALUES (1, 1, 'Kamran', 'CEO', 'efsefse@fdgddrgd.vom', '324324234234', NULL, true, true, '2025-09-16 19:05:45.714041', '2025-09-16 19:05:45.714041');


--
-- Data for Name: service_types; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.service_types VALUES (15, 'Outstaffing', 'Dedicated developers working on your project remotely as an extension of your team', 'outstaffing', 'monthly', '2025-09-07 08:45:06.614365', '2025-09-07 08:45:06.614365');
INSERT INTO public.service_types VALUES (16, 'Outsourcing', 'Complete project development handled by our team with full project management', 'outsourcing', 'fixed', '2025-09-07 08:45:06.614365', '2025-09-07 08:45:06.614365');
INSERT INTO public.service_types VALUES (17, 'Pay Per Delivery (PPD)', 'Pay only for completed deliverables and milestones', 'outsourcing', 'fixed', '2025-09-07 08:45:06.614365', '2025-09-07 08:45:06.614365');


--
-- Data for Name: client_services; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.client_services VALUES (5, 1, 16, NULL, '2025-09-07', NULL, true, '2025-09-07 08:49:35.655402', NULL);
INSERT INTO public.client_services VALUES (8, 4, 17, NULL, '2025-09-21', NULL, true, '2025-11-02 20:22:56.696353', 4000.00);


--
-- Data for Name: developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.developers VALUES (4, 'Sergei Vasilenko', 's.vasilenko@vestov.com', '["React", "TypeScript", "Node.js", "PostgreSQL"]', 45.00, 'senior', 'available', 'Full-stack developer with 5+ years experience in modern web technologies', 'Ukraine', 'https://ca.slack-edge.com/T072FNCP2PR-U0732PAN6HH-gf83efc5d2fb-512', '2025-09-07 08:45:06.61991', '2025-09-07 07:15:49.246');
INSERT INTO public.developers VALUES (5, 'Eduardo Cerato', 'eduardo.cerato@vestov.com', '["Vue.js", "Python", "Django", "MongoDB"]', 40.00, 'middle', 'available', 'Full-stack developer specializing in Vue.js and Python backends', 'Brazil', 'https://ca.slack-edge.com/T072FNCP2PR-U080JFM4L7J-3fa90a1830be-512', '2025-09-07 08:45:06.61991', '2025-09-07 07:16:26.138');
INSERT INTO public.developers VALUES (6, 'Jéssica Ferreira', 'j.ferreira@vestov.com', '["Angular", "Java", "Spring Boot", "MySQL"]', 50.00, 'middle', 'available', 'Enterprise application developer with expertise in Angular and Java ecosystem', 'Brazil', 'https://ca.slack-edge.com/T072FNCP2PR-U099JMRR9GD-88d31b853181-512', '2025-09-07 08:45:06.61991', '2025-09-09 07:53:04.91');


--
-- Data for Name: client_service_developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.client_service_developers VALUES (5, 5, 5, 'fulltime', NULL, 4000.00, true, '2025-09-07', NULL, '2025-09-07 10:27:48.233834', NULL);
INSERT INTO public.client_service_developers VALUES (3, 5, 4, 'fulltime', NULL, 5300.00, true, '2025-09-07', NULL, '2025-09-07 09:38:40.652154', NULL);
INSERT INTO public.client_service_developers VALUES (4, 5, 6, 'part_time', NULL, 2000.00, true, '2025-09-07', NULL, '2025-09-07 09:39:30.978032', '{"friday": "half", "monday": "off", "sunday": "off", "tuesday": "full", "saturday": "off", "thursday": "full", "wednesday": "off"}');
INSERT INTO public.client_service_developers VALUES (7, 8, 6, 'part_time', NULL, NULL, true, '2025-11-02', NULL, '2025-11-02 20:23:18.029051', '{"friday": "half", "monday": "full", "sunday": "off", "tuesday": "off", "saturday": "off", "thursday": "off", "wednesday": "full"}');


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.team_members VALUES (11, 'Eduardo Cerato', 'Full-Stack Developer', 'eduardo.cerato@vestov.com', NULL, '["React", "Next.js", "Python", "AWS"]', NULL, 70.00, NULL, 'active', NULL, '2024-11-18', 'São Paulo', 'https://ca.slack-edge.com/T072FNCP2PR-U080JFM4L7J-3fa90a1830be-512', '2025-09-13 20:59:57.892425', '2025-10-25 08:15:09.984', true);
INSERT INTO public.team_members VALUES (12, 'Jéssica Ferreira', 'Frontend Developer', 'j.ferreira@vestov.com', NULL, '["React", "Vue.js", "CSS", "JavaScript"]', NULL, 60.00, NULL, 'active', NULL, '2025-09-01', 'Rio de Janeiro', 'https://ca.slack-edge.com/T072FNCP2PR-U099JMRR9GD-88d31b853181-512', '2025-09-13 20:59:57.892425', '2025-10-25 08:15:36.385', true);
INSERT INTO public.team_members VALUES (10, 'Sergei Vasilenko', 'Senior Backend Developer', 's.vasilenko@vestov.com', NULL, '["Node.js", "TypeScript", "PostgreSQL", "Docker"]', NULL, 85.00, NULL, 'active', NULL, '2021-01-21', 'Remote', 'https://ca.slack-edge.com/T072FNCP2PR-U0732PAN6HH-gf83efc5d2fb-512', '2025-09-13 20:59:57.892425', '2025-10-27 14:12:36.566', true);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.users VALUES (1, 'admin', '$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m', 'System Administrator', 'v@vestov.com', 'admin', 'System Administrator', NULL, '2025-09-06 10:46:41.687777', '2025-10-25 08:16:19.951', true, NULL, NULL);
INSERT INTO public.users VALUES (2, 'kamran', '$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2', 'Kamran', 'john.smith@techcorp.com', 'client', 'CEO', NULL, '2025-09-06 10:46:41.983743', '2025-10-26 19:18:35.763', true, NULL, NULL);
INSERT INTO public.users VALUES (7, 'eduardo', '$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG', 'Eduardo Cerato', 'eduardo.cerato@vestov.com', 'team_member', 'Full-Stack Developer', NULL, '2025-10-25 00:56:03.767059', '2025-10-25 00:56:03.767059', true, NULL, 11);
INSERT INTO public.users VALUES (8, 's.vasilenko', '$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6', 'Sergei Vasilenko', 's.vasilenko@vestov.com', 'team_member', '', NULL, '2025-10-27 16:10:35.508461', '2025-10-27 16:10:35.508461', true, NULL, 10);
INSERT INTO public.users VALUES (9, 'j.ferreira', '$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O', 'Jéssica Ferreira', 'j.ferreira@vestov.com', 'team_member', '', NULL, '2025-10-27 21:12:24.595956', '2025-10-27 21:12:24.595956', true, NULL, 12);


--
-- Data for Name: client_users; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.client_users VALUES (1, 1, 2, 'write', true, 1, '2025-09-16 23:52:27.723015', '2025-09-16 23:52:27.723015', '2025-09-16 20:52:49.84');


--
-- Data for Name: developer_price_history; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.developer_price_history VALUES (2, 3, NULL, 5300.00, '2025-09-07', '2025-09-07', NULL, 1, false, '2025-09-07 10:20:56.264766');
INSERT INTO public.developer_price_history VALUES (5, 3, NULL, 5300.00, '2025-09-07', NULL, NULL, 1, true, '2025-09-07 10:43:25.335407');
INSERT INTO public.developer_price_history VALUES (3, 4, NULL, 2000.00, '2025-09-07', '2025-09-08', NULL, 1, false, '2025-09-07 10:28:17.561962');
INSERT INTO public.developer_price_history VALUES (6, 4, NULL, 2000.00, '2025-09-08', NULL, 'Moday, Tuesday + half Friday', 1, true, '2025-09-08 16:09:21.482533');


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.documents VALUES (1, 'Enrollment-Volodymyr-Shapovalov (1).pdf', 'contract', 47840, '/uploads/documents/document-1758032674126-793880572.pdf', 1, 1, '2025-09-16 17:24:34.143238', '2025-09-16 17:24:34.143238');
INSERT INTO public.documents VALUES (3, 'all_patients_boldRx.xlsx', 'general', 936803, '/uploads/documents/document-1758033432895-133348700.xlsx', 1, 1, '2025-09-16 17:37:12.910197', '2025-09-16 17:37:12.910197');


--
-- Data for Name: employment_cycles; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.employment_cycles VALUES (6, 10, '2025-09-11', '2026-09-11', false, '2025-09-16 14:50:01.26055', '2026-03-11');
INSERT INTO public.employment_cycles VALUES (7, 10, '2020-09-01', '2021-09-01', false, '2020-09-01 00:00:00', '2021-03-01');
INSERT INTO public.employment_cycles VALUES (8, 10, '2021-09-01', '2022-09-01', false, '2021-09-01 00:00:00', '2022-03-01');
INSERT INTO public.employment_cycles VALUES (9, 10, '2022-09-01', '2023-09-01', false, '2022-09-01 00:00:00', '2023-03-01');
INSERT INTO public.employment_cycles VALUES (10, 10, '2023-09-01', '2024-09-01', false, '2023-09-01 00:00:00', '2024-03-01');
INSERT INTO public.employment_cycles VALUES (5, 11, '2024-11-18', '2025-11-18', true, '2025-09-16 12:59:31.110214', '2025-05-18');
INSERT INTO public.employment_cycles VALUES (17, 12, '2025-09-01', '2026-08-31', true, '2025-10-24 20:44:57.174867', '2026-03-01');
INSERT INTO public.employment_cycles VALUES (11, 10, '2025-01-21', '2026-01-20', true, '2024-09-01 00:00:00', '2025-07-20');


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: financial_data; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.invoices VALUES (5, 1, 'INV-2025-0003', 1330.00, '2024-10-03', '2024-09-01', '2024-09-30', '', 'paid', NULL, '2024-10-03 12:00:00', '', 1, '2025-09-09 15:43:02.950113', '2025-09-09 12:44:17.47');
INSERT INTO public.invoices VALUES (6, 1, 'INV-2025-0004', 2625.00, '2024-11-05', '2024-10-01', '2024-10-31', '', 'paid', NULL, '2024-11-05 12:00:00', 'Development', 1, '2025-09-09 15:46:16.687167', '2025-09-09 12:46:31.608');
INSERT INTO public.invoices VALUES (7, 1, 'INV-2025-0005', 6390.00, '2024-12-02', '2024-11-01', '2024-11-30', 'Development', 'paid', NULL, '2024-12-02 12:00:00', '', 1, '2025-09-09 16:33:30.672604', '2025-09-09 13:33:42.961');
INSERT INTO public.invoices VALUES (8, 1, 'INV-2025-0006', 5625.00, '2025-01-08', '2024-12-01', '2024-12-31', '', 'paid', NULL, '2025-01-08 12:00:00', '', 1, '2025-09-09 16:34:58.534186', '2025-09-09 13:35:09.527');
INSERT INTO public.invoices VALUES (10, 1, 'INV-2025-0008', 7011.00, '2025-03-01', '2025-02-01', '2025-02-28', NULL, 'paid', NULL, '2025-03-01 00:00:00', NULL, 1, '2025-10-29 02:05:17.757213', '2025-10-29 02:05:17.757213');
INSERT INTO public.invoices VALUES (11, 1, 'INV-2025-0009', 8612.00, '2025-04-01', '2025-03-01', '2025-03-31', NULL, 'paid', NULL, '2025-04-01 00:00:00', NULL, 1, '2025-10-29 02:06:09.680845', '2025-10-29 02:06:09.680845');
INSERT INTO public.invoices VALUES (12, 1, 'INV-2025-0010', 7597.00, '2025-05-01', '2025-04-01', '2025-04-30', NULL, 'paid', NULL, '2025-05-01 00:00:00', NULL, 1, '2025-10-29 02:07:43.657837', '2025-10-29 02:07:43.657837');
INSERT INTO public.invoices VALUES (13, 1, 'INV-2025-0011', 10412.00, '2025-06-01', '2025-05-01', '2025-05-31', NULL, 'paid', NULL, '2025-06-01 00:00:00', NULL, 1, '2025-10-29 02:10:35.607356', '2025-10-29 02:10:35.607356');
INSERT INTO public.invoices VALUES (14, 1, 'INV-2025-0012', 9155.00, '2025-07-01', '2025-06-01', '2025-06-30', NULL, 'paid', NULL, '2025-07-01 00:00:00', NULL, 1, '2025-10-29 02:12:33.392846', '2025-10-29 02:12:33.392846');
INSERT INTO public.invoices VALUES (15, 1, 'INV-2025-0013', 12075.00, '2025-08-01', '2025-07-01', '2025-07-31', NULL, 'paid', NULL, '2025-08-01 00:00:00', NULL, 1, '2025-10-29 02:16:00.695128', '2025-10-29 02:16:00.695128');
INSERT INTO public.invoices VALUES (16, 1, 'INV-2025-0014', 9300.00, '2025-09-01', '2025-08-01', '2025-08-31', NULL, 'paid', NULL, '2025-09-01 00:00:00', NULL, 1, '2025-10-29 02:16:44.758419', '2025-10-29 02:16:44.758419');
INSERT INTO public.invoices VALUES (17, 1, 'INV-2025-0015', 11300.00, '2025-10-03', '2025-09-01', '2025-09-30', NULL, 'paid', NULL, '2025-10-03 00:00:00', NULL, 1, '2025-10-29 02:17:16.767041', '2025-10-29 02:17:16.767041');
INSERT INTO public.invoices VALUES (9, 1, 'INV-2025-0007', 8270.00, '2025-02-06', '2025-01-01', '2025-01-31', NULL, 'paid', NULL, '2025-02-10 00:00:00', NULL, 1, '2025-10-29 02:01:52.793459', '2025-10-29 00:21:30.018');
INSERT INTO public.invoices VALUES (32, 1, 'INV-2025-0016', 11300.00, '2025-11-02', '2025-10-31', '2025-11-29', NULL, 'paid', NULL, '2025-11-02 00:00:00', NULL, 1, '2025-11-02 19:41:27.029407', '2025-11-02 19:41:27.029407');
INSERT INTO public.invoices VALUES (33, 4, 'INV-2025-0017', 1500.00, '2025-10-03', '2025-10-31', '2025-11-29', NULL, 'paid', NULL, '2025-10-03 00:00:00', NULL, 1, '2025-11-03 11:38:28.598901', '2025-11-03 11:38:28.598901');
INSERT INTO public.invoices VALUES (34, 4, 'INV-2025-0018', 1500.00, '2025-11-01', '2025-10-31', '2025-11-29', NULL, 'paid', NULL, '2025-11-01 00:00:00', NULL, 1, '2025-11-03 11:39:45.360976', '2025-11-03 11:39:45.360976');
INSERT INTO public.invoices VALUES (35, 4, 'INV-2025-0019', 1000.00, '2025-11-04', '2025-10-31', '2025-11-29', NULL, 'paid', NULL, '2025-11-04 00:00:00', NULL, 1, '2025-11-04 11:57:04.477996', '2025-11-04 11:57:04.477996');


--
-- Data for Name: invoice_services; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: invoice_developers; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.leave_types VALUES (1, 'Vacation', true, true, '2025-09-06 10:46:41.339005');
INSERT INTO public.leave_types VALUES (2, 'Sick Leave', true, true, '2025-09-06 10:46:41.339005');
INSERT INTO public.leave_types VALUES (3, 'Personal Leave', true, true, '2025-09-06 10:46:41.339005');
INSERT INTO public.leave_types VALUES (4, 'Maternity Leave', false, false, '2025-09-06 10:46:41.339005');
INSERT INTO public.leave_types VALUES (5, 'Emergency Leave', true, true, '2025-09-06 10:46:41.339005');


--
-- Data for Name: leave_allocation_settings; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.leave_allocation_settings VALUES (1, 1, 1, 15.0, false, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');
INSERT INTO public.leave_allocation_settings VALUES (3, 2, 1, 20.0, false, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');
INSERT INTO public.leave_allocation_settings VALUES (5, 3, 1, 25.0, true, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');
INSERT INTO public.leave_allocation_settings VALUES (2, 1, 2, 7.0, false, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');
INSERT INTO public.leave_allocation_settings VALUES (4, 2, 2, 7.0, false, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');
INSERT INTO public.leave_allocation_settings VALUES (6, 3, 2, 7.0, true, '2025-09-16 13:22:03.611735', '2025-09-16 13:22:03.611735');


--
-- Data for Name: leave_balances; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.leave_balances VALUES (23, 10, 6, 1, 30.0, 0.0, '2025-09-16 14:50:01.272134', '2025-09-16 14:50:01.272134');
INSERT INTO public.leave_balances VALUES (24, 10, 6, 2, 10.0, 0.0, '2025-09-16 14:50:01.273395', '2025-09-16 14:50:01.273395');
INSERT INTO public.leave_balances VALUES (52, 12, 17, 3, 15.0, 0.0, '2025-10-24 20:44:57.176907', '2025-10-24 20:44:57.176907');
INSERT INTO public.leave_balances VALUES (53, 12, 17, 4, 15.0, 0.0, '2025-10-24 20:44:57.177398', '2025-10-24 20:44:57.177398');
INSERT INTO public.leave_balances VALUES (54, 12, 17, 5, 15.0, 0.0, '2025-10-24 20:44:57.177926', '2025-10-24 20:44:57.177926');
INSERT INTO public.leave_balances VALUES (21, 11, 5, 1, 15.0, 0.0, '2025-09-16 12:59:31.124566', '2025-09-16 12:59:31.124566');
INSERT INTO public.leave_balances VALUES (22, 11, 5, 2, 7.0, 0.0, '2025-09-16 12:59:31.130598', '2025-09-16 12:59:31.130598');
INSERT INTO public.leave_balances VALUES (50, 12, 17, 1, 15.0, 0.0, '2025-10-24 20:44:57.175914', '2025-10-24 20:44:57.175914');
INSERT INTO public.leave_balances VALUES (51, 12, 17, 2, 7.0, 0.0, '2025-10-24 20:44:57.176433', '2025-10-24 20:44:57.176433');


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.leave_requests VALUES (18, 11, 1, 'approved', '2025-10-31', '2025-10-31', false, false, 1.0, NULL, 1, 1, '2025-10-29 22:21:08.305', 'Auto-approved by admin from calendar', '2025-10-30 00:21:08.307001', '2025-10-30 00:21:08.307001');
INSERT INTO public.leave_requests VALUES (19, 11, 1, 'approved', '2025-11-06', '2025-11-06', false, false, 1.0, NULL, 1, 1, '2025-10-29 22:21:27.666', 'Auto-approved by admin from calendar', '2025-10-30 00:21:27.667842', '2025-10-30 00:21:27.667842');
INSERT INTO public.leave_requests VALUES (20, 11, 1, 'approved', '2025-11-07', '2025-11-07', false, false, 1.0, NULL, 1, 1, '2025-10-29 22:21:35.78', 'Auto-approved by admin from calendar', '2025-10-30 00:21:35.781091', '2025-10-30 00:21:35.781091');
INSERT INTO public.leave_requests VALUES (21, 11, 1, 'approved', '2025-11-14', '2025-11-14', false, false, 1.0, NULL, 1, 1, '2025-10-29 22:22:05.367', 'Auto-approved by admin from calendar', '2025-10-30 00:22:05.367809', '2025-10-30 00:22:05.367809');
INSERT INTO public.leave_requests VALUES (23, 10, 1, 'approved', '2025-11-03', '2025-11-07', false, false, 5.0, NULL, 1, 1, '2025-10-29 22:31:05.495', 'Auto-approved by admin from calendar', '2025-10-30 00:31:05.496224', '2025-10-30 00:31:05.496224');
INSERT INTO public.leave_requests VALUES (24, 10, 1, 'approved', '2025-11-10', '2025-11-14', false, false, 5.0, NULL, 1, 1, '2025-10-29 22:31:22.309', 'Auto-approved by admin from calendar', '2025-10-30 00:31:22.311103', '2025-10-30 00:31:22.311103');
INSERT INTO public.leave_requests VALUES (22, 11, 1, 'approved', '2025-11-17', '2025-11-17', false, false, 1.0, NULL, 1, 1, '2025-10-29 22:22:41.487', 'Auto-approved by admin from calendar', '2025-10-30 00:22:41.487427', '2025-10-30 00:22:41.487427');


--
-- Data for Name: leave_request_events; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.leave_request_events VALUES (39, 18, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:21:08.313774');
INSERT INTO public.leave_request_events VALUES (40, 19, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:21:27.671753');
INSERT INTO public.leave_request_events VALUES (41, 20, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:21:35.782584');
INSERT INTO public.leave_request_events VALUES (42, 21, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:22:05.373505');
INSERT INTO public.leave_request_events VALUES (43, 22, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:22:41.492377');
INSERT INTO public.leave_request_events VALUES (44, 23, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:31:05.500735');
INSERT INTO public.leave_request_events VALUES (45, 24, 'approved', 1, 'Auto-approved by admin from calendar', '2025-10-30 00:31:22.3168');
INSERT INTO public.leave_request_events VALUES (46, 22, 'approved', 1, 'Request details updated by admin', '2025-10-30 12:57:51.950016');


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: reimbursement_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.reimbursement_requests VALUES (1, 11, 2025, 278.00, 139.00, 'erserse esser', 'chair', 'confirmed', 7, '2025-10-25 11:45:23.08002', 1, '2025-10-25 08:46:21.546', 'rw3ew3er', '/uploads/evidence-1761653613036-59254472.jpg', '2025-10-28 12:13:33.073', '2025-10-25 11:45:23.08002', '2025-10-28 12:13:33.073');


--
-- Data for Name: service_requests; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: shift_schedules; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.shifts VALUES (1, 12, NULL, '2025-10-29 17:07:32.248', '2025-10-29 17:07:54.408', 'completed', false, 0, NULL, '2025-10-29 19:07:32.251758', '2025-10-29 17:07:54.408');
INSERT INTO public.shifts VALUES (2, 12, NULL, '2025-10-29 17:07:56.074', '2025-10-29 17:08:18.641', 'completed', false, 0, NULL, '2025-10-29 19:07:56.076986', '2025-10-29 17:08:18.641');
INSERT INTO public.shifts VALUES (3, 12, NULL, '2025-10-29 17:08:38.071', '2025-10-29 17:09:12.742', 'completed', false, 0, NULL, '2025-10-29 19:08:38.072533', '2025-10-29 17:09:12.742');
INSERT INTO public.shifts VALUES (5, 10, NULL, '2025-10-29 17:09:31.493', '2025-10-29 18:03:39.463', 'completed', false, 0, NULL, '2025-10-29 19:09:31.49514', '2025-10-29 18:03:39.463');
INSERT INTO public.shifts VALUES (6, 11, NULL, '2025-10-29 17:09:38.75', '2025-10-29 22:50:38.417', 'completed', false, 0, NULL, '2025-10-29 19:09:38.752425', '2025-10-29 22:50:38.417');
INSERT INTO public.shifts VALUES (7, 10, NULL, '2025-10-29 18:03:42.887', '2025-10-29 22:50:50.518', 'completed', false, 0, NULL, '2025-10-29 20:03:42.895206', '2025-10-29 22:50:50.518');
INSERT INTO public.shifts VALUES (4, 12, NULL, '2025-10-29 17:09:23.693', '2025-10-29 22:50:58.39', 'completed', false, 0, NULL, '2025-10-29 19:09:23.695654', '2025-10-29 22:50:58.39');
INSERT INTO public.shifts VALUES (8, 11, NULL, '2025-10-30 11:20:59.429', '2025-10-31 10:33:55.345', 'completed', false, 0, NULL, '2025-10-30 13:20:59.435217', '2025-10-31 10:33:55.345');
INSERT INTO public.shifts VALUES (9, 10, NULL, '2025-10-31 21:38:41.593', '2025-10-31 21:38:54.575', 'completed', false, 0, NULL, '2025-10-31 23:38:41.596743', '2025-10-31 21:38:54.575');


--
-- Data for Name: shift_breaks; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.shift_breaks VALUES (1, 1, '2025-10-29 17:07:45.236', '2025-10-29 17:07:50.312', 'regular', NULL, '2025-10-29 19:07:45.237395');
INSERT INTO public.shift_breaks VALUES (2, 2, '2025-10-29 17:08:16.226', '2025-10-29 17:08:18.64', 'regular', NULL, '2025-10-29 19:08:16.226564');
INSERT INTO public.shift_breaks VALUES (3, 3, '2025-10-29 17:08:54.297', '2025-10-29 17:09:12.74', 'regular', NULL, '2025-10-29 19:08:54.299182');
INSERT INTO public.shift_breaks VALUES (4, 5, '2025-10-29 17:09:32.386', '2025-10-29 18:03:39.459', 'regular', NULL, '2025-10-29 19:09:32.387013');
INSERT INTO public.shift_breaks VALUES (5, 6, '2025-10-29 18:04:19.119', '2025-10-29 22:50:38.413', 'regular', NULL, '2025-10-29 20:04:19.119659');
INSERT INTO public.shift_breaks VALUES (6, 9, '2025-10-31 21:38:47.792', '2025-10-31 21:38:50.412', 'regular', NULL, '2025-10-31 23:38:47.793068');


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--



--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: volodymyrshapovalov
--

INSERT INTO public.user_sessions VALUES ('S6w7gisffDV09HAI17CQlcPKC_HN5et1', '{"cookie":{"originalMaxAge":86400000,"expires":"2025-12-05T11:21:23.502Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":{"id":1}}}', '2025-12-05 13:22:26');
INSERT INTO public.user_sessions VALUES ('h3JdJgs1Nr8gXmvxWdOro_4YOu1mEWFR', '{"cookie":{"originalMaxAge":86400000,"expires":"2025-12-02T10:37:49.373Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":{"id":1}}}', '2025-12-02 15:27:12');


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 3, true);


--
-- Name: client_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_contacts_id_seq', 1, true);


--
-- Name: client_service_developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_service_developers_id_seq', 7, true);


--
-- Name: client_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_services_id_seq', 8, true);


--
-- Name: client_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.client_users_id_seq', 2, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.clients_id_seq', 4, true);


--
-- Name: developer_price_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.developer_price_history_id_seq', 6, true);


--
-- Name: developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.developers_id_seq', 8, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.documents_id_seq', 3, true);


--
-- Name: employment_cycles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.employment_cycles_id_seq', 18, true);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.feedback_id_seq', 1, false);


--
-- Name: financial_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.financial_data_id_seq', 1, false);


--
-- Name: invoice_developers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoice_developers_id_seq', 1, false);


--
-- Name: invoice_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoice_services_id_seq', 1, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.invoices_id_seq', 35, true);


--
-- Name: leave_allocation_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_allocation_settings_id_seq', 6, true);


--
-- Name: leave_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_balances_id_seq', 59, true);


--
-- Name: leave_request_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_request_events_id_seq', 46, true);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 24, true);


--
-- Name: leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.leave_types_id_seq', 15, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: reimbursement_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.reimbursement_requests_id_seq', 1, true);


--
-- Name: service_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.service_requests_id_seq', 1, false);


--
-- Name: service_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.service_types_id_seq', 27, true);


--
-- Name: shift_breaks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shift_breaks_id_seq', 6, true);


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shift_schedules_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.shifts_id_seq', 9, true);


--
-- Name: team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.team_members_id_seq', 16, true);


--
-- Name: time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.time_entries_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: volodymyrshapovalov
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Lmu6x0Iw4mNFwp4joFShpBImMQ1Nor1RvjcFuKYO9CjPgen9cDXjbURwkLtE2UP

