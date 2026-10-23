import '@testing-library/jest-dom/vitest'

// Spec 019: Ajustes restaura el desplazamiento al volver al índice; jsdom no
// implementa `window.scrollTo` (solo lo anuncia por consola).
window.scrollTo = (() => {}) as typeof window.scrollTo
