import { useState } from 'react'
import type { Proveedor } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { lugaresActivos, useLugarStore } from '../../../stores/lugarStore'
import { activos, desactivados } from '../../proveedores/lib/proveedores'
import {
  crearProveedor,
  desactivarProveedor,
  editarProveedor,
  eliminarProveedor,
  fijarPredeterminado,
  reactivarProveedor,
  ProveedorDesactivado,
} from '../../proveedores/lib/proveedoresAdmin'
import { formatearWhatsapp } from '../../proveedores/lib/whatsapp'
import { ChevronDown, Plus, Undo } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { Switch } from '../../../components/ui/Switch'
import { TouchButton } from '../../../components/ui/TouchButton'
import { VerMas } from '../../../components/ui/VerMas'
import { useListaPaginada } from '../../../lib/paginacion'
import { MensajePedidoCard } from './MensajePedidoCard'

const INPUT_CLASS =
  'h-full w-full border-none bg-transparent text-sm text-text outline-none'

interface Formulario {
  /** `null` = nuevo. */
  id: string | null
  nombre: string
  whatsapp: string
  contacto: string
  /** Lugares donde quedará como predeterminado. */
  predeterminadoEn: Set<string>
}

/**
 * Spec 021 (FR-010..FR-016, research.md R9, contracts/ui-contracts.md
 * "ProveedoresSection") — catálogo de proveedores en Ajustes, solo para
 * administración (la sección no existe para `personal`). Crear, editar
 * nombre/WhatsApp/contacto, predeterminado por lugar, desactivar o reactivar,
 * y eliminar solo si no tiene lotes.
 */
