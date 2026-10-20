# Planner Today — Mapa de fases

Estado general: **Fases 1–7 terminadas y verificadas**. Fase 8 en curso; Fase 9 pendiente.

> Ver también: `README.md` (cómo correr el proyecto), `AGENTS.md` (guía para agentes).

---

## ✅ FASE 1 — Base de la aplicación (terminada)

**App móvil**
- [x] Proyecto Expo + TypeScript + Expo Router (actualizado a **SDK 57** para Expo Go del dispositivo)
- [x] Navegación por tabs: Inicio, Mapa, `+` central, Planificador, Estadísticas
- [x] Botón `+` central → modal **Nuevo Registro** (Persona, Venta, Gasto, Lugar, Tarea, Evento + galería)
- [x] Pantalla **Inicio**: saludo dinámico, selector de fecha local, Metas diarias/semanales demo, Personas demo
- [x] Pantalla **Perfil**: nombre, moneda (PEN/USD/EUR), placeholders de tema/semana/notificaciones
- [x] Login/Registro visual (pendiente conectar a JWT real)
- [x] Diseño crema original + `assets/icon.png` generado
- [x] Estado global Zustand + AsyncStorage (`useAppStore`, `storage`)
- [x] `npm run typecheck` en verde; bundle Android verificado (1470 módulos, HTTP 200)

**Backend**
- [x] Express + TS + Prisma + PostgreSQL (schema completo, ver `backend/prisma/schema.prisma`)
- [x] Auth: register/login/me con JWT + refresh + bcrypt + zod
- [x] `GET /health` verificado `{"ok": true}`
- [x] Fórmula de productividad aislada (`productivity.service.ts`)

**Pendiente conocido de Fase 1**
- [x] Migrar la DB — hecho (usuario `planner` + migrate `20261006221812_init`)
- [x] Login/registro conectados al JWT — hecho en Fase 2

---

## ✅ FASE 2 — Planificador (terminada 2026-10-06)

- [x] Semana Lun–Dom con día resaltado + agenda vertical por horas en bloques de color (`planificador.tsx` + `DayAgenda.ts`)
- [x] CRUD Tareas completo (crear/editar/eliminar/prioridades/categorías/estados) + completar desde Planificador con ✓
- [x] CRUD Eventos (hora inicio/fin validada, ubicación, aviso `notifyMins` solo guardado, repetición none/daily/weekly)
- [x] Botón `+` del planificador → `/tarea`; `+` central → tarea/evento; resto en Fases 3/4/7/8
- [x] API `tasks` + `events` con `requireAuth`, zod (400 con detalle), `asyncHandler` (Express 4 no captura throws async — sin esto el server se caía)
- [x] Login/registro conectados al JWT real + gate de sesión en `_layout` (redirige a login sin token)
- [x] Tarjeta "Tareas" del Inicio con conteo real del día (demo si no hay sesión)
- [x] Typechecks en verde + bundle Android HTTP 200

