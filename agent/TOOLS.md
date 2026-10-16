# TOOLS.md - Herramientas e Integraciones del Agente

El agente tiene acceso a herramientas de sistema, API endpoints de la plataforma y llamadas a funciones para interactuar con la aplicación `finanzas`.

## 1. Endpoints de la Plataforma Finanzas

### Cotizaciones
- `GET https://apivacas.jariel.com.ar/api/cotizaciones` -> Lista de cotizaciones guardadas.
- `POST https://apivacas.jariel.com.ar/api/cotizaciones` -> Crear o actualizar cotización (payload: `SavedQuotation`).
- `DELETE https://apivacas.jariel.com.ar/api/cotizaciones/:id` -> Eliminar cotización.

### Pendientes y Tareas
- `GET https://apivacas.jariel.com.ar/api/pendientes` -> Lista de pendientes y configuración.
- `POST https://apivacas.jariel.com.ar/api/pendientes` -> Crear o actualizar pendiente.
- `DELETE https://apivacas.jariel.com.ar/api/pendientes/:id` -> Eliminar pendiente.

### Calendario y Recordatorios
- `GET https://apivacas.jariel.com.ar/api/calendario` -> Eventos programados.
- `POST https://apivacas.jariel.com.ar/api/calendario` -> Crear/actualizar evento de calendario.
- `DELETE https://apivacas.jariel.com.ar/api/calendario/:id` -> Eliminar evento.

### Proveedores
- `GET https://apivacas.jariel.com.ar/api/proveedores` -> Directorio de proveedores.
- `POST https://apivacas.jariel.com.ar/api/proveedores` -> Crear proveedor.
- `POST /api/proveedores/draft-email` -> Generar borrador de correo formal para pedir presupuestos.

## 2. API Interna de IA y Procesamiento de Mails
- `POST /api/agent/chat` -> Endpoint central de IA: procesa mensajes, texto de mails arrastrados y genera intenciones estructuradas:
  - `create_cotizacion`
  - `update_cotizacion_status`
  - `create_recordatorio`
  - `create_pendiente`
