-- ============================================================================
-- 99-roles.sql -- mounted to /docker-entrypoint-initdb.d/ in supabase/postgres
--
-- Runs ONCE on volume creation, BEFORE supautils starts enforcing
-- "reserved role" protections. This is the only window we get to set the
-- passwords on these auth/rest service roles -- after this, the supautils
-- extension blocks even the postgres superuser from running ALTER USER on
-- them. Same approach the official Supabase docker bundle uses.
--
-- POSTGRES_PASSWORD is read from the container's environment via psql's
-- backtick command substitution into a psql variable.
-- ============================================================================

\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator         WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin   WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
