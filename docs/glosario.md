# Glosario

Términos del dominio de Todo Artesanal. Ordenados por concepto, no alfabéticamente.

## Conceptos centrales

### Semana
Período operativo, típicamente lunes a viernes. Define qué se ofrece y contiene los pedidos de todos los clientes. Tiene un ciclo de vida: `draft` → `active` → `closed`.

### Oferta
El conjunto de opciones disponibles en una semana. No es una entidad separada: es la configuración de la propia semana.

### Opción de oferta
Una unidad seleccionable dentro de un día concreto. Puede ser un plato individual o un menú compuesto. Existe en el contexto `(semana, día)`.

### Cliente
Persona que recibe el servicio. Tiene configuración actual (nombre, teléfono, dirección, precios especiales) y un enlace personal para pedir.

### Pedido
Elección concreta de un cliente para una semana y un día. Registra cliente, opción, modalidad, cantidad y **precio aplicado** (congelado históricamente).

### Cancelación
Hecho operativo que indica que un cliente no va a recibir vianda un día concreto. Cuenta como "respuesta" del cliente.

### Historial
Conjunto de hechos del pasado. Conserva su significado original aunque los datos actuales cambien.

## Catálogo

### Plato
Unidad individual del catálogo: Milanesa, Puré, Empanadas.

### Menú
Combinación de platos: un plato principal + 0..N guarniciones. Ej: "Milanesa + Puré".

### Versión (de plato o menú)
Snapshot inmutable del contenido. Cada edición crea una versión nueva; las anteriores nunca se modifican.

### Uso histórico de plato
Registro derivado de la oferta y los pedidos: qué platos se usaron y cuándo. Sirve para sugerencias según clima y uso reciente.

## Modalidades de pedido

### General
Modalidad normal.

### Opcional
Modalidad normal. Puede tener precio especial propio.

### Media vianda
Modalidad que representa 50% de una vianda completa. **No es** un tipo de plato ni una categoría de producto. Se calcula como `precio normal / 2`.

## Precios

### Precio base
Precio de una versión concreta de plato o menú.

### Precio especial del cliente
Configuración actual del cliente. Puede ser general, opcional, o por plato específico.

### Precio aplicado
Valor congelado en el momento de crear el pedido. Nunca se recalcula.

### Precedencia de precios
Orden: precio específico por plato > precio general del cliente > precio base.

## Estados y ciclo de vida

### Semana draft
En configuración. No es oferta operativa.

### Semana active
Oferta disponible. Los clientes pueden pedir. Exactamente una a la vez.

### Semana closed
Período terminado. Históricamente inmutable.

### Cliente esperado
Población de clientes congelada al activar una semana. Se usa para calcular "sin responder". No se recalcula después.

### Sin responder
Cliente esperado de una semana que no tiene ni pedido ni cancelación para esa semana.

## Seguridad

### Token personal
Identificador único del cliente para acceder al menú. Se almacena hasheado, nunca en texto plano.

### Rotación de token
Operación que invalida el token anterior y genera uno nuevo. El anterior queda inválido inmediatamente.

### Admin
Usuario con cuenta en Supabase Auth autorizado en `private.admin_users`.