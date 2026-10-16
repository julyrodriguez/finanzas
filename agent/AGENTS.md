# AGENTS.md - Guía Maestra de Operaciones y Manejo de la Plataforma Finanzas

Bienvenido al espacio de trabajo del agente financiero de la plataforma `finanzas` de Cinemark & Hoyts Argentina.
Este archivo contiene la especificación exhaustiva de todas las secciones, modelos de datos, inyección, actualización y eliminación de información.

---

## 1. Arquitectura de Datos y Estrategia de Persistencia

La plataforma utiliza una estrategia de **Doble Escritura (Dual-Write) No Bloqueante**:

1. **MongoDB Backend (`https://apivacas.jariel.com.ar/api/`)**:
   - `/api/ordenes`: Órdenes de compra, presupuestos CAPEX y estadísticas.
   - `/api/cotizaciones`: Cotizaciones de insumos, ítems y proveedores.
   - `/api/pendientes`: Tareas, etapas operativas y checklist.
   - `/api/calendario`: Eventos y recordatorios de calendario.
   - `/api/proveedores`: Registro unificado de proveedores con enriquecimiento IA.
   - `/api/pizarron/notes`: Notas adhesivas del Pizarrón de Control.
2. **Firebase Firestore (Cloud)**:
   - Colecciones activas: `cotizaciones`, `pendientes`, `pizarron_notas`, `calendar_events`, `recordatorios`.
   - **Escudo de Cuota (`src/lib/firebase.ts`)**: Cuando Firestore reporta `resource-exhausted` o `quota exceeded`, se activa el flag `isFirestoreDisabled()` y la aplicación continúa operando al 100% en MongoDB y caché local sin trabar la interfaz.
3. **Caché Local / LocalStorage**:
   - Persistencia optimista inmediata en el cliente para respuesta instantánea.

---

## 2. Manejo de Secciones, Inyección, Modificación y Borrado

### A. Cotizaciones (`/cotizaciones`)
El corazón de compras e insumos. Permite comparar ofertas de múltiples proveedores para una lista de ítems.

- **Modelo de Datos (`SavedQuotation`)**:
  ```ts
  interface SavedQuotation {
    id: string; // ej: "cot-1729080000000" o ID Firestore
    name: string; // Título de la cotización
    status: "borrador" | "enviada" | "finalizada" | "cancelada";
    exchangeRate: number; // Tipo de cambio (ej. 1400)
    baseCurrency: "ARS" | "USD";
    useRealLots: boolean;
    notes: string;
    items: Item[]; // [{ id, name, baseUnit, targetQuantity, description }]
    providers: Provider[]; // [{ id, name, quotes: { [itemId]: QuoteDetail }, deliveryTime, paymentTerms, validityPeriod }]
    winningProviderId?: string; // ID del proveedor adjudicado
    sentAt?: string; // ISO string de cuándo se envió
    categoria?: string;
    pendienteId?: string; // Vínculo con una tarea en Pendientes
    attachments?: QuoteAttachment[];
    aiSummary?: string;
  }
  ```
- **Inyectar Nueva Cotización**:
  1. Generar ID único `cot-${Date.now()}` o ID de Firestore.
  2. Preparar el objeto con `status: "borrador"` (o `"enviada"` si ya fue remitida).
  3. Ejecutar llamada al endpoint Mongo: `POST https://apivacas.jariel.com.ar/api/cotizaciones` con el objeto completo incluyendo `firebaseId`.
  4. Guardar en Firestore: `setDoc(doc(db, "cotizaciones", id), data)` (protegido con try/catch para cuota).
  5. Actualizar LocalStorage `finanzas-cotizaciones`.
- **Modificar Estado (Ej. "ya envié la cotización de X")**:
  1. Buscar la cotización por nombre o proveedor en la lista.
  2. Asignar `status: "enviada"` y `sentAt: new Date().toISOString()`.
  3. Enviar actualización a Mongo: `POST https://apivacas.jariel.com.ar/api/cotizaciones` con el ID y los campos modificados.
  4. Actualizar en Firestore: `updateDoc(doc(db, "cotizaciones", id), { status: "enviada", sentAt })`.
- **Eliminar Cotización**:
  1. Llamar a Mongo: `DELETE https://apivacas.jariel.com.ar/api/cotizaciones/${id}`.
  2. Borrar en Firestore: `deleteDoc(doc(db, "cotizaciones", id))`.
  3. Si tenía `pendienteId`, remover el ID de `cotizacionesIds` del pendiente asociado.

---

### B. Recordatorios & Calendario (`/calendario` y Widget Global)
Permite programar compromisos, pagos a proveedores, fechas límites y alertas.

- **Modelo de Recordatorio (`Recordatorio`)**:
  ```ts
  interface Recordatorio {
    id: string;
    titulo: string;
    descripcion?: string;
    fecha?: string; // YYYY-MM-DD
    hora?: string; // HH:MM
    completado: boolean;
    prioridad?: "alta" | "media" | "baja";
    categoria?: "finanzas" | "reunion" | "operaciones" | "personal";
    origen?: "chat" | "email" | "manual";
    createdAt: string;
    completedAt?: string | null;
  }
  ```
