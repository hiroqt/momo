-- Disposable local gateway login only; never apply to hosted application data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'local-gateway-only';
GRANT anon, authenticated, service_role TO authenticator;
