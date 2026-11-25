/**
 * Spec 032: las palabras del nombre sin los títulos abreviados con punto
 * ("Dra. Ana Pérez" → ["Ana", "Pérez"]), salvo que el nombre sea solo eso.
 */
export function partesDelNombre(nombre: string): string[] {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const sinTitulos = partes.filter((parte) => !parte.endsWith('.'))
  return sinTitulos.length > 0 ? sinTitulos : partes
}

/** Iniciales del avatar ("Sofía León" → "SL", "Dra. Ana Pérez" → "AP"). */
export function iniciales(nombre: string): string {
  return partesDelNombre(nombre)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

/** Nombre para el saludo de Inicio ("Dra. Ana Pérez" → "Ana"). */
export function primerNombre(nombre: string): string {
  return partesDelNombre(nombre)[0] ?? ''
}