- **Inyectar Recordatorio ("haceme acordar tal cosa el día tal")**:
  1. Extraer del lenguaje natural la fecha (relativa o absoluta: "mañana", "el viernes", "15/11") y la hora.
  2. Generar ID único `rec-${Date.now()}`.
  3. Guardar en la colección Firestore `recordatorios`.
  4. Sincronizar simultáneamente con `calendar_events` (`POST https://apivacas.jariel.com.ar/api/calendario`) si posee fecha definida para que figure en la vista de Calendario mensual/semanal.
  5. Reflejar en la mini-lista del asistente.
- **Marcar como Hecho o Desmarcar**:
  - Actualizar `completado: true/false` y `completedAt: new Date().toISOString()`.
- **Eliminar**:
  - `deleteDoc(doc(db, "recordatorios", id))` y remover de la caché local.

---

### C. Pendientes (`/pendientes`)
Tablero Kanban / Lista de tareas operativas y proyectos con checklist por etapas y vinculación directa a cotizaciones.

- **Modelo de Datos (`Pendiente`)**:
  ```ts
  interface Pendiente {
    id: string;
    titulo: string;
    descripcion: string;
    prioridad: "alta" | "media" | "baja";
    categoria?: string;
    completado: boolean;
    creadoPor: string;
    createdAt: Timestamp | null;
    completedAt: Timestamp | null;
    etapas?: { id: string; titulo: string; completado: boolean; completedAt?: string }[];
    fechaLimite?: string | null;
    cotizacionesIds?: string[];
  }
  ```
- **Inyección y Borrado**:
  - Sincronización Mongo: `POST https://apivacas.jariel.com.ar/api/pendientes`.
  - Eliminación: `DELETE https://apivacas.jariel.com.ar/api/pendientes/${id}` y `deleteDoc(doc(db, "pendientes", id))`.

---

### D. Proveedores (`/proveedores`)
Directorio corporativo de proveedores con IA, búsqueda híbrida (Google / Firecrawl) y redacción automática de mails de solicitud de cotización.

- **Modelo de Proveedor (`Proveedor`)**:
  - `nombre`, `rubro`, `zona`, `pais`, `email`, `emails`, `telefono`, `sitio_web`, `slaTags`, `rating`, `cotizaciones` (historial de participaciones y si ganó).
- **Operaciones**:
  - Búsqueda / Chat IA: `/api/proveedores/chat` y `/api/proveedores/search`.
  - Redacción de email para pedir presupuestos: `/api/proveedores/draft-email`.

---

### E. Órdenes de Compra (`/seguimiento-de-ordenes`)
Control de compras emitidas por las razones sociales Cinemark (CMK) y Hoyts.
- Campos clave: `empresa` ("Hoyts" | "CMK"), `numOC`, `numSolicitud`, `razonSocial`, `monto`, `motivo`, `formaPago`, `liberada`, `mandada`, `entregada`, `cancelada`.
- Endpoint central: `https://apivacas.jariel.com.ar/api/ordenes`.

---

### F. Pizarrón de Control (`/inicio` - BlackboardHub)
Espacio libre de notas adhesivas (`pizarron_notas`) con colores, checklists y trazos de tiza.

---

## 3. Protocolo de Arrastre y Comprensión de Correos (Emails)

El Asistente Global tiene un dropzone permanente para mails (`.eml`, `.msg`, `.txt` o texto arrastrado del cliente de correo).

1. **Detección de Pedido de Presupuesto / Cotización de Insumos**:
   - Disparadores: Palabras como "solicitud de presupuesto", "lista de precios", "adjuntamos cotización", "pedido de materiales", "insumos de limpieza", etc.
   - Acción:
     1. Extraer nombre del emisor/empresa proveedora.
     2. Extraer tabla o listado de ítems (descripción, unidad, cantidad, precio si vino cotizado).
     3. Sugerir o crear la cotización en estado `borrador` y asociar los ítems.
     4. Responder con resumen estructurado y botón interactivo para abrirla en `/cotizaciones`.
2. **Detección de Avisos de Envío o Cambios de Estado**:
   - Ejemplo: "Ya le mandé la cotización a X", "Enviada la propuesta a Cinemark".
   - Acción:
     1. Localizar la cotización correspondiente.
     2. Cambiar su estado a `enviada`.
     3. Notificar al usuario con el badge de estado actualizado.
3. **Detección de Compromisos y Fechas**:
   - Ejemplo: "Vencimiento de oferta el viernes", "Reunión de compras el martes a las 11".
   - Acción:
     1. Proponer o agendar automáticamente el recordatorio con fecha y hora.
     2. Añadirlo a la mini-lista de recordatorios del asistente.
