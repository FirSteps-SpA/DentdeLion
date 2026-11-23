# Quickstart: validar la spec 031

```bash
npm run lint && npm run build && npm test
supabase start && supabase migration up --local && supabase functions serve
npm run test:rls                      # contracts/api.md §controles
```

En la app local, con una cuenta agregada a `administradores_plataforma` (SQL local):

1. Ajustes → "Plataforma": lista de clientes; abrir uno: usuarios e invitaciones.
2. "Nuevo cliente": copiar el enlace; abrirlo en otra ventana y crear la administradora.
3. Eliminar un usuario de personal con registros: su historial sigue con "Usuario eliminado"; su
   sesión en otra ventana se cierra y limpia al sincronizar.
4. Eliminar el cliente de prueba: se descarga el respaldo; tras escribir el nombre, desaparece.
5. Con una administradora de cliente: no hay tarjeta; la función responde 403.
