/**
 * Tablas de Dexie que usa el ciclo de sincronización, para armar el
 * `memoryDb` de las pruebas de la spec 012. Sin imports a propósito: la
 * factory de `vi.mock('../../src/lib/db')` la importa, y cualquier import que
 * llegue a `src/lib/db` dejaría la factory esperándose a sí misma.
 */
export const tablasMemoria = [
  'insumos',
  'lotes',
  'movimientos',
  'configuracionAlertas',
  'configuracionClinica',
  'cambiosInsumo',
  'categorias',
  'itemsCompra',
  'usuarioActual',
  'estadoSync',
  'usuariosConocidos',
] as const
