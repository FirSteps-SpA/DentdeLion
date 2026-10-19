import { useEffect, useRef, useState } from 'react'
import { db } from '../../../lib/db'
import type { AltaMaterialInput } from './alta'

const DEBOUNCE_MS = 400

export const ALTA_VACIA: AltaMaterialInput = {
  nombre: '',
  categoria: '',
  categoriaNueva: false,
  unidadMedida: 'caja',
  unidadCompra: null,
  contenido: null,
  codigoFabricante: '',
  stockMinimo: null,
  caduca: true,
  stockInicial: 0,
  lote: { numeroLote: '', proveedor: '', fechaCaducidad: '' },
  confirmarCaducado: false,
}

function mismoEstado(a: AltaMaterialInput, b: AltaMaterialInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Borrador persistente del formulario "Nuevo Material" (spec 008 R6): un
 * borrador existente al montar prevalece sobre `inicial` (por ejemplo, el
 * nombre precargado desde Registrar). Guarda con debounce de 400 ms y nunca
 * escribe mientras el formulario permanece igual al estado inicial — así
 * abrir el formulario y no tocar nada no crea un borrador fantasma. Si ya
 * había una fila y el usuario revierte todo, la fila se borra.
 */
export function useBorradorAlta(inicial: Partial<AltaMaterialInput>) {
  // Lazy initializer: computed once at mount and stable for the component's
  // lifetime, without reading a ref during render (react-hooks/refs).
  const [estadoInicial] = useState<AltaMaterialInput>(() => ({
    ...ALTA_VACIA,
    ...inicial,
  }))
  const [datos, setDatosState] = useState<AltaMaterialInput>(estadoInicial)
  const [restaurado, setRestaurado] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const escritoRef = useRef(false)
  const pendienteRef = useRef<AltaMaterialInput | null>(null)

  function persistir(siguiente: AltaMaterialInput) {
    if (mismoEstado(siguiente, estadoInicial)) {
      if (escritoRef.current) {
        escritoRef.current = false
        void db.borradores.delete('alta-material')
      }
      return
    }
    escritoRef.current = true
    void db.borradores.put({
      id: 'alta-material',
      datos: siguiente,
      actualizadoEn: new Date().toISOString(),
    })
  }

  useEffect(() => {
    let cancelado = false
    void db.borradores.get('alta-material').then((fila) => {
      if (cancelado) return
      if (fila) {
        setDatosState({ ...ALTA_VACIA, ...fila.datos })
        setRestaurado(true)
        escritoRef.current = true
      }
      setIsLoading(false)
    })
    return () => {
      cancelado = true
      // Unmounting mid-debounce (e.g. `onAbrirExistente` closing the view)
      // must still persist the latest edit — only `descartar()` discards it.
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        if (pendienteRef.current) persistir(pendienteRef.current)
      }
    }
    // Solo al montar: `inicial` se congela en `estadoInicial` arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setDatos(patch: Partial<AltaMaterialInput>) {
    setDatosState((previo) => {
      const siguiente = { ...previo, ...patch }
      pendienteRef.current = siguiente
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        pendienteRef.current = null
        persistir(siguiente)
      }, DEBOUNCE_MS)
      return siguiente
    })
  }

  async function descartar(): Promise<void> {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendienteRef.current = null
    escritoRef.current = false
    await db.borradores.delete('alta-material')
  }

  return { datos, setDatos, restaurado, isLoading, descartar }
}
