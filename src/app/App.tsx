import { useEffect, useState } from 'react'
import { APP_NAME } from '../lib/branding'
import { Tooth } from '../components/icons'
import { useBackendConnection } from '../lib/supabase/useBackendConnection'
import { startBackgroundSync } from '../lib/sync'
import { useAuthStore } from '../stores/authStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useAlertasStore } from '../stores/alertasStore'
import { usePendientesStore } from '../stores/pendientesStore'
import { lugaresActivos, useLugarStore } from '../stores/lugarStore'
import { useSyncStore } from '../stores/syncStore'
import { useTratamientosStore } from '../stores/tratamientosStore'
import { LoginForm } from '../features/auth/LoginForm'
import { AceptarInvitacion } from '../features/auth/AceptarInvitacion'
import { AccesoDesactivado } from '../features/auth/AccesoDesactivado'
import { limpiarTokenDeLaUrl, tokenDeLaUrl } from '../features/auth/invitacion'
import { AlertasView } from '../features/alertas/components/AlertasView'
import { contarAlertasPendientes } from '../features/alertas/lib/resumen'
import { InventarioView } from '../features/insumos/components/InventarioView'
import { ComprasView } from '../features/compras/components/ComprasView'
import { ReportesView } from '../features/reportes/components/ReportesView'
import { AjustesView } from '../features/ajustes/components/AjustesView'
import { InicioView } from '../features/inicio/components/InicioView'
import { TratamientosView } from '../features/tratamientos/components/TratamientosView'
import { AppShell } from './AppShell'
import { AvisosConsumo } from './AvisosConsumo'
import { useVista } from './useVista'
import { useVistasDeLugar } from '../features/insumos/lib/vistaLugar'

function App() {
  useBackendConnection()
  const [vista, setVista] = useVista()
  // Spec 014 US5: `/?invitacion=<token>` abre la pantalla de invitación sin sesión.
  const [tokenInvitacion, setTokenInvitacion] = useState(() => tokenDeLaUrl())
  const lugares = useLugarStore((s) => s.lugares)
  const lugaresListos = useLugarStore((s) => s.isReady)
  const subscribeInventory = useInventoryStore((s) => s.subscribe)
  const subscribeAlertas = useAlertasStore((s) => s.subscribe)
  const subscribePendientes = usePendientesStore((s) => s.subscribe)
  const subscribeSync = useSyncStore((s) => s.subscribe)
  const subscribeLugares = useLugarStore((s) => s.subscribe)
  const subscribeTratamientos = useTratamientosStore((s) => s.subscribe)

  // Boot guard: reads only the local Dexie cache (authStore.hydrate), never
  // a live Supabase call, so login-vs-app-shell is never gated on network
  // (spec FR-002/FR-006, research.md's offline-durable session decision).
  const usuario = useAuthStore((s) => s.usuario)
  const isReady = useAuthStore((s) => s.isReady)
  const hydrate = useAuthStore((s) => s.hydrate)

  // Spec 014: alertas del lugar activo; en "Todos", la suma de cada lugar.
  const { vistas } = useVistasDeLugar()
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)
  const alertasBadge = vistas.reduce(
    (total, { datos }) =>
      total +
      contarAlertasPendientes(
        datos.insumos,
        datos.lotes,
        datos.movimientos,
        nivelesAvisoDias,
        { stockBajo: preferenciaStockBajo, caducidad: preferenciaCaducidad },
      ),
    0,
  )

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Inventory data (insumos/lotes/movimientos) and background sync only
  // matter once a user is authenticated locally — mirrors usuario's own
  // Dexie-first hydration, never gated on network (Constitution I).
  useEffect(() => {
    if (!usuario) return
    const unsubscribeInventory = subscribeInventory()
    const unsubscribeAlertas = subscribeAlertas()
    // Spec 012: pendientes y estado del ciclo para el indicador del encabezado.
    const unsubscribePendientes = subscribePendientes()
    const unsubscribeSync = subscribeSync()
    // Spec 014: lugares del tenant y lugar activo (los trae el mismo sync).
    const unsubscribeLugares = subscribeLugares()
    // Spec 016: tratamientos, % por lugar y tratamientos realizados.
    const unsubscribeTratamientos = subscribeTratamientos()
    const stopSync = startBackgroundSync()
    return () => {
      unsubscribeInventory()
      unsubscribeAlertas()
      unsubscribePendientes()
      unsubscribeSync()
      unsubscribeLugares()
      unsubscribeTratamientos()
      stopSync()
    }
  }, [
    usuario,
    subscribeInventory,
    subscribeAlertas,
    subscribePendientes,
    subscribeSync,
    subscribeLugares,
    subscribeTratamientos,
  ])

  // Con sesión, un enlace de invitación no aplica: se descarta.
  useEffect(() => {
    if (usuario && tokenInvitacion) limpiarTokenDeLaUrl()
  }, [usuario, tokenInvitacion])

  // Spec 014 FR-021 / Edge Case "Usuario sin lugares": sin acceso, una
  // pantalla clara en vez de una app vacía. El sync sigue montado para el
  // último envío de los pendientes previos a la desactivación.
  const sinAcceso =
    !!usuario?.desactivadoEn || (lugaresListos && lugaresActivos(lugares).length === 0)
  if (isReady && usuario && sinAcceso) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6">
        <AccesoDesactivado />
      </main>
    )
  }

  if (isReady && usuario) {
    return (
      <>
        <AppShell vista={vista} onCambiarVista={setVista} alertasBadge={alertasBadge}>
          {vista === 'inicio' && <InicioView onNavegar={setVista} />}
          {vista === 'inventario' && <InventarioView />}
          {vista === 'tratamientos' && <TratamientosView />}
          {vista === 'compras' && <ComprasView />}
          {vista === 'reportes' && <ReportesView onNavegar={setVista} />}
          {vista === 'alertas' && <AlertasView />}
          {vista === 'mas' && <AjustesView onNavegar={setVista} />}
        </AppShell>
        <AvisosConsumo />
      </>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      {!isReady ? (
        <>
          <Tooth size={48} className="text-brand" />
          <h1 className="text-h1 text-teal-dark">{APP_NAME}</h1>
          <p className="text-body text-text-muted">Cargando…</p>
        </>
      ) : tokenInvitacion ? (
        <AceptarInvitacion token={tokenInvitacion} onSalir={() => setTokenInvitacion(null)} />
      ) : (
        <LoginForm />
      )}
    </main>
  )
}

export default App
