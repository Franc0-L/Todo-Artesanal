# ADR-001: Versionado inmutable del catálogo

## Contexto

El catálogo (platos y menús) evoluciona con el tiempo: cambian nombres,
precios, composiciones. Pero el historial debe poder reconstruir qué
se ofreció exactamente en una semana pasada, aunque el plato se haya
editado después.

La pregunta concreta: si modifico "Milanesa" hoy, ¿una semana de hace
tres meses sigue mostrando la Milanesa original?

## Decisión

El catálogo se versiona. Platos y menús tienen:

- una identidad lógica (`dishes`, `menus`);
- versiones inmutables (`dish_versions`, `menu_versions`).

Cada edición del nombre o precio crea una versión nueva. Las
referencias históricas (semanas, ofertas, pedidos) apuntan siempre a
la versión concreta, no a la identidad lógica.

## Consecuencias

**A favor:**

- El historial es reconstruible sin snapshots redundantes.
- Los cambios actuales no alteran el significado de pedidos previos.
- El catálogo puede evolucionar sin temor a romper historia.

**En contra:**

- Cada edición genera filas nuevas. Con el tiempo hay muchas versiones.
- Consultar "el plato actual" requiere filtrar por `MAX(version_number)`.
- No se puede editar una versión existente por error: está bloqueado
  por trigger.

## Alternativas consideradas

1. **Snapshot completo en cada semana.** Cada oferta guarda copia del
   contenido. Descartado porque duplica información y complica la
   actualización del catálogo.

2. **Sin versionado.** Editar un plato afecta todo el historial.
   Descartado porque viola la invariante de preservación histórica.

3. **Versionado con flag "vigente".** La versión vigente se marca con
   un booleano. Descartado porque agrega estado mutable a una entidad
   que debe ser inmutable.