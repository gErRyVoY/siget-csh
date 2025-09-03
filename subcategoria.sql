-- Crear tabla subcategoria
CREATE TABLE subcategoria (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  parent_subcategoria_id INT,
  nivel_soporte_requerido VARCHAR(20),
  activo BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_parent_subcategoria FOREIGN KEY (parent_subcategoria_id) REFERENCES subcategoria(id) ON DELETE RESTRICT
);

-- Inserts para subcategorías únicas (85 valores únicos, IDs remapeados)
INSERT INTO subcategoria (nombre, parent_subcategoria_id, nivel_soporte_requerido, activo) VALUES
('Académico', NULL, NULL, TRUE), -- ID 1
('Calificaciones', 1, NULL, TRUE), -- ID 2
('Histórico', 2, NULL, TRUE), -- ID 3
('Kardex', 2, NULL, TRUE), -- ID 4
('Replicar calificaciones', 2, NULL, TRUE), -- ID 5
('Horario', 1, NULL, TRUE), -- ID 6
('Selección de materias', 1, NULL, TRUE), -- ID 7
('Aplicación móvil', NULL, NULL, TRUE), -- ID 8
('Correo institucional', NULL, NULL, TRUE), -- ID 9
('Actualizar', 9, NULL, TRUE), -- ID 10
('Desbloqueo / reactivar', 9, NULL, TRUE), -- ID 11
('Generar correo', 9, NULL, TRUE), -- ID 12
('Redireccionar', 9, NULL, TRUE), -- ID 13
('Restablecer contraseña', 9, 'S-2', TRUE), -- ID 14
('Datos fiscales', NULL, NULL, TRUE), -- ID 15
('Documentos', NULL, NULL, TRUE), -- ID 16
('Expediente', NULL, NULL, TRUE), -- ID 17
('Nacionalidad', 17, NULL, TRUE), -- ID 18
('Situación', 17, NULL, TRUE), -- ID 19
('Turno', 17, NULL, TRUE), -- ID 20
('Otro', 17, NULL, TRUE), -- ID 21
('Finanzas (estado de cuenta)', NULL, NULL, TRUE), -- ID 22
('Becas', 22, NULL, TRUE), -- ID 23
('Cobros', 22, NULL, TRUE), -- ID 24
('BBVA', 24, NULL, TRUE), -- ID 25
('CoDi', 24, NULL, TRUE), -- ID 26
('En campus', 24, NULL, TRUE), -- ID 27
('TPV (pin pad)', 27, NULL, TRUE), -- ID 28
('Aplicación TPV', 27, NULL, TRUE), -- ID 29
('Flywire', 24, NULL, TRUE), -- ID 30
('PayPal', 24, NULL, TRUE), -- ID 31
('OXXO', 24, NULL, TRUE), -- ID 32
('Descuentos', 22, NULL, TRUE), -- ID 33
('Convenios', 33, NULL, TRUE), -- ID 34
('Inscripción', 33, NULL, TRUE), -- ID 35
('Personales', 33, NULL, TRUE), -- ID 36
('Referidos', 33, NULL, TRUE), -- ID 37
('Retiro de cargos', 33, NULL, TRUE), -- ID 38
('Facturas', 22, NULL, TRUE), -- ID 39
('Notas aclaratorias', 22, NULL, TRUE), -- ID 40
('Plan de pagos', 22, NULL, TRUE), -- ID 41
('Registro de Pagos', 22, NULL, TRUE), -- ID 42
('Colegiatura', 42, NULL, TRUE), -- ID 43
('Ceremonia de graduación', 42, NULL, TRUE), -- ID 44
('Trámites escolares', 42, NULL, TRUE), -- ID 45
('4ta. materia', 45, NULL, TRUE), -- ID 46
('Certificado', 45, NULL, TRUE), -- ID 47
('Constancia', 45, NULL, TRUE), -- ID 48
('Credencial', 45, NULL, TRUE), -- ID 49
('Derecho de titulación', 45, NULL, TRUE), -- ID 50
('Dictamen de equivalencias', 45, NULL, TRUE), -- ID 51
('Otros', 42, NULL, TRUE), -- ID 52
('Foto', NULL, NULL, TRUE), -- ID 53
('Historial de estados', NULL, NULL, TRUE), -- ID 54
('Plataforma Humanitas', NULL, NULL, TRUE), -- ID 55
('Restablecer acceso', 55, NULL, TRUE), -- ID 56
('Servicio social', NULL, NULL, TRUE), -- ID 57
('Traslado', NULL, NULL, TRUE), -- ID 58
('Asignación', NULL, NULL, TRUE), -- ID 59
('Estatus asignados', NULL, NULL, TRUE), -- ID 60
('Finanzas', NULL, NULL, TRUE), -- ID 61
('Generar fichas', 61, NULL, TRUE), -- ID 62
('Generar matrícula', NULL, NULL, TRUE), -- ID 63
('Perfil', NULL, NULL, TRUE), -- ID 64
('Actualizar información', 64, NULL, TRUE), -- ID 65
('Altas (nuevo ingreso)', NULL, NULL, TRUE), -- ID 66
('Creación de correo institucional', 66, NULL, TRUE), -- ID 67
('Acceso a plataforma', 66, NULL, TRUE), -- ID 68
('Acceso a Teambook', 66, NULL, TRUE), -- ID 69
('Replicar permisos', 66, NULL, TRUE), -- ID 70
('Bajas', NULL, NULL, TRUE), -- ID 71
('Redireccionar correo institucional', 71, NULL, TRUE), -- ID 72
('Configuración APP TPV', NULL, NULL, TRUE), -- ID 73
('Permisos', 55, NULL, TRUE), -- ID 74
('Teambook', NULL, NULL, TRUE), -- ID 75
('Registro de asistencia', 8, NULL, TRUE), -- ID 76
('Reset de dispositivo', 8, NULL, TRUE), -- ID 77
('Consultas', NULL, NULL, TRUE), -- ID 78
('Grupos', NULL, NULL, TRUE), -- ID 79
('Actividades', 79, NULL, TRUE), -- ID 80
('Cuestionarios', 79, NULL, TRUE), -- ID 81
('Listas', 79, NULL, TRUE), -- ID 82
('Clases', 79, NULL, TRUE), -- ID 83
('Foros', 79, NULL, TRUE), -- ID 84
('Contratos', 79, NULL, TRUE), -- ID 85
('Lista negra', NULL, NULL, TRUE), -- ID 86
('Google Meet: licencia para grabar', NULL, NULL, TRUE), -- ID 87
('Activar descuentos', 61, NULL, TRUE), -- ID 88
('Docentes', 23, NULL, TRUE), -- ID 89
('Colaboradores', 23, NULL, TRUE); -- ID 90

