import type { InputHTMLAttributes, Ref, WheelEvent } from 'react'

export type NumeroInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: Ref<HTMLInputElement>
}

/**
 * Campo numérico de la app (spec 018 R1). Chrome, Edge y Firefox cambian el
 * valor de un `type="number"` enfocado al girar la rueda o deslizar en el
 * trackpad: un stock inicial podía guardarse alterado sin que nadie lo
 * notara. Al recibir la rueda con el foco, el campo lo suelta: el navegador
 * ya no toca el valor y desplaza la página. No se usa `preventDefault`,
 * que también bloquearía el desplazamiento. Escritura, teclado numérico y
 * flechas siguen igual.
 */
export function NumeroInput({ onWheel, ref, ...props }: NumeroInputProps) {
  function soltarFocoConRueda(event: WheelEvent<HTMLInputElement>) {
    if (document.activeElement === event.currentTarget) event.currentTarget.blur()
    onWheel?.(event)
  }

  return <input ref={ref} type="number" onWheel={soltarFocoConRueda} {...props} />
}
