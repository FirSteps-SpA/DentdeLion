import type { Ayuda } from '../contenido'

/**
 * Spec 030 (contracts/ui.md) — el cuerpo de una ayuda: "Para qué sirve",
 * "Cómo se hace…" y "Consejos". Lo usan la hoja del "?" y Ajustes → "Guía de
 * uso". Recibe la ayuda ya filtrada por rol: lo que llega marcado
 * `soloAdministracion` lo está viendo la administración.
 */
export function AyudaContenido({ ayuda }: { ayuda: Ayuda }) {
  return (
    <div className="flex flex-col gap-4 text-left text-sm text-text">
      <section className="flex flex-col gap-1">
        <h3 className="text-base font-bold">Para qué sirve</h3>
        <p>{ayuda.paraQue}</p>
      </section>

      {ayuda.tareas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold">Cómo se hace…</h3>
          {ayuda.tareas.map((tarea) => (
            <div key={tarea.nombre} className="flex flex-col gap-1">
              <h4 className="flex flex-wrap items-center gap-2 font-semibold">
                {tarea.nombre}
                {/* Espacio para que el lector lea "… Solo administración". */}
                {tarea.soloAdministracion && ' '}
                {tarea.soloAdministracion && (
                  <span className="rounded-full bg-tinte-info px-2 py-0.5 text-xs font-normal text-text">
                    Solo administración
                  </span>
                )}
              </h4>
              <ol className="list-decimal space-y-0.5 pl-5">
                {tarea.pasos.map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      {ayuda.consejos.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-bold">Consejos</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {ayuda.consejos.map((consejo) => (
              <li key={consejo.texto}>
                {consejo.texto}
                {consejo.soloAdministracion && (
                  <span className="text-text-muted"> (solo administración)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
