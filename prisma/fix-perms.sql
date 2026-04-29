INSERT INTO "permiso_categoria" ("rolId", "categoriaId", "subcategoriaId", "updatedAt")
SELECT r.rolId, c.id, r.subcategoriaId, NOW()
FROM (VALUES 
  -- Ingeniero soporte 1 (ID: 2)
  (2, 1, CAST(null AS int)),
  (2, 2, null),
  (2, 3, null),
  (2, 4, null),
  (2, 5, null),
  (2, 11, null),

  -- Ingeniero Hubspot (ID: 16)
  (16, 1, null),
  (16, 2, null),
  (16, 3, null),
  (16, 4, null),
  (16, 5, null),
  (16, 8, null),
  (16, 9, null),
  (16, 11, null),
  (16, 1, 58),

  -- Soporte técnico (ID: 28)
  (28, 1, null),
  (28, 2, null),
  (28, 3, null),
  (28, 4, null),
  (28, 5, null),
  (28, 11, null),
  (28, 1, 9),
  (28, 1, 58),
  (28, 3, 67)
) AS r(rolId, categoriaId, subcategoriaId)
JOIN "categoria" c ON r.categoriaId = c.id
JOIN "rol" rl ON r.rolId = rl.id
ON CONFLICT ("rolId", "categoriaId", "subcategoriaId") DO NOTHING;
