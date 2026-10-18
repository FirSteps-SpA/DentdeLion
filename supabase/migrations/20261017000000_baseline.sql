-- DentdeLion — esquema base (baseline)
-- Generado con `supabase db dump --linked` desde producción el 2026-10-17.
-- Consolida los contratos SQL de specs/002–010 tal como están aplicados.
-- En producción se registra como aplicada (migration repair), no se ejecuta.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."es_administrador"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from perfiles p where p.id = uid and p.rol = 'administrador'
  );
$$;


ALTER FUNCTION "public"."es_administrador"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_catalogo_insumo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if not es_administrador(auth.uid()) then
    new.nombre := old.nombre;
    new.categoria := old.categoria;
    new.unidad_medida := old.unidad_medida;
    new.stock_minimo := old.stock_minimo;
    new.codigo_fabricante := old.codigo_fabricante;
    new.caduca := old.caduca;
    new.dado_de_baja_en := old.dado_de_baja_en;
    new.dado_de_baja_por := old.dado_de_baja_por;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_catalogo_insumo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_resolucion_lote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.estado = 'revision' and new.estado = 'activo'
     and not es_administrador(auth.uid()) then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_resolucion_lote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cambios_insumo" (
    "id" "uuid" NOT NULL,
    "insumo_id" "uuid" NOT NULL,
    "campo" "text" NOT NULL,
    "valor_anterior" "jsonb",
    "valor_nuevo" "jsonb",
    "usuario_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone NOT NULL,
    CONSTRAINT "cambios_insumo_campo_check" CHECK (("campo" = ANY (ARRAY['nombre'::"text", 'categoria'::"text", 'unidadMedida'::"text", 'stockMinimo'::"text", 'codigoFabricante'::"text", 'caduca'::"text", 'baja'::"text"])))
);


ALTER TABLE "public"."cambios_insumo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone NOT NULL,
    "desactivado_en" timestamp with time zone,
    CONSTRAINT "categorias_nombre_check" CHECK ((("char_length"(TRIM(BOTH FROM "nombre")) >= 1) AND ("char_length"(TRIM(BOTH FROM "nombre")) <= 40)))
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion_alertas" (
    "id" "text" DEFAULT 'global'::"text" NOT NULL,
    "niveles_aviso_dias" integer[] DEFAULT '{30,7,1}'::integer[] NOT NULL,
    CONSTRAINT "configuracion_alertas_singleton" CHECK (("id" = 'global'::"text"))
);


ALTER TABLE "public"."configuracion_alertas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion_clinica" (
    "id" "text" DEFAULT 'global'::"text" NOT NULL,
    "nombre" "text",
    CONSTRAINT "configuracion_clinica_singleton" CHECK (("id" = 'global'::"text"))
);


ALTER TABLE "public"."configuracion_clinica" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insumos" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "unidad_medida" "text" NOT NULL,
    "permite_decimales" boolean NOT NULL,
    "caduca" boolean DEFAULT true NOT NULL,
    "codigo_fabricante" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stock_minimo" numeric,
    "dado_de_baja_en" timestamp with time zone,
    "dado_de_baja_por" "uuid",
    "creado_por" "uuid"
);


ALTER TABLE "public"."insumos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items_compra" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "cantidad" numeric,
    "nota" "text",
    "insumo_id" "uuid",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "creado_en" timestamp with time zone NOT NULL,
    "comprado_por" "uuid",
    "comprado_en" timestamp with time zone,
    CONSTRAINT "items_compra_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'comprado'::"text", 'eliminado'::"text"]))),
    CONSTRAINT "items_compra_nombre_check" CHECK (("char_length"(TRIM(BOTH FROM "nombre")) > 0))
);


ALTER TABLE "public"."items_compra" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lotes" (
    "id" "uuid" NOT NULL,
    "insumo_id" "uuid" NOT NULL,
    "numero_lote" "text" NOT NULL,
    "proveedor" "text" NOT NULL,
    "fecha_caducidad" "date",
    "codigo_fabricante" "text",
    "estado" "text" DEFAULT 'activo'::"text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lotes_estado_check" CHECK (("estado" = ANY (ARRAY['activo'::"text", 'revision'::"text"])))
);