export function ProveedoresSection() {
  const proveedores = useInventoryStore((s) => s.proveedores)
  const lotes = useInventoryStore((s) => s.lotes)
  const lugares = lugaresActivos(useLugarStore((s) => s.lugares))
  const variosLugares = lugares.length > 1

  const lista = useListaPaginada(activos(proveedores), {
    clave: '',
    modo: 'ver-mas',
  })
  const listaDesactivados = desactivados(proveedores)
  const conLotes = new Set(
    lotes.map((lote) => lote.proveedorId).filter(Boolean),
  )

  const [form, setForm] = useState<Formulario | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [verDesactivados, setVerDesactivados] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const lugaresDondeEs = (id: string) =>
    lugares.filter((lugar) => lugar.proveedorPredeterminadoId === id)

  function abrirNuevo() {
    setForm({
      id: null,
      nombre: '',
      whatsapp: '',
      contacto: '',
      // Con un solo lugar y sin predeterminado, el primero queda como tal.
      predeterminadoEn: new Set(
        lugares.length === 1 && !lugares[0].proveedorPredeterminadoId
          ? [lugares[0].id]
          : [],
      ),
    })
    setConfirmarEliminar(false)
    setError(null)
  }

  function abrirEditar(proveedor: Proveedor) {
    setForm({
      id: proveedor.id,
      nombre: proveedor.nombre,
      whatsapp: proveedor.whatsapp ? formatearWhatsapp(proveedor.whatsapp) : '',
      contacto: proveedor.contacto ?? '',
      predeterminadoEn: new Set(
        lugaresDondeEs(proveedor.id).map((lugar) => lugar.id),
      ),
    })
    setConfirmarEliminar(false)
    setError(null)
  }

  function cerrar() {
    setForm(null)
    setConfirmarEliminar(false)
  }

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
    } catch (e) {
      setError(
        e instanceof ProveedorDesactivado
          ? `${e.message} Reactívalo desde "Desactivados".`
          : e instanceof Error
            ? e.message
            : 'No se pudo guardar.',
      )
    } finally {
      setOcupado(false)
    }
  }

  function guardar() {
    if (!form) return
    void ejecutar(async () => {
      const datos = {
        nombre: form.nombre,
        whatsapp: form.whatsapp,
        contacto: form.contacto,
      }
      let id = form.id
      if (id) {
        await editarProveedor(id, datos)
      } else {
        id = (await crearProveedor(datos, { estricto: true })).id
      }
      for (const lugar of lugares) {
        const quiere = form.predeterminadoEn.has(lugar.id)
        const es = lugar.proveedorPredeterminadoId === id
        if (quiere && !es) await fijarPredeterminado(lugar.id, id)
        if (!quiere && es) await fijarPredeterminado(lugar.id, null)
      }
      cerrar()
    })
  }

  function alternarPredeterminado(lugarId: string, activo: boolean) {
    if (!form) return
    const predeterminadoEn = new Set(form.predeterminadoEn)
    if (activo) predeterminadoEn.add(lugarId)
    else predeterminadoEn.delete(lugarId)
    setForm({ ...form, predeterminadoEn })
  }

  const enEdicion = form?.id
    ? proveedores.find((p) => p.id === form.id)
    : undefined

  return (
    <section className="flex flex-col gap-2">
      {/* Spec 022 (research.md R9): el saludo del pedido va a estos contactos. */}
      <MensajePedidoCard />

      <div className="flex items-center justify-end gap-2">
        <TouchButton
          type="button"
          variant="secondary"
          onClick={abrirNuevo}
          className="text-sm"
        >
          <Plus size={16} />
          Agregar proveedor
        </TouchButton>
      </div>

      {error && !form && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      {lista.total === 0 ? (
        <Card className="px-3.5 py-4">
          <p className="text-sm text-text-muted">Todavía no hay proveedores.</p>
        </Card>
      ) : (
        <Card className="flex flex-col divide-y divide-border px-1.5">
          {lista.visibles.map((proveedor) => {
            const detalle = [
              proveedor.whatsapp ? formatearWhatsapp(proveedor.whatsapp) : null,
              proveedor.contacto,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <button
                key={proveedor.id}
                type="button"
                onClick={() => abrirEditar(proveedor)}
                aria-label={`Editar ${proveedor.nombre}`}
                className="flex min-h-12 flex-col items-start gap-1 rounded-md px-2 py-2.5 text-left hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                  {proveedor.nombre}
                  {lugaresDondeEs(proveedor.id).map((lugar) => (
                    <Badge key={lugar.id} variant="success">
                      {variosLugares
                        ? `Predeterminado · ${lugar.nombre}`
                        : 'Predeterminado'}
                    </Badge>
                  ))}
                </span>
                {detalle && (
                  <span className="text-xs text-text-muted">{detalle}</span>
                )}
              </button>
            )
          })}
        </Card>
      )}
      <VerMas
        quedan={lista.quedan}
        mostrados={lista.visibles.length}
        total={lista.total}
        onVerMas={lista.verMas}
      />

      {listaDesactivados.length > 0 && (
        <div className="flex flex-col gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            aria-expanded={verDesactivados}
            onClick={() => setVerDesactivados(!verDesactivados)}
            className="self-start text-sm"
          >
            <ChevronDown
              size={16}
              className={
                verDesactivados
                  ? 'rotate-180 motion-safe:transition-transform'
                  : ''
              }
            />
            Desactivados ({listaDesactivados.length})
          </TouchButton>
          {verDesactivados && (
            <Card className="flex flex-col divide-y divide-border px-3.5">
              {listaDesactivados.map((proveedor) => (
                <div
                  key={proveedor.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm text-text-muted"
                >
                  {proveedor.nombre}
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      void ejecutar(() => reactivarProveedor(proveedor.id))
                    }
                    className="text-sm"
                  >
                    <Undo size={16} />
                    Reactivar
                  </TouchButton>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {form && (
        <BottomSheet
          titulo={form.id ? 'Editar proveedor' : 'Nuevo proveedor'}
          onClose={cerrar}
        >
          {error && (
            <Card className="bg-danger-bg px-3.5 py-2.5">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            </Card>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              guardar()
            }}
            className="flex flex-col gap-4"
          >
            <IconField label="Nombre" htmlFor="proveedor-nombre">
              <input
                id="proveedor-nombre"
                type="text"
                value={form.nombre}
                maxLength={60}
                onChange={(event) =>
                  setForm({ ...form, nombre: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </IconField>
            <IconField
              label="WhatsApp"
              htmlFor="proveedor-whatsapp"
              hint="Con o sin +56"
            >
              <input
                id="proveedor-whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.whatsapp}
                onChange={(event) =>
                  setForm({ ...form, whatsapp: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </IconField>
            <IconField label="Contacto" htmlFor="proveedor-contacto">
              <input
                id="proveedor-contacto"
                type="text"
                value={form.contacto}
                maxLength={60}
                onChange={(event) =>
                  setForm({ ...form, contacto: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </IconField>

            {lugares.length > 0 && !enEdicion?.desactivadoEn && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-[13px] font-semibold text-text">
                  Predeterminado en
                </legend>
                {lugares.map((lugar) => (
                  <div
                    key={lugar.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {variosLugares
                        ? lugar.nombre
                        : 'Viene elegido al registrar'}
                    </span>
                    <Switch
                      checked={form.predeterminadoEn.has(lugar.id)}
                      onChange={(activo) =>
                        alternarPredeterminado(lugar.id, activo)
                      }
                      label={`Predeterminado en ${lugar.nombre}`}
                    />
                  </div>
                ))}
              </fieldset>
            )}

            <TouchButton
              type="submit"
              disabled={ocupado || !form.nombre.trim()}
            >
              Guardar
            </TouchButton>
          </form>

          {enEdicion && !confirmarEliminar && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <TouchButton
                type="button"
                variant="secondary"
                disabled={ocupado}
                onClick={() =>
                  void ejecutar(async () => {
                    if (enEdicion.desactivadoEn)
                      await reactivarProveedor(enEdicion.id)
                    else await desactivarProveedor(enEdicion.id)
                    cerrar()
                  })
                }
              >
                {enEdicion.desactivadoEn ? 'Reactivar' : 'Desactivar'}
              </TouchButton>
              {!conLotes.has(enEdicion.id) && (
                <TouchButton
                  type="button"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => setConfirmarEliminar(true)}
                  className="text-danger"
                >
                  Eliminar
                </TouchButton>
              )}
            </div>
          )}

          {enEdicion && confirmarEliminar && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm text-text">
                ¿Eliminar «{enEdicion.nombre}»? No tiene lotes registrados.
              </p>
              <div className="flex flex-wrap gap-2">
                <TouchButton
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(async () => {
                      await eliminarProveedor(enEdicion.id)
                      cerrar()
                    })
                  }
                  className="bg-danger"
                >
                  Eliminar
                </TouchButton>
                <TouchButton
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmarEliminar(false)}
                >
                  Cancelar
                </TouchButton>
              </div>
            </div>
          )}
        </BottomSheet>
      )}
    </section>
  )
}
