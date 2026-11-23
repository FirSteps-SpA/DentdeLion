import type { UsuarioActual } from '../../lib/db'
import type { IdSeccion } from '../ajustes/lib/secciones'

/**
 * Spec 030 (research.md R2) — textos de la ayuda de cada pantalla. Estáticos
 * (funcionan sin conexión) y escritos a partir del comportamiento de la app;
 * los nombres entre comillas son los de los botones. Lo marcado
 * `soloAdministracion` no se muestra a personal (FR-004).
 */

export type IdVistaAyuda =
  | 'inicio'
  | 'inventario'
  | 'tratamientos'
  | 'compras'
  | 'reportes'
  | 'alertas'
  | 'ajustes'

/** Las secciones de Ajustes con ayuda propia ("Guía de uso" no la lleva: ya es la guía). */
export type IdSeccionAyuda = Exclude<IdSeccion, 'guia'>

export type IdAyuda = IdVistaAyuda | `ajustes:${IdSeccionAyuda}`

export interface TareaAyuda {
  nombre: string
  pasos: string[]
  soloAdministracion?: boolean
}

export interface ConsejoAyuda {
  texto: string
  soloAdministracion?: boolean
}

export interface Ayuda {
  /** Nombre de la pantalla: "Ayuda de <titulo>" y "Ayuda: <titulo>". */
  titulo: string
  paraQue: string
  tareas: TareaAyuda[]
  consejos: ConsejoAyuda[]
  /** La pantalla entera es solo de administración (secciones de Ajustes). */
  soloAdministracion?: boolean
}

