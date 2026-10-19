/**
 * Spec 014 (research.md R8/R9): tenant y lugar a los que migran los datos de
 * la clínica original. Son los mismos UUID fijos que siembra la migración
 * `20261020000000_multi_tenant.sql`, para que los pendientes de la 2.2.0 suban
 * al lugar correcto. Módulo sin imports: lo usan `src/lib/db` y las pruebas,
 * que reemplazan `src/lib/db` por un mock.
 */
export const TENANT_1 = '00000000-0000-4000-8000-000000000001'
export const LUGAR_1 = '00000000-0000-4000-8000-000000000011'
