import type { ComponentType } from 'react'
import { Archive, Bell, MapPin, Tag, Truck, User, type IconProps } from '../../../components/icons'
import type { UsuarioActual } from '../../../lib/db'

/**
 * Spec 019 (research.md R2): secciones de Ajustes, en el orden del índice.
 * Spec 021 (research.md R9): `'proveedores'` entre `categorias` y `baja`.
 */
export type IdSeccion = 'perfil' | 'lugares' | 'avisos' | 'categorias' | 'proveedores' | 'baja'

export interface SeccionAjustes {
  id: IdSeccion
  /** "Perfil y equipo" para administración, "Perfil" para personal. */
  titulo: (esAdministrador: boolean) => string
  Icon: ComponentType<IconProps>
  /** Oculta por completo para `personal` (FR-012). */
  soloAdministracion: boolean
}

export const SECCIONES_AJUSTES: readonly SeccionAjustes[] = [
  {
    id: 'perfil',
    titulo: (admin) => (admin ? 'Perfil y equipo' : 'Perfil'),
    Icon: User,
    soloAdministracion: false,
  },
  {
    id: 'lugares',
    titulo: () => 'Lugares de trabajo',
    Icon: MapPin,
    soloAdministracion: true,
  },
  {
    id: 'avisos',
    titulo: (admin) => (admin ? 'Notificaciones y avisos' : 'Notificaciones'),
    Icon: Bell,
    soloAdministracion: false,
  },
  {
    id: 'categorias',
    titulo: () => 'Categorías',
    Icon: Tag,
    soloAdministracion: true,
  },
  {
    id: 'proveedores',
    titulo: () => 'Proveedores',
    Icon: Truck,
    soloAdministracion: true,
  },
  {
    id: 'baja',
    titulo: () => 'Insumos dados de baja',
    Icon: Archive,
    soloAdministracion: true,
  },
]

export function seccionesVisibles(rol: UsuarioActual['rol']): SeccionAjustes[] {
  return SECCIONES_AJUSTES.filter((s) => rol === 'administrador' || !s.soloAdministracion)
}

export function esIdSeccion(valor: string): valor is IdSeccion {
  return SECCIONES_AJUSTES.some((s) => s.id === valor)
}

/**
 * Datos locales para los resúmenes del índice (research.md R3). `null` =
 * todavía no listos: la tarjeta muestra solo el título. Equipo no entra: se
 * consulta solo con conexión y el índice debe verse igual sin red.
 */
export interface DatosResumen {
  usuario: Pick<UsuarioActual, 'nombre' | 'rol'> | null
  lugaresActivos: number | null
  categoriasActivas: number | null
  insumosDadosDeBaja: number | null
  /** Spec 021 — proveedores activos. */
  proveedoresActivos: number | null
  notificaciones: { stockBajo: boolean; caducidad: boolean } | null
  nivelesAvisoDias: number[] | null
}

function contar(n: number, singular: string, plural: string, cero: string): string {
  if (n === 0) return cero
  return `${n} ${n === 1 ? singular : plural}`
}

function enumerar(valores: string[]): string {
  if (valores.length <= 1) return valores.join('')
  return `${valores.slice(0, -1).join(', ')} y ${valores[valores.length - 1]}`
}

function textoNotificaciones({ stockBajo, caducidad }: { stockBajo: boolean; caducidad: boolean }) {
  if (stockBajo && caducidad) return 'Stock bajo y caducidad'
  if (stockBajo) return 'Solo stock bajo'
  if (caducidad) return 'Solo caducidad'
  return 'Desactivadas'
}

export function resumenSeccion(id: IdSeccion, datos: DatosResumen): string | null {
  switch (id) {
    case 'perfil':
      if (!datos.usuario) return null
      return `${datos.usuario.nombre} · ${
        datos.usuario.rol === 'administrador' ? 'Administradora' : 'Personal'
      }`
    case 'lugares':
      if (datos.lugaresActivos === null) return null
      return contar(datos.lugaresActivos, 'lugar', 'lugares', 'Sin lugares')
    case 'avisos': {
      if (!datos.notificaciones) return null
      const base = textoNotificaciones(datos.notificaciones)
      const niveles = datos.nivelesAvisoDias ?? []
      if (datos.usuario?.rol !== 'administrador' || niveles.length === 0) return base
      const ordenados = [...niveles].sort((a, b) => b - a).map(String)
      return `${base} · ${ordenados.length === 1 ? 'Aviso' : 'Avisos'} a ${enumerar(ordenados)} días`
    }
    case 'categorias':
      if (datos.categoriasActivas === null) return null
      return contar(datos.categoriasActivas, 'categoría', 'categorías', 'Sin categorías')
    case 'proveedores':
      if (datos.proveedoresActivos === null) return null
      return contar(datos.proveedoresActivos, 'proveedor', 'proveedores', 'Sin proveedores')
    case 'baja':
      if (datos.insumosDadosDeBaja === null) return null
      return contar(
        datos.insumosDadosDeBaja,
        'insumo dado de baja',
        'insumos dados de baja',
        'Sin insumos dados de baja',
      )
  }
}
