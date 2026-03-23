/**
 * Script para insertar usuarios de prueba en la tabla `users`.
 * Uso: `node src/scripts/seedUsers.js`
 * Asegúrate de que las variables de entorno (SUPABASE URL/KEY) están configuradas.
 */

import { supabase as defaultSupabase } from "../DAO/connection.js";
import { createClient } from "@supabase/supabase-js";
import config from "../config.js";

// Usar la service role key para bypass RLS en scripts de servidor.
// No guardar la service role key en el repositorio.
const SERVICE_KEY = process.env.SUPABASE_KEY;
if (!SERVICE_KEY) {
  console.warn("Advertencia: SUPABASE_SERVICE_ROLE_KEY no encontrada. Si la tabla tiene RLS habilitado, la inserción fallará. Ejecuta el script con la service role key o ajusta las políticas RLS.");
}

const supabase = SERVICE_KEY ? createClient(config.SUPABASE.URL, SERVICE_KEY) : defaultSupabase;

// Mapear roles a enteros según tu esquema
const ROLE_MAP = {
  admin: 1,
  coordinador: 2,
  usuario: 3
};

const users = [
  {
    nombre: "Admin Test",
    Apellidos: "Prueba",
    fecha_nacimiento: "1990-01-01",
    genero: "no especificado",
    localidad: "Ciudad Test",
    provincia: "Provincia Test",
    codigo_postal: "00000",
    rol: ROLE_MAP.admin,
    email: "admin@test.local"
  },
  {
    nombre: "Coordinador Test",
    Apellidos: "Prueba",
    fecha_nacimiento: "1992-02-02",
    genero: "no especificado",
    localidad: "Ciudad Test",
    provincia: "Provincia Test",
    codigo_postal: "00001",
    rol: ROLE_MAP.coordinador,
    email: "coordinador@test.local"
  },
  {
    nombre: "Usuario Test 1",
    Apellidos: "Prueba",
    fecha_nacimiento: "1995-03-03",
    genero: "no especificado",
    localidad: "Ciudad Test",
    provincia: "Provincia Test",
    codigo_postal: "00002",
    rol: ROLE_MAP.usuario,
    email: "usuario1@test.local"
  },
  {
    nombre: "Usuario Test 2",
    Apellidos: "Prueba",
    fecha_nacimiento: "1998-04-04",
    genero: "no especificado",
    localidad: "Ciudad Test",
    provincia: "Provincia Test",
    codigo_postal: "00003",
    rol: ROLE_MAP.usuario,
    email: "usuario2@test.local"
  }
];

async function seed() {
  try {
    // Upsert por email para evitar duplicados
    const { data, error } = await supabase
      .from("users")
      .upsert(users, { onConflict: "email" })
      .select();

    if (error) throw error;

    console.log("Usuarios insertados/actualizados:", data);
    process.exit(0);
  } catch (err) {
    console.error("Error al insertar usuarios:", err.message || err);
    process.exit(1);
  }
}

seed();