export const AYUDAS: Record<IdAyuda, Ayuda> = {
  inicio: {
    titulo: 'Inicio',
    paraQue:
      'Un resumen del lugar de trabajo activo: qué hay que comprar, qué está por vencer, las alertas y el valor del inventario.',
    tareas: [
      {
        nombre: 'Ver el detalle de un número',
        pasos: [
          'Toca "Ver detalle" en la tarjeta ("Para comprar", "Próximos a vencer" o "Alertas").',
          'Se abre la pantalla correspondiente con ese filtro.',
        ],
      },
      {
        nombre: 'Cambiar de lugar de trabajo',
        pasos: [
          'Toca la pastilla con el nombre del lugar, arriba.',
          'Elige otro lugar o "Todos" para ver la suma de todos.',
        ],
      },
    ],
    consejos: [
      {
        texto:
          'Si "Valor de inventario" dice "Sin precios", ingresa el precio al recibir compras: el valor solo suma los lotes con precio.',
      },
      {
        texto: 'Todo lo que ves funciona sin conexión; se sincroniza cuando vuelve la red.',
      },
    ],
  },

  inventario: {
    titulo: 'Inventario',
    paraQue:
      'La lista de materiales del lugar activo con su stock, sus lotes y su vencimiento. Desde aquí se consume, se traslada y se agregan materiales nuevos.',
    tareas: [
      {
        nombre: 'Consumir un material',
        pasos: [
          'Busca el material por nombre o con "Escanear".',
          'Toca "Consumir": se abre con 1 unidad y el lote que vence primero ("Recomendado FEFO").',
          'Ajusta la cantidad o el lote si hace falta y toca "Confirmar consumo".',
          'Si te equivocaste, toca "Deshacer" en el aviso.',
        ],
      },
      {
        nombre: 'Agregar un material nuevo',
        pasos: [
          'Toca "+ Material" y completa nombre, categoría y unidad de consumo.',
          'Si ya tienes stock, toca "Guardar e Ingresar" para cargar el primer lote; si no, "Guardar".',
        ],
      },
      {
        nombre: 'Trasladar a otro lugar',
        pasos: [
          'En el menú del material (los tres puntos), elige "Trasladar".',
          'Elige el lote, el lugar de destino y la cantidad.',
        ],
      },
      {
        nombre: 'Ver lotes y movimientos',
        pasos: ['En el menú del material, elige "Ver detalle": stock por lote, precios y traslados.'],
      },
      {
        nombre: 'Editar o eliminar un material',
        pasos: [
          'En el menú del material, elige "Editar" (nombre, mínimo, presentación, marca) o "Eliminar".',
          'Un material eliminado queda en Ajustes → "Insumos dados de baja" y se puede restaurar.',
        ],
        soloAdministracion: true,
      },
    ],
    consejos: [
      { texto: 'Usa los filtros "Bajo Stock" y "Caducados/Próximos" para revisar lo urgente.' },
      { texto: 'El stock que ves es el del lugar activo; cambia de lugar con la pastilla de arriba.' },
      {
        texto: 'Si aparece "Posible duplicado", revisa si son el mismo material antes de seguir cargando.',
        soloAdministracion: true,
      },
    ],
  },

  tratamientos: {
    titulo: 'Tratamientos',
    paraQue:
      'El catálogo de tratamientos con su precio y los materiales que usan, y el historial de lo realizado. Registrar un tratamiento descuenta sus materiales del stock.',
    tareas: [
      {
        nombre: 'Registrar un tratamiento realizado',
        pasos: [
          'En la pestaña "Tratamientos", toca "Registrar" en el tratamiento.',
          'Si quieres, anota el paciente (nombre o N° de ficha).',
          'Toca "Registrar": se descuentan los materiales del lugar activo.',
        ],
      },
      {
        nombre: 'Revisar o deshacer lo registrado',
        pasos: [
          'Abre la pestaña "Historial" y elige el período.',
          'Busca por paciente si lo necesitas.',
          'Toca "Deshacer" para anular un registro: el stock vuelve.',
        ],
      },
      {
        nombre: 'Crear o editar un tratamiento',
        pasos: [
          'Toca "+ Tratamiento", o abre uno y toca "Editar".',
          'Escribe el nombre, la categoría (opcional) y el precio en cada lugar.',
          'Agrega los materiales con su cantidad por tratamiento y toca "Guardar".',
        ],
        soloAdministracion: true,
      },
      {
        nombre: 'Sugerir cantidades con IA',
        pasos: [
          'En el formulario, con el nombre y los materiales, toca "Sugerir cantidades" (necesita conexión).',
          'Revisa lo sugerido junto a cada material y toca "Usar sugerencias" si te sirve.',
          'Corrige lo que haga falta y toca "Guardar": nada se guarda solo.',
        ],
        soloAdministracion: true,
      },
    ],
    consejos: [
      {
        texto:
          'Cada tratamiento muestra la ganancia del profesional, el costo de materiales y el neto en el lugar activo.',
      },
      {
        texto: 'El paciente solo lo ven quien registró y la administración.',
      },
      {
        texto:
          'El % del profesional se define por lugar en Ajustes → "Lugares de trabajo", y puede cambiar por categoría en "Categorías de tratamientos".',
        soloAdministracion: true,
      },
    ],
  },

  compras: {
    titulo: 'Compras',
    paraQue:
      'La lista de lo que hay que comprar: los materiales bajo su mínimo ("Sugeridos por el Sistema") y lo que agregues a mano. Desde aquí se envía el pedido y se recibe lo comprado.',
    tareas: [
      {
        nombre: 'Enviar un pedido',
        pasos: [
          'Marca los ítems con su casilla (o todos con la casilla de arriba).',
          'Toca "Enviar pedido", elige el proveedor y revisa la vista previa.',
          'Toca "Compartir" para mandarlo por WhatsApp, o "Copiar" para pegarlo donde quieras.',
        ],
      },
      {
        nombre: 'Recibir una compra',
        pasos: [
          'Toca el ✓ del ítem.',
          'Ingresa cantidad, número de lote, fecha de vencimiento y precio.',
          'Toca "Confirmar recepción": el lote entra al inventario del lugar activo.',
        ],
      },
      {
        nombre: 'Agregar algo que no está en la lista',
        pasos: [
          'Toca "Añadir Ítem Manual" y escribe el nombre y la cantidad.',
          'Al recibirlo, se vincula a un material existente o se crea uno nuevo.',
        ],
      },
    ],
    consejos: [
      { texto: 'Un material sale de "Sugeridos" cuando su stock vuelve a estar sobre el mínimo.' },
      {
        texto: 'Ingresar el precio al recibir permite calcular el valor del inventario y el costo de los tratamientos.',
      },
    ],
  },

  reportes: {
    titulo: 'Reportes',
    paraQue:
      'Indicadores y gráficos del período elegido: gasto en materiales, producción, ganancia del profesional y consumo.',
    tareas: [
      {
        nombre: 'Cambiar el período',
        pasos: ['Usa el selector de período, arriba a la derecha.'],
      },
      {
        nombre: 'Comparar con el mes anterior',
        pasos: ['Cada indicador muestra la variación respecto del período anterior.'],
      },
    ],
    consejos: [
      { texto: 'Los reportes respetan el lugar activo; elige "Todos" para ver el total.' },
      {
        texto: '"Por categoría de tratamiento" agrupa la producción por las categorías del catálogo.',
      },
    ],
  },

  alertas: {
    titulo: 'Alertas',
    paraQue:
      'Lo que necesita atención: materiales con stock bajo, lotes próximos a caducar o caducados, y lotes en revisión.',
    tareas: [
      {
        nombre: 'Revisar una alerta',
        pasos: ['Toca el material para ver su detalle, con el stock por lote.'],
      },
      {
        nombre: 'Resolver un lote en revisión',
        pasos: [
          'Un lote queda "en revisión" si, entre dispositivos sin conexión, se consumió más de lo que había.',
          'Cuenta lo que hay realmente, ajústalo y toca "Marcar como resuelto".',
        ],
        soloAdministracion: true,
      },
    ],
    consejos: [
      { texto: 'Usa primero los lotes próximos a caducar: "Consumir" los propone primero.' },
      {
        texto: 'Los días de aviso de caducidad se configuran en Ajustes → "Notificaciones y avisos".',
        soloAdministracion: true,
      },
    ],
  },

  ajustes: {
    titulo: 'Ajustes',
    paraQue:
      'La configuración de tu perfil y, para la administración, del equipo, los lugares, las categorías, los proveedores y las marcas.',
    tareas: [
      {
        nombre: 'Abrir una sección',
        pasos: ['Toca su tarjeta; "Volver" regresa a este índice.'],
      },
      {
        nombre: 'Leer toda la guía',
        pasos: ['Toca "Guía de uso": reúne la ayuda de todas las pantallas.'],
      },
    ],
    consejos: [
      { texto: 'En el teléfono, Compras y Reportes también se abren desde aquí ("Más").' },
    ],
  },

  'ajustes:perfil': {
    titulo: 'Perfil y equipo',
    paraQue: 'Tus datos y, para la administración, las personas del equipo y sus invitaciones.',
    tareas: [
      {
        nombre: 'Cerrar sesión',
        pasos: [
          'Toca "Cerrar sesión".',
          'Lo que quede sin sincronizar se conserva en el dispositivo y se sube con conexión.',
        ],
      },
      {
        nombre: 'Invitar a alguien',
        pasos: [
          'Toca "Invitar al equipo", escribe su correo y elige el rol.',
          'Copia el enlace y envíaselo; vale por un tiempo limitado.',
        ],
        soloAdministracion: true,
      },
      {
        nombre: 'Quitar el acceso a alguien',
        pasos: ['En su fila, toca "Desactivar"; su historial se conserva y puedes reactivarlo.'],
        soloAdministracion: true,
      },
    ],
    consejos: [
      {
        texto: 'Personal registra consumos, compras y tratamientos; la administración además configura y edita.',
      },
    ],
  },

  'ajustes:lugares': {
    titulo: 'Lugares de trabajo',
    soloAdministracion: true,
    paraQue:
      'Las clínicas o boxes donde trabajas. Cada lugar tiene su propio inventario, sus precios y su % de ganancia del profesional.',
    tareas: [
      {
        nombre: 'Crear un lugar',
        pasos: ['Toca "Nuevo lugar de trabajo", escribe el nombre y toca "Crear lugar".'],
      },
      {
        nombre: 'Definir el % del profesional',
        pasos: ['Toca el % del lugar y escribe el % general; se usa en sus tratamientos sin % de categoría.'],
      },
    ],
    consejos: [
      { texto: 'Debe quedar al menos un lugar activo.' },
      { texto: 'El lugar "Predeterminado" es el que viene elegido al registrar.' },
    ],
  },

  'ajustes:categoriasTratamiento': {
    titulo: 'Categorías de tratamientos',
    soloAdministracion: true,
    paraQue:
      'Agrupan los tratamientos (Evaluación, Restauración, Endodoncia…) y permiten un % del profesional distinto por categoría en cada lugar.',
    tareas: [
      {
        nombre: 'Dar un % propio a una categoría',
        pasos: ['Toca la categoría y escribe su % en el lugar que corresponda.'],
      },
      {
        nombre: 'Crear, renombrar o desactivar',
        pasos: ['Usa "Nueva categoría", o toca una categoría para renombrarla o desactivarla.'],
      },
    ],
    consejos: [
      { texto: 'Sin % propio, la categoría usa el % general del lugar.' },
      { texto: 'Desactivar no cambia los registros anteriores.' },
    ],
  },

  'ajustes:avisos': {
    titulo: 'Notificaciones y avisos',
    paraQue: 'Qué avisos recibes (stock bajo, caducidad) y, para la administración, con cuánta anticipación.',
    tareas: [
      {
        nombre: 'Activar o desactivar avisos',
        pasos: ['Usa los interruptores "Stock bajo" y "Caducidad".'],
      },
      {
        nombre: 'Cambiar los días de aviso de caducidad',
        pasos: ['Agrega o quita los días antes del vencimiento en que se avisa.'],
        soloAdministracion: true,
      },
      {
        nombre: 'Ajustar el mínimo de un material',
        pasos: ['En "Stock mínimo por insumo", sube o baja el mínimo; bajo ese número aparece en Compras.'],
        soloAdministracion: true,
      },
    ],
    consejos: [],
  },

  'ajustes:categorias': {
    titulo: 'Categorías de insumos',
    soloAdministracion: true,
    paraQue: 'Agrupan los materiales del inventario y ordenan los reportes de consumo.',
    tareas: [
      {
        nombre: 'Crear, renombrar o desactivar',
        pasos: ['Usa "Nueva categoría", o toca una categoría para renombrarla o desactivarla.'],
      },
    ],
    consejos: [{ texto: 'Si renombras una con el nombre de otra, se ofrece unirlas.' }],
  },

  'ajustes:proveedores': {
    titulo: 'Proveedores',
    soloAdministracion: true,
    paraQue: 'A quién le compras: su nombre y su WhatsApp para enviar los pedidos desde Compras.',
    tareas: [
      {
        nombre: 'Agregar un proveedor',
        pasos: ['Toca "Nuevo proveedor", escribe el nombre y, si quieres, su WhatsApp.'],
      },
    ],
    consejos: [{ texto: 'Sin WhatsApp, el pedido se envía eligiendo el contacto en WhatsApp.' }],
  },

  'ajustes:marcas': {
    titulo: 'Marcas',
    soloAdministracion: true,
    paraQue: 'Las marcas que se asignan a los materiales para distinguirlos.',
    tareas: [
      {
        nombre: 'Crear, editar o desactivar una marca',
        pasos: ['Usa "Nueva marca", o toca una marca para editarla o desactivarla.'],
      },
    ],
    consejos: [{ texto: 'Una marca desactivada no se ofrece al asignar, pero se conserva en los materiales.' }],
  },

  'ajustes:baja': {
    titulo: 'Insumos dados de baja',
    soloAdministracion: true,
    paraQue: 'Los materiales eliminados del inventario, por si hay que recuperarlos.',
    tareas: [
      {
        nombre: 'Recuperar un material',
        pasos: ['Toca "Restaurar": vuelve al inventario con su historial.'],
      },
    ],
    consejos: [],
  },
}

