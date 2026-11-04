SELECT created_at, category, message, app_build
FROM feedback
ORDER BY created_at DESC
LIMIT 100;
