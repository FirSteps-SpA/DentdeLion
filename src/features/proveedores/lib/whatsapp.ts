/**
 * Spec 021 (research.md R10) — teléfono de WhatsApp de un proveedor. Se guarda
 * solo con dígitos y código de país, listo para `https://wa.me/<dígitos>`
 * (spec 022). Sin código de país se asume Chile (+56).
 */

export type ResultadoWhatsapp =
  { ok: true; valor: string | null } | { ok: false }

const CODIGO_CHILE = '56'

export function normalizarWhatsapp(texto: string): ResultadoWhatsapp {
  const limpio = texto.trim()
  if (!limpio) return { ok: true, valor: null }
  const digitos = limpio.replace(/\D/g, '')
  const conCodigo =
    limpio.startsWith('+') ||
    (digitos.startsWith(CODIGO_CHILE) && digitos.length === 11)
      ? digitos
      : CODIGO_CHILE + digitos
  return /^[0-9]{10,15}$/.test(conCodigo)
    ? { ok: true, valor: conCodigo }
    : { ok: false }
}

/** "+56 9 1234 5678" para un celular chileno; "+<dígitos>" para el resto. */
export function formatearWhatsapp(digitos: string): string {
  const chile = /^56(9)(\d{4})(\d{4})$/.exec(digitos)
  if (chile) return `+56 ${chile[1]} ${chile[2]} ${chile[3]}`
  return `+${digitos}`
}

export const MENSAJE_WHATSAPP_INVALIDO = 'Revisa el número de WhatsApp.'