/** Orden del menú: vistas y luego las secciones de Ajustes en el orden del índice. */
export const ORDEN_AYUDAS: readonly IdAyuda[] = [
  'inicio',
  'inventario',
  'tratamientos',
  'compras',
  'reportes',
  'alertas',
  'ajustes',
  'ajustes:perfil',
  'ajustes:lugares',
  'ajustes:categoriasTratamiento',
  'ajustes:avisos',
  'ajustes:categorias',
  'ajustes:proveedores',
  'ajustes:marcas',
  'ajustes:baja',
]

type Rol = UsuarioActual['rol']

/** FR-004: personal no ve lo de administración. `null` si la pantalla entera no es para su rol. */
export function ayudaParaRol(ayuda: Ayuda, rol: Rol): Ayuda | null {
  if (rol === 'administrador') return ayuda
  if (ayuda.soloAdministracion) return null
  return {
    ...ayuda,
    tareas: ayuda.tareas.filter((t) => !t.soloAdministracion),
    consejos: ayuda.consejos.filter((c) => !c.soloAdministracion),
  }
}

/** Título para personal de "Perfil y equipo" y "Notificaciones y avisos". */
export function tituloAyuda(id: IdAyuda, rol: Rol): string {
  if (rol !== 'administrador') {
    if (id === 'ajustes:perfil') return 'Perfil'
    if (id === 'ajustes:avisos') return 'Notificaciones'
  }
  return AYUDAS[id].titulo
}
