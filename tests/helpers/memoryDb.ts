/**
 * Minimal in-memory stand-in for the Dexie `db` (feature 007 tests) — the
 * project mocks `src/lib/db` per test instead of using fake-indexeddb, so
 * this covers only the table API feature 007's domain code uses. Rows are
 * cloned on read/write like IndexedDB's structured clone, and
 * `transaction()` serializes callers so concurrent `rw` transactions don't
 * interleave — the property Dexie gives the double-tap guard (T009).
 */
// `id`, o la clave compuesta `[insumoId+lugarId]` de `minimosLugar` (spec 014).
type Row = { id?: string } | { insumoId: string; lugarId: string }
type Clave = string | [string, string]

function clone<T>(value: T): T {
  return structuredClone(value)
}

function claveDe(row: Row): string {
  if ('id' in row && row.id !== undefined) return row.id
  const { insumoId, lugarId } = row as { insumoId: string; lugarId: string }
  return `${insumoId}|${lugarId}`
}

function normalizar(clave: Clave): string {
  return Array.isArray(clave) ? clave.join('|') : clave
}

let listener: (() => void) | null = null

/**
 * Called after every write — lets an integration test mirror Dexie's
 * `liveQuery` by copying tables into the Zustand store.
 */
export function onMemoryDbChange(fn: (() => void) | null): void {
  listener = fn
}

export class MemoryTable<T extends Row> {
  rows = new Map<string, T>()

  private changed() {
    listener?.()
  }

  async toArray(): Promise<T[]> {
    return [...this.rows.values()].map(clone)
  }

  async get(id: Clave): Promise<T | undefined> {
    const row = this.rows.get(normalizar(id))
    return row ? clone(row) : undefined
  }

  async bulkGet(ids: Clave[]): Promise<(T | undefined)[]> {
    return Promise.all(ids.map((id) => this.get(id)))
  }

  async add(row: T): Promise<string> {
    const clave = claveDe(row)
    if (this.rows.has(clave)) throw new Error(`Duplicate key ${clave}`)
    this.rows.set(clave, clone(row))
    this.changed()
    return clave
  }

  async put(row: T): Promise<string> {
    const clave = claveDe(row)
    this.rows.set(clave, clone(row))
    this.changed()
    return clave
  }

  async bulkPut(rows: T[]): Promise<void> {
    for (const row of rows) this.rows.set(claveDe(row), clone(row))
    this.changed()
  }

  async bulkAdd(rows: T[]): Promise<void> {
    for (const row of rows) await this.add(row)
  }

  async update(id: Clave, changes: Partial<T>): Promise<number> {
    const clave = normalizar(id)
    const row = this.rows.get(clave)
    if (!row) return 0
    this.rows.set(clave, { ...row, ...clone(changes) })
    this.changed()
    return 1
  }

  async bulkUpdate(
    updates: { key: Clave; changes: Partial<T> }[],
  ): Promise<number> {
    let n = 0
    for (const { key, changes } of updates) n += await this.update(key, changes)
    return n
  }

  async clear(): Promise<void> {
    this.rows.clear()
    this.changed()
  }

  async delete(id: Clave): Promise<void> {
    this.rows.delete(normalizar(id))
    this.changed()
  }

  async bulkDelete(ids: Clave[]): Promise<void> {
    for (const id of ids) this.rows.delete(normalizar(id))
    this.changed()
  }

  where(campo: keyof T & string) {
    return {
      equals: (valor: unknown) => ({
        toArray: async () =>
          [...this.rows.values()]
            .filter((row) => (row as Record<string, unknown>)[campo] === valor)
            .map(clone),
      }),
    }
  }

  toCollection() {
    return { first: async () => this.all()[0] }
  }

  filter(fn: (row: T) => boolean) {
    return {
      toArray: async () => [...this.rows.values()].filter(fn).map(clone),
    }
  }

  seed(rows: T[]): void {
    this.rows = new Map(rows.map((row) => [claveDe(row), clone(row)]))
  }

  all(): T[] {
    return [...this.rows.values()].map(clone)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMemoryDb<Tables extends Record<string, MemoryTable<any>>>(
  tables: Tables,
) {
  let cola: Promise<unknown> = Promise.resolve()
  return {
    ...tables,
    /**
     * Snapshots every table before running `fn` and restores them if it
     * rejects — mirroring the atomic rollback a real Dexie `rw` transaction
     * gives `darDeAltaMaterial` (spec 008 research.md R3), so a simulated
     * write failure partway through leaves nothing behind in tests.
     */
    transaction(...args: unknown[]) {
      const fn = args[args.length - 1] as () => Promise<unknown>
      const resultado = cola.then(async () => {
        const snapshot = Object.entries(tables).map(
          ([nombre, tabla]) => [nombre, new Map(tabla.rows)] as const,
        )
        try {
          return await fn()
        } catch (error) {
          for (const [nombre, filas] of snapshot) {
            tables[nombre].rows = filas
          }
          throw error
        }
      })
      cola = resultado.catch(() => undefined)
      return resultado
    },
  }
}
