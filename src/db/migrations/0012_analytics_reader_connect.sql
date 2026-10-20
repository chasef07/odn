DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO "analytics_reader"', current_database());
END
$$;
