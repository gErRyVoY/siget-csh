
import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { parse } from "csv-parse/sync";

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!file.name.endsWith(".csv")) {
            return new Response(JSON.stringify({ error: "Invalid file type. Only CSV allowed." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const text = await file.text();
        const records = parse(text, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        const REQUIRED_COLUMNS = ["nombres", "apellidos", "mail", "empresa_slug", "rol_nombre"];

        // If there are records, check the first one's keys to validate headers
        if (records.length > 0) {
            const headers = Object.keys(records[0] as Record<string, any>);
            const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
            const extraColumns = headers.filter(col => !REQUIRED_COLUMNS.includes(col));

            if (missingColumns.length > 0) {
                return new Response(JSON.stringify({
                    error: "Invalid CSV structure",
                    details: {
                        missing: missingColumns,
                        found: headers,
                        required: REQUIRED_COLUMNS
                    }
                }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                });
            }
        } else if (text.trim() && !text.includes(",")) {
            // Heuristic for "zero columns found" / wrong delimiter
            return new Response(JSON.stringify({
                error: "Invalid CSV format",
                details: "No columns detected. Ensure the file uses commas as delimiters."
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as { row: number; message: string; data: any }[],
        };

        // Pre-fetch roles and companies for caching to avoid N+1 queries
        const roles = await prisma.rol.findMany();
        const empresas = await prisma.empresa.findMany();

        const roleMap = new Map(roles.map((r) => [r.rol.toLowerCase(), r.id]));
        const empresaMap = new Map(empresas.map((e) => [e.slug.toLowerCase(), e.id]));

        interface UserImportRow {
            nombres: string;
            apellidos: string;
            mail: string;
            empresa_slug: string;
            rol_nombre: string;
        }

        // Transactional processing not strictly required for bulk upload report, 
        // but useful if we wanted all-or-nothing. 
        // Here we will do "best effort" and report failures.

        for (let i = 0; i < records.length; i++) {
            const row = records[i] as UserImportRow;
            const rowNum = i + 2; // +2 accounting for header and 0-index

            const { nombres, apellidos, mail, empresa_slug, rol_nombre } = row;

            // Basic Validation
            if (!nombres || !apellidos || !mail || !empresa_slug || !rol_nombre) {
                results.failed++;
                results.errors.push({
                    row: rowNum,
                    message: "Missing required fields (nombres, apellidos, mail, empresa_slug, rol_nombre)",
                    data: row,
                });
                continue;
            }

            // Email Format Validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(mail)) {
                results.failed++;
                results.errors.push({ row: rowNum, message: "Invalid email format", data: row });
                continue;
            }

            // Existence Validation
            const empresaId = empresaMap.get(empresa_slug.toLowerCase());
            if (!empresaId) {
                results.failed++;
                results.errors.push({ row: rowNum, message: `Empresa slug '${empresa_slug}' not found`, data: row });
                continue;
            }

            const rolId = roleMap.get(rol_nombre.toLowerCase());
            if (!rolId) {
                results.failed++;
                results.errors.push({ row: rowNum, message: `Rol '${rol_nombre}' not found`, data: row });
                continue;
            }

            // Duplicate Email Check
            const existingUser = await prisma.usuario.findUnique({ where: { mail } });
            if (existingUser) {
                results.failed++;
                results.errors.push({ row: rowNum, message: `Email '${mail}' already exists`, data: row });
                continue;
            }

            try {
                await prisma.usuario.create({
                    data: {
                        nombres,
                        apellidos,
                        mail,
                        empresaId,
                        rolId,
                        activo: true, // Default active
                        // No password field in schema provided! Auth is likely via Google or similar.
                        // If local auth was needed, we'd need a password field.
                        // Based on schema, only 'mail' is unique identifier.
                    },
                });
                results.success++;
            } catch (e: any) {
                results.failed++;
                results.errors.push({ row: rowNum, message: `Database error: ${e.message}`, data: row });
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("CSV Import Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
