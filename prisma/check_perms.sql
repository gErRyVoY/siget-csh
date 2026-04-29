SELECT p."rolId", r.rol, p."categoriaId", c.nombre as categoria, p."subcategoriaId", s.nombre as subcategoria
FROM "permiso_categoria" p
JOIN "rol" r ON p."rolId" = r.id
LEFT JOIN "categoria" c ON p."categoriaId" = c.id
LEFT JOIN "subcategoria" s ON p."subcategoriaId" = s.id
WHERE p."rolId" IN (2, 6)
ORDER BY p."rolId", p."categoriaId", p."subcategoriaId";
