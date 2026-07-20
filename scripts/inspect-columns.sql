SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuario', 'rol')
ORDER BY table_name, ordinal_position;
