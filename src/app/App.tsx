import { useEffect, useState } from 'react'
import { APP_NAME } from '../lib/branding'
import { useBackendConnection } from '../lib/supabase/useBackendConnection'
import { startBackgroundSync } from '../lib/sync'
import { useAuthStore } from '../stores/authStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { useAlertasStore } from '../stores/alertasStore'
import { useClinicaStore } from '../stores/clinicaStore'
import { usePendientesStore } from '../stores/pendientesStore'
import { useSyncStore } from '../stores/syncStore'
import { LoginForm } from '../features/auth/LoginForm'
import { AlertasView } from '../features/alertas/components/AlertasView'
import { contarAlertasPendientes } from '../features/alertas/lib/resumen'
import { InventarioView } from '../features/insumos/components/InventarioView'
import { ComprasView } from '../features/compras/components/ComprasView'
import { AjustesView } from '../features/ajustes/components/AjustesView'
import { AppHeader } from './AppHeader'
import { AvisosConsumo } from './AvisosConsumo'
import { BottomNav, type Vista } from './BottomNav'

function App() {
  useBackendConnection()
  const [vista, setVista] = useState<Vista>('inventario')
  const subscribeInventory = useInventoryStore((s) => s.subscribe)
  const subscribeAlertas = useAlertasStore((s) => s.subscribe)
  const subscribeClinica = useClinicaStore((s) => s.subscribe)
  const subscribePendientes = usePendientesStore((s) => s.subscribe)
  const subscribeSync = useSyncStore((s) => s.subscribe)

  // Boot guard: reads only the local Dexie cache (authStore.hydrate), never
  // a live Supabase call, so login-vs-app-shell is never gated on network
  // (spec FR-002/FR-006, research.md's offline-durable session decision).
  const usuario = useAuthStore((s) => s.usuario)
  const isReady = useAuthStore((s) => s.isReady)
  const hydrate = useAuthStore((s) => s.hydrate)

  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)
  const alertasBadge = contarAlertasPendientes(
    insumos,
    lotes,
    movimientos,
    nivelesAvisoDias,
    { stockBajo: preferenciaStockBajo, caducidad: preferenciaCaducidad },
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
    const unsubscribeClinica = subscribeClinica()
    // Spec 012: pendientes y estado del ciclo para el indicador del encabezado.
    const unsubscribePendientes = subscribePendientes()
    const unsubscribeSync = subscribeSync()
    const stopSync = startBackgroundSync()
    return () => {
      unsubscribeInventory()
      unsubscribeAlertas()
      unsubscribeClinica()
      unsubscribePendientes()
      unsubscribeSync()
      stopSync()
    }
  }, [
    usuario,
    subscribeInventory,
    subscribeAlertas,
    subscribeClinica,
    subscribePendientes,
    subscribeSync,
  ])

  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 bg-bg p-6 text-center">
      {!isReady ? (
        <>
          <h1 className="text-2xl font-extrabold text-text">{APP_NAME}</h1>
          <p className="text-sm text-text-muted">Cargando…</p>
        </>
      ) : !usuario ? (
        <LoginForm />
      ) : (
        <div className="flex w-full max-w-md flex-col items-stretch gap-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-left">
          <AppHeader />

          {vista === 'inventario' && <InventarioView />}
          {vista === 'compras' && <ComprasView />}
          {vista === 'alertas' && <AlertasView />}
          {vista === 'mas' && <AjustesView />}

          <AvisosConsumo />

          <BottomNav active={vista} onChange={setVista} alertasBadge={alertasBadge} />
        </div>
      )}
    </main>
  )
}

export default App