ALTER TABLE "public"."lotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos" (
    "id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "cantidad" numeric NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "movimiento_origen_id" "uuid",
    "creado_en" timestamp with time zone NOT NULL,
    CONSTRAINT "movimientos_tipo_check" CHECK (("tipo" = ANY (ARRAY['ingreso'::"text", 'consumo'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rol" "text" NOT NULL,
    CONSTRAINT "perfiles_rol_check" CHECK (("rol" = ANY (ARRAY['administrador'::"text", 'personal'::"text"])))
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cambios_insumo"
    ADD CONSTRAINT "cambios_insumo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion_alertas"
    ADD CONSTRAINT "configuracion_alertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion_clinica"
    ADD CONSTRAINT "configuracion_clinica_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insumos"
    ADD CONSTRAINT "insumos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items_compra"
    ADD CONSTRAINT "items_compra_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "cambios_insumo_insumo_id_idx" ON "public"."cambios_insumo" USING "btree" ("insumo_id");



CREATE INDEX "idx_items_compra_estado" ON "public"."items_compra" USING "btree" ("estado");



CREATE INDEX "idx_items_compra_insumo" ON "public"."items_compra" USING "btree" ("insumo_id");



CREATE INDEX "idx_lotes_insumo_fecha" ON "public"."lotes" USING "btree" ("insumo_id", "fecha_caducidad");



CREATE INDEX "idx_movimientos_lote" ON "public"."movimientos" USING "btree" ("lote_id");



CREATE INDEX "idx_movimientos_usuario" ON "public"."movimientos" USING "btree" ("usuario_id");



CREATE OR REPLACE TRIGGER "insumos_proteger_catalogo" BEFORE UPDATE ON "public"."insumos" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_catalogo_insumo"();



CREATE OR REPLACE TRIGGER "lotes_proteger_resolucion" BEFORE UPDATE ON "public"."lotes" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_resolucion_lote"();



ALTER TABLE ONLY "public"."cambios_insumo"
    ADD CONSTRAINT "cambios_insumo_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."cambios_insumo"
    ADD CONSTRAINT "cambios_insumo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."insumos"
    ADD CONSTRAINT "insumos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."insumos"
    ADD CONSTRAINT "insumos_dado_de_baja_por_fkey" FOREIGN KEY ("dado_de_baja_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."items_compra"
    ADD CONSTRAINT "items_compra_comprado_por_fkey" FOREIGN KEY ("comprado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."items_compra"
    ADD CONSTRAINT "items_compra_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."items_compra"
    ADD CONSTRAINT "items_compra_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_movimiento_origen_id_fkey" FOREIGN KEY ("movimiento_origen_id") REFERENCES "public"."movimientos"("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE "public"."cambios_insumo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cambios_insumo: leer todos los autenticados" ON "public"."cambios_insumo" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cambios_insumo: solo administrador inserta, como sí mismo" ON "public"."cambios_insumo" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."rol" = 'administrador'::"text"))))));



ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categorias: leer todos los autenticados" ON "public"."categorias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "categorias: solo administrador actualiza" ON "public"."categorias" FOR UPDATE TO "authenticated" USING ("public"."es_administrador"("auth"."uid"())) WITH CHECK ("public"."es_administrador"("auth"."uid"()));



CREATE POLICY "categorias: solo administrador inserta, como sí mismo" ON "public"."categorias" FOR INSERT TO "authenticated" WITH CHECK ((("creado_por" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."rol" = 'administrador'::"text"))))));



ALTER TABLE "public"."configuracion_alertas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_alertas: leer todos los autenticados" ON "public"."configuracion_alertas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "configuracion_alertas: solo administrador escribe" ON "public"."configuracion_alertas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."rol" = 'administrador'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."rol" = 'administrador'::"text")))));



ALTER TABLE "public"."configuracion_clinica" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_clinica: leer todos los autenticados" ON "public"."configuracion_clinica" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "configuracion_clinica: solo administrador escribe" ON "public"."configuracion_clinica" TO "authenticated" USING ("public"."es_administrador"("auth"."uid"())) WITH CHECK ("public"."es_administrador"("auth"."uid"()));



ALTER TABLE "public"."insumos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insumos: cualquiera da de alta" ON "public"."insumos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "insumos: cualquiera resincroniza, protegido por trigger" ON "public"."insumos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "insumos: leer todos los autenticados" ON "public"."insumos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."items_compra" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_compra: actualizar cualquiera" ON "public"."items_compra" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "items_compra: insertar como uno mismo" ON "public"."items_compra" FOR INSERT TO "authenticated" WITH CHECK (("creado_por" = "auth"."uid"()));



CREATE POLICY "items_compra: leer todos los autenticados" ON "public"."items_compra" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lotes: cualquiera crea" ON "public"."lotes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "lotes: cualquiera resincroniza, protegido por trigger" ON "public"."lotes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "lotes: leer todos los autenticados" ON "public"."lotes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."movimientos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimientos: insertar como uno mismo" ON "public"."movimientos" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "movimientos: leer todos los autenticados" ON "public"."movimientos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles: leer solo el propio perfil" ON "public"."perfiles" FOR SELECT USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."es_administrador"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."es_administrador"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_administrador"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_catalogo_insumo"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_catalogo_insumo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_catalogo_insumo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_resolucion_lote"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_resolucion_lote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_resolucion_lote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."cambios_insumo" TO "anon";
GRANT ALL ON TABLE "public"."cambios_insumo" TO "authenticated";
GRANT ALL ON TABLE "public"."cambios_insumo" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion_alertas" TO "anon";
GRANT ALL ON TABLE "public"."configuracion_alertas" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion_alertas" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion_clinica" TO "anon";
GRANT ALL ON TABLE "public"."configuracion_clinica" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion_clinica" TO "service_role";



GRANT ALL ON TABLE "public"."insumos" TO "anon";
GRANT ALL ON TABLE "public"."insumos" TO "authenticated";
GRANT ALL ON TABLE "public"."insumos" TO "service_role";



GRANT ALL ON TABLE "public"."items_compra" TO "anon";
GRANT ALL ON TABLE "public"."items_compra" TO "authenticated";
GRANT ALL ON TABLE "public"."items_compra" TO "service_role";



GRANT ALL ON TABLE "public"."lotes" TO "anon";
GRANT ALL ON TABLE "public"."lotes" TO "authenticated";
GRANT ALL ON TABLE "public"."lotes" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos" TO "anon";
GRANT ALL ON TABLE "public"."movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































