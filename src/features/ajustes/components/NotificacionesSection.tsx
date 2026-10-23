import { useAlertasStore } from '../../../stores/alertasStore'
import { actualizarPreferenciaNotificacion } from '../../alertas/lib/preferencias'
import { Bell } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { Switch } from '../../../components/ui/Switch'

/**
 * Sección "Notificaciones" (spec 010 FR-025/027/028): dos interruptores que
 * deciden qué tipos de alerta cuentan para el indicador de la navegación
 * inferior. Abierta a todo usuario autenticado — es del dispositivo, no de
 * la cuenta.
 */
export function NotificacionesSection({ sinTitulo = false }: { sinTitulo?: boolean } = {}) {
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)

  return (
    <section className="flex flex-col gap-2">
      {/* Spec 019: para personal es la sección entera y la pantalla ya la titula. */}
      {!sinTitulo && (
        <h2 className="flex items-center gap-2 text-h3 text-text">
          <Bell size={18} className="text-primary" />
          Notificaciones
        </h2>
      )}
      <Card className="flex flex-col divide-y divide-border px-3.5">
        <div className="flex items-center justify-between gap-2 py-2.5">
          <span className="text-sm text-text">Stock bajo</span>
          <Switch
            checked={preferenciaStockBajo}
            onChange={(valor) =>
              void actualizarPreferenciaNotificacion('stockBajo', valor)
            }
            label="Incluir stock bajo en el indicador de la navegación"
          />
        </div>
        <div className="flex items-center justify-between gap-2 py-2.5">
          <span className="text-sm text-text">Caducidad</span>
          <Switch
            checked={preferenciaCaducidad}
            onChange={(valor) =>
              void actualizarPreferenciaNotificacion('caducidad', valor)
            }
            label="Incluir caducidad en el indicador de la navegación"
          />
        </div>
      </Card>
    </section>
  )
}