**Extensión 2026-10-07 (referencia video timeline):**
- [x] Parrilla día completa 0–23 (antes solo horas con eventos), bloques con altura por duración, solapados lado a lado
- [x] Vista semana (7 columnas) + vista mes (puntitos + detalle del día) + swipe horizontal entre días
- [x] Semana navegable con ‹ › + botón Hoy (llega a días pasados como el 1 oct, editables)
- [x] Drag & drop con PanResponder (sin librerías): mantener 450ms, vertical cambia hora (pasos 30min), horizontal cambia día; al soltar PATCH
- [x] Snackbar Deshacer 8s que revierte el movimiento (series incluidas)
- [x] Form evento: Tipo+color (generales, nada religioso), Tentativo (borde punteado), Contactos (endpoint mínimo `GET/POST /api/contacts`), Reporte, repetición diaria/semanal/mensual/por-días
- [x] Expansión de recurrencia en móvil (`recurrence.ts`); mover ocurrencia mueve la serie
- [x] Backend: `Event.type/color/tentative`, enum `repeat` extendido, migrate aplicado
- [x] Refresh de sesión: `POST /api/auth/refresh` + reintento automático en el móvil (el access de 15 min ya no tumba los guardados); errores específicos en vez de "revisa la conexión"
- [x] Cerrar sesión en Perfil (para volver al login)
- [x] Hora sin teclado: rueda HH:MM + −/+30min + chips de duración; tocar hora vacía la precarga
- [x] Línea roja de hora actual (punto + línea, solo hoy, se mueve cada minuto, scroll automático al abrir)
- [x] Reloj analógico (esfera táctil hora→minutos + mitad día, respeta 12/24h) + botón Ahora
- [x] Crear arrastrando en vacío (mantener hora, arrastrar, soltar → formulario con rango)
- [x] Descartar cambios (✕ con confirmación en tarea y evento)
- [x] Plan de respaldo (plan B misma fecha sin recordatorio, badge 🛟, borrado en cascada)
- [x] Filtro por tipo + selección múltiple (completar/eliminar) en la agenda
- [x] Ajustes en Perfil: formato 12/24h + inicio/fin del día (la parrilla los respeta)
- [x] Responsive: columnas de semana por ancho (`useWindowDimensions`), bloques adaptativos
- [x] Correcciones del video 2:12: línea actual sutil, filtro legible, gutter ancho en 12h, pager día↔tira sincronizada, pinch-zoom 0.5–2x, hoja `+` con Tareas/Eventos
- [x] Gestos nativos (`gesture-handler` + `reanimated` + `pager-view`, incluidos en Expo Go): pager sin salto doble, pinch con snap, drag con `onFinalize` garantizado, esfera con Pan que captura el dedo
- [x] REVERT 2026-10-08 (pedido del usuario): fuera las 4 libs nativas; pager manual con candado 600ms, zoom con botones +/−, drag y esfera con `PanResponder` + captura + salvavidas. Cero WARN, bundle limpio.
- [x] Hora nativa del sistema (`datetimepicker`, en Expo Go) en tarea/evento; esfera eliminada
- [x] Filtros al icono embudo (hoja); fila de chips fuera
- [x] Detalle `/detalle` (tap en bloque): ver todo + Editar/Duplicar/Eliminar con confirmación
- [x] Aviso de cruce al guardar ("Se cruza con X — ¿guardar igual?")
- [x] Plantillas en la hoja `+`: Desayuno/Almuerzo/Reunión de un toque
- [x] Tipos editables (Ajustes → Tipos y plantillas) vía `Setting` sin migración + `GET/PUT /api/settings/:key`; formulario y agenda usan el catálogo
- [x] Filtros Todo/Eventos/Tareas + por tipo en la hoja del embudo
- [x] Detalle como hoja sobre la agenda (ruta `/detalle` eliminada) con Editar/Duplicar/Eliminar
- [x] Tentativo eliminado por completo (schema, API, UI) + respaldo como estado `isBackup` (opaco, va después, sin endpoints extra)

## ✅ FASE 3 — Contactos (terminada 2026-10-08)

- [x] CRUD Personas completo (nombre/apellido/tel/WhatsApp/email/dirección/categoría/notas/último-próximo contacto)
- [x] Categorías defaults + personalizadas (`GET/POST/DELETE /api/contact-categories`, con protección en uso)
- [x] Seguimiento: "Contactar hoy", `?followup=today|overdue|upcoming`, buscador, `POST /:id/touch` (contactado hoy)
- [x] Acciones Llamar/WhatsApp/SMS (`expo-linking`, dependencia directa)
- [x] Pantallas `/personas` (desde "Ver más") + `/persona` (desde `+` central); selector del evento usa lista real
- [x] Extra: `repeatUntil` en eventos ("repetir hasta…", respeta límite en expansión)
- [x] Extras 2026-10-08: ubicación en mapa al crear (marcador arrastrable + mi ubicación con `expo-location`), color+símbolo por categoría, última categoría por defecto, Inicio sin "Añadir", vista de contacto antes de editar
- [x] Typechecks + bundle Android HTTP 200

