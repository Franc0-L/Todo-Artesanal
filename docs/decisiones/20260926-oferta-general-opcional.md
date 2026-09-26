# Decisión de dominio — General y Opcional por día

## Regla

Para cada `week_day` la administración define exactamente dos opciones de oferta:

- una `general`;
- una `opcional`.

`general` y `opcional` son modalidades de **oferta semanal**, no modalidades que el cliente decide libremente al crear un pedido.

`media_vianda` continúa siendo una modalidad del pedido y no una categoría de oferta.

## Persistencia

`week_day_options.offer_modality` almacena `general | opcional`.

Existe una unicidad por `(week_day_id, offer_modality)`, por lo que un día no puede tener dos ofertas General ni dos Opcionales.

La activación de una semana exige ambas modalidades para cada uno de sus cinco días.

## Pedidos administrativos

Al crear un pedido manual, la opción seleccionada determina si corresponde a General u Opcional. La base de datos rechaza una combinación inconsistente.

La media vianda sigue utilizando la misma opción de oferta, pero como modalidad de pedido separada.

## Migración

Implementado en `supabase/migrations/20260926000002_add_week_offer_modality.sql`.

El rollback correspondiente restaura `activate_week` y `validate_order` a su comportamiento anterior además de eliminar la columna, constraint e índice nuevos.