-- Crear tabla subcategoria_categorias
CREATE TABLE subcategoria_categorias (
  id SERIAL PRIMARY KEY,
  categoria_id INT NOT NULL,
  subcategoria_id INT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_categoria FOREIGN KEY (categoria_id) REFERENCES categoria(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subcategoria FOREIGN KEY (subcategoria_id) REFERENCES subcategoria(id) ON DELETE RESTRICT,
  UNIQUE (categoria_id, subcategoria_id)
);

-- Inserts para subcategoria_categorias (vínculos agrupados por categorías del documento)
INSERT INTO subcategoria_categorias (categoria_id, subcategoria_id, activo) VALUES
-- Categoría 1: Alumnos
(1, 1, TRUE),  -- Académico
(1, 2, TRUE),  -- Calificaciones
(1, 3, TRUE),  -- Histórico
(1, 4, TRUE),  -- Kardex
(1, 5, TRUE),  -- Replicar calificaciones
(1, 6, TRUE),  -- Horario
(1, 7, TRUE),  -- Selección de materias
(1, 8, TRUE),  -- Aplicación móvil
(1, 9, TRUE),  -- Correo institucional
(1, 10, TRUE), -- Actualizar
(1, 11, TRUE), -- Desbloqueo / reactivar
(1, 12, TRUE), -- Generar correo
(1, 13, TRUE), -- Redireccionar
(1, 14, TRUE), -- Restablecer contraseña
(1, 15, TRUE), -- Datos fiscales
(1, 16, TRUE), -- Documentos
(1, 17, TRUE), -- Expediente
(1, 18, TRUE), -- Nacionalidad
(1, 19, TRUE), -- Situación
(1, 20, TRUE), -- Turno
(1, 21, TRUE), -- Otro (Expediente)
(1, 22, TRUE), -- Finanzas (estado de cuenta)
(1, 23, TRUE), -- Becas
(1, 24, TRUE), -- Cobros
(1, 25, TRUE), -- BBVA
(1, 26, TRUE), -- CoDi
(1, 27, TRUE), -- En campus
(1, 28, TRUE), -- TPV (pin pad)
(1, 29, TRUE), -- Aplicación TPV
(1, 30, TRUE), -- Flywire
(1, 31, TRUE), -- PayPal
(1, 32, TRUE), -- OXXO
(1, 33, TRUE), -- Descuentos
(1, 34, TRUE), -- Convenios
(1, 35, TRUE), -- Inscripción
(1, 36, TRUE), -- Personales
(1, 37, TRUE), -- Referidos
(1, 38, TRUE), -- Retiro de cargos
(1, 39, TRUE), -- Facturas
(1, 40, TRUE), -- Notas aclaratorias
(1, 41, TRUE), -- Plan de pagos
(1, 42, TRUE), -- Registro de Pagos
(1, 43, TRUE), -- Colegiatura
(1, 44, TRUE), -- Ceremonia de graduación
(1, 45, TRUE), -- Trámites escolares
(1, 46, TRUE), -- 4ta. materia
(1, 47, TRUE), -- Certificado
(1, 48, TRUE), -- Constancia
(1, 49, TRUE), -- Credencial
(1, 50, TRUE), -- Derecho de titulación
(1, 51, TRUE), -- Dictamen de equivalencias
(1, 52, TRUE), -- Otros (Registro de Pagos)
(1, 53, TRUE), -- Foto
(1, 54, TRUE), -- Historial de estados
(1, 55, TRUE), -- Plataforma Humanitas
(1, 56, TRUE), -- Restablecer acceso
(1, 57, TRUE), -- Servicio social
(1, 58, TRUE), -- Traslado
(1, 21, TRUE), -- Otro (raíz)
-- Categoría 2: Aspirantes
(2, 59, TRUE), -- Asignación
(2, 60, TRUE), -- Estatus asignados
(2, 61, TRUE), -- Finanzas
(2, 33, TRUE), -- Descuentos
(2, 34, TRUE), -- Convenios
(2, 35, TRUE), -- Inscripción
(2, 62, TRUE), -- Generar fichas
(2, 41, TRUE), -- Plan de pagos
(2, 63, TRUE), -- Generar matrícula
(2, 64, TRUE), -- Perfil
(2, 65, TRUE), -- Actualizar información
(2, 18, TRUE), -- Nacionalidad
(2, 37, TRUE), -- Referidos
(2, 21, TRUE), -- Otro
-- Categoría 3: Administración
(3, 8, TRUE),  -- Aplicación móvil
(3, 79, TRUE), -- Actualizar perfil
(3, 66, TRUE), -- Altas (nuevo ingreso)
(3, 67, TRUE), -- Creación de correo institucional
(3, 68, TRUE), -- Acceso a plataforma
(3, 69, TRUE), -- Acceso a Teambook
(3, 70, TRUE), -- Replicar permisos
(3, 71, TRUE), -- Bajas
(3, 72, TRUE), -- Redireccionar correo institucional
(3, 14, TRUE), -- Restablecer contraseña
(3, 73, TRUE), -- Configuración APP TPV
(3, 9, TRUE),  -- Correo institucional
(3, 10, TRUE), -- Actualizar
(3, 11, TRUE), -- Desbloqueo / reactivar
(3, 12, TRUE), -- Generar correo
(3, 13, TRUE), -- Redireccionar
(3, 55, TRUE), -- Plataforma Humanitas
(3, 74, TRUE), -- Permisos
(3, 75, TRUE), -- Teambook
(3, 21, TRUE), -- Otro
-- Categoría 4: Docentes
(4, 8, TRUE),  -- Aplicación móvil
(4, 76, TRUE), -- Registro de asistencia
(4, 77, TRUE), -- Reset de dispositivo
(4, 78, TRUE), -- Consultas
(4, 17, TRUE), -- Expediente
(4, 9, TRUE),  -- Correo institucional
(4, 79, TRUE), -- Correo personal
(4, 21, TRUE), -- Otro (Expediente)
(4, 53, TRUE), -- Foto
(4, 79, TRUE), -- Grupos
(4, 80, TRUE), -- Actividades
(4, 81, TRUE), -- Cuestionarios
(4, 82, TRUE), -- Listas
(4, 83, TRUE), -- Clases
(4, 84, TRUE), -- Foros
(4, 85, TRUE), -- Contratos
(4, 86, TRUE), -- Lista negra
(4, 55, TRUE), -- Plataforma Humanitas
(4, 14, TRUE), -- Restablecer contraseña
(4, 87, TRUE), -- Google Meet: licencia para grabar
(4, 9, TRUE),  -- Correo institucional
(4, 10, TRUE), -- Actualizar
(4, 11, TRUE), -- Desbloqueo / reactivar
(4, 12, TRUE), -- Generar correo
(4, 13, TRUE), -- Redireccionar
(4, 21, TRUE), -- Otro
-- Categoría 5: Finanzas
(5, 55, TRUE), -- Plataforma Humanitas
(5, 61, TRUE), -- Finanzas
(5, 88, TRUE), -- Activar descuentos
(5, 23, TRUE), -- Becas
(5, 89, TRUE), -- Docentes
(5, 90, TRUE), -- Colaboradores
(5, 21, TRUE), -- Otro
(5, 24, TRUE), -- Cobros
(5, 25, TRUE), -- BBVA
(5, 26, TRUE), -- CoDi
(5, 27, TRUE), -- En campus
(5, 28, TRUE), -- TPV (pin pad)
(5, 29, TRUE); -- Aplicación TPV