## ✅ FASE 4 — Finanzas (terminada 2026-10-08, renombrado Ventas→Ingresos)

- [x] Renombre completo: `Sale`→`Income` (migración rename), rutas `/api/incomes`, UI "Ingresos"
- [x] Ingresos: fecha, título, categoría, cantidad × precio con total automático del servidor, cliente opcional, 6 métodos de pago, nota
- [x] Gastos: fecha, descripción, categoría con color, monto, fijo/variable, nota + categorías personalizadas
- [x] `GET /api/finance/summary`: ingresos, gastos, neto por rango (base de Fase 6)
- [x] Pantallas `/ingresos`, `/ingreso`, `/gastos`, `/gasto` + tira "Hoy" en Inicio (ingresos/gastos/neto)
- [x] `+` central: Ingreso y Gasto abren formularios
- [x] Typechecks + bundle Android HTTP 200

## ✅ FASE 5 — Metas (terminada 2026-10-08)
- [x] Pantallas `/metas` (diarias/semanales/mensuales, barra, pausar/completar) + `/meta` (con cuota por hora: 100 u/h × 15 h → 1500)
- [x] Inicio conectado: tarjetas diarias/semanales reales (demo solo si no hay metas)
- [x] `+` central con 7ª opción Meta
- [x] Refinamiento video: unidad automática por tipo (fuera campo y cuota), log de avance manual con historial (`GoalLog`), sin estado pausada + pestaña Historial, filtro por categoría en metas de contactos, origen visible ("De: …"), tira con destinos correctos + hoja de desglose, demo "Ventas"→"Ingresos"
- [x] Metas vinculadas a eventos: `Event.goalId` + `done`, vincular desde la meta, ✓ auto al pasar la hora + manual, 🎯 en agenda, progreso suma vinculados realizados
- [x] Frecuencia + breakdown: tipo `veces`, crear eventos mar/jue desde la meta, elegir personas (filtro + lista con ✓/○), mes no navega, picker migrado
- [x] APIs externas en planner (sin key): feriados Perú (Nager.Date, punto rojo + badge) + clima (Open-Meteo, chip con ubicación)
- [x] Typechecks + bundle Android HTTP 200

## ✅ FASE 6 — Estadísticas (terminada 2026-10-11)

- [x] API `stats/overview` (ingresos, gastos, neto, tareas, eventos, contactos, horas, metas, productividad con la fórmula existente) + `expenses-by-category`
- [x] Pantalla real: selector Día/Semana/Mes, resumen, barras Ingresos vs Gastos + neto, categorías con % y monto, puntaje de productividad explicado
- [x] Sin librerías de gráficas (Views puras)
- [x] Typechecks + bundle Android HTTP 200

## ✅ FASE 7 — Mapa (terminada 2026-10-11, parche MapLibre/OpenFreeMap 2026-10-19)

