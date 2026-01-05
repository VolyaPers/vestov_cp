-- Script para inserir/atualizar usuários corretamente no DEV
-- Usa DO blocks para verificar e atualizar ou inserir

-- Admin user
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 1) THEN
    UPDATE public.users SET
      username = 'admin',
      password = '$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m',
      full_name = 'System Administrator',
      email = 'v@vestov.com',
      role = 'admin',
      position = 'System Administrator',
      updated_at = '2025-10-25 08:16:19.951'
    WHERE id = 1;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE username = 'admin' OR email = 'v@vestov.com') THEN
    -- User exists with different ID, update it
    UPDATE public.users SET
      password = '$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m',
      full_name = 'System Administrator',
      role = 'admin',
      position = 'System Administrator',
      updated_at = '2025-10-25 08:16:19.951'
    WHERE username = 'admin' OR email = 'v@vestov.com';
  ELSE
    INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
    VALUES (1, 'admin', '$2a$12$ONrJbwGSk9t2GndTJHq3U.EVH1TYbVtLewnvos6cZIfCm0.PxAv8m', 'System Administrator', 'v@vestov.com', 'admin', 'System Administrator', NULL, NULL, true, NULL, NULL, NULL, '2025-09-06 10:46:41.687777', '2025-10-25 08:16:19.951');
  END IF;
END $$;

-- Client user (Kamran)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 2) THEN
    UPDATE public.users SET
      username = 'kamran',
      password = '$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2',
      full_name = 'Kamran',
      email = 'john.smith@techcorp.com',
      role = 'client',
      position = 'CEO',
      updated_at = '2025-10-26 19:18:35.763'
    WHERE id = 2;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE username = 'kamran' OR email = 'john.smith@techcorp.com') THEN
    UPDATE public.users SET
      password = '$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2',
      full_name = 'Kamran',
      role = 'client',
      position = 'CEO',
      updated_at = '2025-10-26 19:18:35.763'
    WHERE username = 'kamran' OR email = 'john.smith@techcorp.com';
  ELSE
    INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
    VALUES (2, 'kamran', '$2b$10$.2fu2u2K98jpgdZM0qxl5.Q9LCheguxwDLDaH3xvBHzLE5kmUH1E2', 'Kamran', 'john.smith@techcorp.com', 'client', 'CEO', NULL, NULL, true, NULL, NULL, NULL, '2025-09-06 10:46:41.983743', '2025-10-26 19:18:35.763');
  END IF;
END $$;

-- Team member: Eduardo Cerato
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 7) THEN
    UPDATE public.users SET
      username = 'eduardo',
      password = '$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG',
      full_name = 'Eduardo Cerato',
      email = 'eduardo.cerato@vestov.com',
      role = 'team_member',
      position = 'Full-Stack Developer',
      team_member_id = 11,
      updated_at = '2025-10-25 00:56:03.767059'
    WHERE id = 7;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE username = 'eduardo' OR email = 'eduardo.cerato@vestov.com') THEN
    UPDATE public.users SET
      password = '$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG',
      full_name = 'Eduardo Cerato',
      role = 'team_member',
      position = 'Full-Stack Developer',
      team_member_id = 11,
      updated_at = '2025-10-25 00:56:03.767059'
    WHERE username = 'eduardo' OR email = 'eduardo.cerato@vestov.com';
  ELSE
    INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
    VALUES (7, 'eduardo', '$2a$12$9RpUKZPssl4NNexdgpy0N.veiG3Is51tn/RSNOcyq.XjLyPXRATrG', 'Eduardo Cerato', 'eduardo.cerato@vestov.com', 'team_member', 'Full-Stack Developer', NULL, 11, true, NULL, NULL, NULL, '2025-10-25 00:56:03.767059', '2025-10-25 00:56:03.767059');
  END IF;
END $$;

-- Team member: Sergei Vasilenko
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 8) THEN
    UPDATE public.users SET
      username = 's.vasilenko',
      password = '$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6',
      full_name = 'Sergei Vasilenko',
      email = 's.vasilenko@vestov.com',
      role = 'team_member',
      position = '',
      team_member_id = 10,
      updated_at = '2025-10-27 16:10:35.508461'
    WHERE id = 8;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE username = 's.vasilenko' OR email = 's.vasilenko@vestov.com') THEN
    UPDATE public.users SET
      password = '$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6',
      full_name = 'Sergei Vasilenko',
      role = 'team_member',
      position = '',
      team_member_id = 10,
      updated_at = '2025-10-27 16:10:35.508461'
    WHERE username = 's.vasilenko' OR email = 's.vasilenko@vestov.com';
  ELSE
    INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
    VALUES (8, 's.vasilenko', '$2b$10$92/.1OAnFStDA.Gy0xMh8O3/mJmVv5z08Jd5BrcFAyYNGMwS6MXX6', 'Sergei Vasilenko', 's.vasilenko@vestov.com', 'team_member', '', NULL, 10, true, NULL, NULL, NULL, '2025-10-27 16:10:35.508461', '2025-10-27 16:10:35.508461');
  END IF;
END $$;

-- Team member: Jéssica Ferreira
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = 9) THEN
    UPDATE public.users SET
      username = 'j.ferreira',
      password = '$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O',
      full_name = 'Jéssica Ferreira',
      email = 'j.ferreira@vestov.com',
      role = 'team_member',
      position = '',
      team_member_id = 12,
      updated_at = '2025-10-27 21:12:24.595956'
    WHERE id = 9;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE username = 'j.ferreira' OR email = 'j.ferreira@vestov.com') THEN
    UPDATE public.users SET
      password = '$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O',
      full_name = 'Jéssica Ferreira',
      role = 'team_member',
      position = '',
      team_member_id = 12,
      updated_at = '2025-10-27 21:12:24.595956'
    WHERE username = 'j.ferreira' OR email = 'j.ferreira@vestov.com';
  ELSE
    INSERT INTO public.users (id, username, password, full_name, email, role, position, avatar_url, team_member_id, is_active, last_login_at, google_id, auth_provider, created_at, updated_at)
    VALUES (9, 'j.ferreira', '$2b$10$pek2hdWpjA6nffhy3POv0OiTDTJ7b/iyYUdco.pGZZYyPydhFxm4O', 'Jéssica Ferreira', 'j.ferreira@vestov.com', 'team_member', '', NULL, 12, true, NULL, NULL, NULL, '2025-10-27 21:12:24.595956', '2025-10-27 21:12:24.595956');
  END IF;
END $$;

