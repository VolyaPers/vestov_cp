-- Script para inserir usuários corretamente no DEV
-- Ordem das colunas conforme schema atual:
-- id, username, password, full_name, email, role, position, avatar_url, 
-- team_member_id, is_active, last_login_at, google_id, auth_provider, 
-- created_at, updated_at

-- Admin user
INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
VALUES 
  (1, 'admin', '$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m', 'System Administrator', 'v@vestov.com', 'admin', 'System Administrator', NULL, NULL, true, NULL, NULL, NULL, '2025-09-06 10:46:41.687777', '2025-10-25 08:16:19.951')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  updated_at = EXCLUDED.updated_at;

-- Client user (Kamran)
INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
VALUES 
  (2, 'kamran', '$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2', 'Kamran', 'john.smith@techcorp.com', 'client', 'CEO', NULL, NULL, true, NULL, NULL, NULL, '2025-09-06 10:46:41.983743', '2025-10-26 19:18:35.763')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  updated_at = EXCLUDED.updated_at;

-- Team member: Eduardo Cerato
INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
VALUES 
  (7, 'eduardo', '$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG', 'Eduardo Cerato', 'eduardo.cerato@vestov.com', 'team_member', 'Full-Stack Developer', NULL, 11, true, NULL, NULL, NULL, '2025-10-25 00:56:03.767059', '2025-10-25 00:56:03.767059')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  team_member_id = EXCLUDED.team_member_id,
  updated_at = EXCLUDED.updated_at;

-- Team member: Sergei Vasilenko
INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
VALUES 
  (8, 's.vasilenko', '$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6', 'Sergei Vasilenko', 's.vasilenko@vestov.com', 'team_member', '', NULL, 10, true, NULL, NULL, NULL, '2025-10-27 16:10:35.508461', '2025-10-27 16:10:35.508461')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  team_member_id = EXCLUDED.team_member_id,
  updated_at = EXCLUDED.updated_at;

-- Team member: Jéssica Ferreira
INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
VALUES 
  (9, 'j.ferreira', '$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O', 'Jéssica Ferreira', 'j.ferreira@vestov.com', 'team_member', '', NULL, 12, true, NULL, NULL, NULL, '2025-10-27 21:12:24.595956', '2025-10-27 21:12:24.595956')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  team_member_id = EXCLUDED.team_member_id,
  updated_at = EXCLUDED.updated_at;