- [x] API `places` (CRUD con lat/lng obligatorios, categorías con color) + `GET /api/places/map/items` (lugares + contactos ubicados, unificados)
- [x] Mapa real: buscador, filtros, pins por categoría, zoom +/−, mi ubicación, tarjeta inferior (Llamar/Cómo llegar/Editar-Ver)
- [x] Formulario `/lugar` (categorías + punto arrastrable + mi ubicación); `+` central → Lugar
- [x] Parche 2026-10-15: mapa nativo (`react-native-maps`) salía negro en Expo Go (sin API key de Google los tiles no pintan). **Mapa temporal con Leaflet dentro de WebView** (tiles OSM, `react-native-webview`; sustituido por MapLibre el 2026-10-19): mismo buscador/filtros/pines/tarjeta; mini-mapas de `/lugar` y `/persona` también en WebView (pin arrastrable por toque, avisa al nativo).
- [x] Tiles del mapa (2026-10-19): **Esri World Street Map** (look tipo Google, sin key). CARTO Voyager se descartó: ahora sus tiles piden key ("API KEY REQUIRED"). Google Maps sigue bloqueado porque la key del usuario es válida pero **el proyecto no tiene facturación** ("You must enable Billing on the Google Cloud Project").
- [x] **Mapa comercial (2026-10-19)**: migrado a **MapLibre GL + OpenFreeMap** (`src/components/mapHtml.ts`, estilo vectorial `tiles.openfreemap.org/styles/bright`). Motivo: Esri y MapTiler free **prohíben el uso comercial** y la app va camino a Play Store. Verificado en navegador real: los 3 mapas cargan (`load` en zoom 13/15), `setMarkers`/`showPick`/`clearPick`/`zoomBy`/`flyTo` sin errores, clic en pin → `{type:'select'}`, fondo → `{type:'bg'}`, mantener presionado → `{type:'create',lat,lng}`, selector → `{type:'move'}`. `androidLayerType="hardware"` en los 4 WebView (WebGL).
- [ ] **Opcional (requiere facturación en Google Cloud): migrar a Google Maps** — la key ya está en `mobile/.env` (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`); pasos en `src/components/mapHtml.ts`. Con dinero, MapTiler ($30/mes) también vale: solo cambia la URL del estilo.
- [x] Parche 2026-10-15 (mañana): mapa a pantalla completa (tarjeta flotante), atribución no navegable (`onShouldStartLoadWithRequest=false`), centro en tu ubicación al abrir (Lima solo sin permiso), pines distintos (lugar=círculo con letra, persona=cuadrado con 👤) + filtros Personas/Lugares, pines que se achican al alejar, mantener presionado → crear persona/lugar ahí (`/persona?lat&lng`, `/lugar?lat&lng`)
- [x] Parche 2026-10-15 (2): pines de persona con el color de su categoría (`contact-categories`), pines de lugar con emoji por categoría (`PLACE_ICONS` en `places.ts`, 📍 para personalizadas)
- [x] Parche 2026-10-15 (3): mapa a sangre completa (WebView absoluto top/left/right/bottom=0 + buscador/filtros flotando con `pointerEvents=box-none`, `window.refresh()` con `invalidateSize` al montar, fuera `flex`+`height` que se pisaban)
- [x] Typechecks + bundle Android HTTP 200

## ⬜ FASE 8 — Funciones avanzadas

- [x] Escáner "inteligente" con IA (2026-10-16): la foto va al proveedor de IA (`backend/src/services/ai/`, Gemini `gemini-flash-lite-latest` + respaldos `gemini-3-flash-preview`/`gemini-flash-latest`, key gratis **sin tarjeta** en https://aistudio.google.com/apikey), que la "mira" (multimodal) y devuelve las clases ya estructuradas (`normalizeClasses`: días, 24h, quita recesos/duplicados). Endpoints: `POST /api/scanner/ocr` ahora devuelve `{text,candidates,ai,aiError}`, `POST /api/scanner/parse` (texto pegado) y `GET /api/scanner/ai` (indicador). Env: `AI_PROVIDER=gemini|none`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACKS`. **OCR e IA en paralelo** (espera = la de la IA, ~9 s con la foto real). Con `none` el móvil cae al parser de reglas local (la pantalla muestra "Modo IA apagado/activo").
- [x] Fechas sin teclado (2026-10-19): "Repetir hasta" del escáner y las fechas de evento/ingreso/persona usan **calendario nativo** (`NativeDate` + `parseLocalDay`); ya no se puede crear una fecha inválida a mano (el `2027 10 24` con espacios rompía con "Date value out of bounds"). Atajos +4 meses / +6 meses / Fin de año.
- [x] Escáner de horarios (2026-10-15): foto con `expo-camera` → OCR en servidor (`POST /api/scanner/ocr`, provider `OCR.space` gratis sin tarjeta, key en `OCRSPACE_KEY`) → parser ES a reglas (`scheduleParser.ts`, 8/8 casos) → lista editable → eventos semanales hasta fin de semestre. La foto **no se guarda**: se procesa en memoria y se borra del celular. Pantalla `/escaner` (Foto/Texto pegado) + opción en `+` central. **Opción B lista para implementar**: interfaz `OcrProvider` + stub `mlkit` + pasos en `ocrProvider.ts` (requiere dev build).
- [x] Mapa: marca visible del punto elegido (2026-10-16): al mantener presionado aparece un 📍 con pulso donde se presionó (`showPick`/`clearPick` en `mapHtml.ts`) para no confundir el lugar.
- [x] Recordatorios locales (2026-10-15): `expo-notifications` sin servidor (eventos con su `notifyMins`, tareas 2 días, seguimientos hoy/vencidos 9:00, metas a 3 días 20:00 víspera; máx 40, throttle 15 min, reprograma al abrir tabs). Interruptor + aviso de prueba en Perfil (`prefs.reminders`). Push remoto queda para Fase 9 (tabla `Notification` ya existe). **Ojo**: el paquete raíz `expo-notifications` lanza `Error` en Android/Expo Go (push quitado en SDK 53) → se usa el envoltorio `src/services/notifications.ts` (solo submódulos locales, import perezoso).
- [x] Datos demo eliminables (2026-10-19): flag persistido `demoCleared` en `usePrefs` (`@planner/prefs`). Perfil → "Datos de prueba" → **Eliminar datos de prueba** (con `Alert` de confirmación) y "Volver a mostrar los ejemplos". Inicio: metas reales > demo > **estado vacío** con botón "Crear metas"; la fila de Personas ahora usa **contactos reales de la API** (scroll horizontal, hasta 8) y solo cae a los demo si no hay; botón "+" para añadir persona.
- [x] Adjuntos por módulo — **descartado** (2026-10-19): se quitaron `/api/attachments`, la tabla `Attachment` (migración `20261019000000_drop_attachment`), `backend/uploads/` y la fila "Agregar desde la galería". El escáner procesa la foto en memoria y borra la temporal del celular.
- [ ] Push con `expo-notifications` (tareas, eventos, seguimientos, metas)
- [x] Offline real (2026-10-19): **lectura** con caché de todos los GET (`@planner/cache:<ruta>`) y **escritura** en cola (`@planner/pendingOps`) para tareas, ingresos, gastos, eventos, lugares, contactos (incluye "marcar contactado") y metas. Los POST/PATCH/DELETE se pintan al instante con id `tmp_...`; al volver la red se envían en orden y `@planner/idMap` traduce los ids temporales (también dentro de cuerpos: `contactIds`, `clientId`, `goalId`...). Auto-sync al abrir/volver a la app, tras cada petición buena y cada 15 s; botón "Sincronizar ahora" en Perfil. Inicio muestra "Sin conexión · mostrando datos guardados". Lógica pura en `src/services/syncCore.ts`, cola en `sync.ts`, integración en `api.ts`. **No** soportado offline: escáner (FormData) y categorías; los endpoints derivados (`finance/summary`, `stats/overview`) se cachean pero no se recalculan con la cola.
- [x] Ajustes tras la primera prueba offline (2026-10-19): overlay para `/api/places/map/items` (el mapa ya refleja crear/editar/borrar puntos), pulsado largo del mapa arreglado en Android (`touchcancel` + selección), `rewritePath` por segmentos, deduplicado de POST idénticos (15 min) y botón "Descartar pendientes" en Perfil. Timeout de 8 s (60 s para el escáner).
- [x] Datos curiosos mientras el escáner procesa (`src/data/funFacts.ts`): rota cada 5,5 s, ~8 % son guiños.
- [x] Multi-moneda sin conversión (2026-10-19): `User.currency` + `currencySymbol` (migración `20261019000001_user_currency_symbol`). Perfil: chips PEN/USD/EUR y **"Otra…"** (código 2–6 + símbolo, ej. COP/ARS/PCO), aviso de que no convierte importes. `formatMoney` toma el símbolo de `useSession`, así que los 18 usos cambian solos. `PATCH /api/auth/me` (nombre, moneda, tema, semana) y el usuario se cachea en `@planner/user` para arrancar sin red; al guardar se limpia `@planner/cache:*`.
- [x] Inicio de semana Lun/Dom (2026-10-19): `prefs.weekStartsOn` (persistido) + `User.weekStartsOn`; Planificador (vista semana, rejilla mensual y cabecera) y los rangos de `stats.controller`/`goals.controller` respetan la elección. Se guarda al tocar el chip (no espera a "Guardar").
- [x] Tema claro / oscuro / típico / automático (2026-10-19): `usePrefs.theme` + `User.theme`; `useThemedStyles(createStyles)` recrea los estilos por paleta (30 pantallas/componentes) y `colors` es un Proxy que resuelve la paleta activa para los colores sueltos en JSX. Paletas en `src/theme/colors.ts`: claro (crema), oscuro (negro cálido de telar, texto crema y acentos terracota/oro) y **típico andino** (pergamino, terracota, ocre y turquesa inspirado en textiles). La barra de tabs del tema típico lleva una banda tejida de colores andinos. `auto` sigue al sistema (`useColorScheme`). Perfil → chips Claro/Oscuro/Típico/Automático; el tema se guarda al tocarlo y se aplica al iniciar sesión. `StatusBar` cambia a claro en oscuro.
- [x] Seguridad (2026-10-19): límite de intentos en memoria (`src/middleware/rateLimit.ts`): login 10/15 min por IP+correo, registro 20/h por IP, cambio de clave 5/15 min (429 con `Retry-After`). `PATCH /api/auth/password` (verifica la actual, mínimo 8) y `DELETE /api/auth/account` (confirmar escribiendo **ELIMINAR** desde Perfil → borra en cascada). `x-powered-by` apagado; CORS solo acepta apps nativas (sin `Origin`), `localhost`/`127.0.0.1` y `CORS_ORIGINS`. Perfil tiene tarjetas **Seguridad** y **Eliminar cuenta**. Pendiente: revocar refresh tokens al cambiar la clave (hoy el access vive 15 min y el refresh 30 d).
- [x] Legal y privacidad (2026-10-19): pantallas **`/privacidad`** y **`/terminos`** (públicas, también accesibles desde el registro), tarjeta **Legal** en Perfil (al final, junto a Seguridad y Eliminar cuenta) y enlaces desde el alta. Texto canónico en `mobile/src/data/legal.ts`; copia para publicar en `docs/legal/*.md` (GitHub Pages, carpeta `/docs`) con la URL que pedirá Play Console. El correo de contacto es provisional hasta confirmarlo.
- [x] Limpieza: datos demo eliminables desde la app (2026-10-19, ver arriba)
- [ ] Preparación producción (builds Android/iOS, variables, logs)
- [ ] Decidir stack al iniciar: Supabase (todo junto) vs Render + Neon, + Sentry día 1, builds EAS

## ⬜ FASE 9 — Nube y colaboración

- [ ] Copias de seguridad: exportar/importar (JSON/ICS) + copia automática en la nube con cuenta (invitado sin copia)
- [ ] Agenda compartida: invitar por correo/enlace, permisos ver/editar, color propio, aviso de cambios
- [ ] Google Calendar doble vía + importar `.ics` (universidad); anti-duplicados por `externalId`; feriados display-only jamás se sincronizan
- [ ] APIs externas restantes: Fixer (moneda), Nominatim (geocodificar), validación email/tel

---

## Reglas entre fases

1. No avanzar de fase con errores importantes abiertos.
2. Cada fase: typecheck móvil + backend en verde y prueba en Expo Go antes de cerrar.
3. No romper lo que ya funciona (Inicio/tabs/auth visual/api health).
4. Arquitectura ya preparada para futuro (premium, IA, Google Calendar, WhatsApp, equipos) — no implementar, solo no bloquear.
