# Gastro Manager

Sistema completo de gestión de restaurantes para administrar personal, sueldos, eventos y seguimiento de empleados.

## 🎯 Características Principales

- **Gestión de Empleados**: CRUD completo con búsqueda, filtros y estados activo/inactivo
- **Sistema de Sueldos**: Registro de salarios mensuales, adelantos y control de pagos
- **Calendario Integrado**: Eventos con integración de tópicos con fechas límite
- **Sistema de Seguimiento**: Tópicos y notas por empleado con deadlines visuales
- **Asistente Virtual con IA**: Chatbot inteligente potenciado por Google Gemini para consultas sobre tus datos
- **Panel de Administración**: Estadísticas de uso y gestión de administradores
- **Autenticación Segura**: Login con Google OAuth
- **Validaciones Robustas**: Validación de datos en frontend y backend

## 🏗️ Arquitectura

### Stack Tecnológico

- **Frontend**: React 19 + React Router 7 + Tailwind CSS
- **Backend**: Hono (framework web ligero)
- **Base de Datos**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Workers
- **Autenticación**: Mocha Users Service (Google OAuth)
- **Validación**: Zod
- **IA**: Google Gemini 2.5 Flash (Chatbot)

### Estructura del Proyecto

```
gastro-manager/
├── docs/                    # Documentación
│   ├── architecture.md      # Arquitectura del sistema
│   ├── database.md          # Esquema de base de datos
│   ├── api.md              # Endpoints de API
│   ├── frontend.md         # Estructura del frontend
│   ├── authentication.md   # Sistema de autenticación
│   ├── validation.md       # Sistema de validación
│   └── deployment.md       # Despliegue y configuración
├── src/
│   ├── react-app/          # Aplicación React
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/          # Páginas de la aplicación
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilidades
│   ├── worker/             # Backend (Cloudflare Worker)
│   │   ├── index.ts        # API endpoints y lógica
│   │   └── validation.ts   # Esquemas de validación Zod
│   └── shared/             # Tipos compartidos
└── public/                 # Archivos estáticos
```

## 🚀 Inicio Rápido

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Build

```bash
# Compilar para producción
npm run build

# Verificar configuración
npm run check
```

## 📚 Documentación Detallada

Para información específica sobre cada componente del sistema, consulta:

- **[Arquitectura](docs/architecture.md)**: Estructura general y patrones de diseño
- **[Base de Datos](docs/database.md)**: Esquema, tablas y relaciones
- **[API](docs/api.md)**: Endpoints REST y ejemplos de uso
- **[Frontend](docs/frontend.md)**: Componentes, páginas y hooks
- **[Autenticación](docs/authentication.md)**: Sistema de login y autorización
- **[Validación](docs/validation.md)**: Reglas y esquemas de validación
- **[Despliegue](docs/deployment.md)**: Configuración y variables de entorno

## 🎨 Diseño Visual

### Tema de Colores

El sistema utiliza una paleta cálida inspirada en restaurantes:
- **Primario**: Verde bosque (#2D5940)
- **Acento**: Ámbar (#E59645)
- **Fondo**: Beige claro (#F8F6F2)

### Tipografía

- **Títulos**: Playfair Display (serif elegante)
- **Cuerpo**: DM Sans (sans-serif moderna)

### Responsive Design

- **Mobile-first**: Optimizado para dispositivos móviles
- **Sidebar adaptativo**: Slide-out en móvil, colapsible en desktop
- **Grid flexible**: Se adapta a diferentes tamaños de pantalla

## 🔐 Seguridad

- Autenticación mediante Google OAuth
- Validación de datos en cliente y servidor
- Protección de rutas sensibles
- Sistema de administradores con permisos elevados
- Secretos almacenados de forma segura (no expuestos en código)

## 📊 Funcionalidades por Módulo

### 1. Dashboard
- Resumen de estadísticas clave
- Empleados activos y eventos del día
- Temas abiertos pendientes
- Vista rápida de sueldos mensuales
- Acciones rápidas a todas las secciones

### 2. Empleados
- Listado completo con búsqueda y filtros
- CRUD de empleados (crear, ver, editar, eliminar)
- Gestión de puestos personalizados
- Sistema de tópicos con fechas límite
- Notas asociadas a cada tópico
- Estados activo/inactivo

### 3. Sueldos
- Vista general mensual (salarios vs adelantos)
- Registro de adelantos por empleado
- Cálculo automático de sueldo neto
- Marcado de pagos (individual o lote)
- Histórico de períodos cerrados
- Solo empleados activos

### 4. Calendario
- Vista mensual interactiva
- Eventos con fecha, hora, tipo y ubicación
- Integración con tópicos pendientes
- Indicadores visuales (rojo: vencido, ámbar: pendiente)
- CRUD completo de eventos

### 5. Administración
- Estadísticas generales del sistema
- Total de usuarios y promedios
- Uso por módulo (gráficos de distribución)
- Gestión de emails administradores
- Solo visible para administradores

### 6. Asistente Virtual (Chatbot IA)
- Widget flotante accesible desde cualquier página
- Potenciado por Google Gemini 2.5 Flash
- Consultas en lenguaje natural sobre:
  - Empleados (cantidad, roles, estados)
  - Sueldos y adelantos del período
  - Eventos y calendario
  - Tópicos pendientes y vencidos
- Respuestas contextuales basadas en tus datos reales
- Historial de conversación en la sesión
- Soporte completo en español

## 🛠️ Comandos NPM

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Compilar para producción
npm run check        # Verificar build y configuración
npm run lint         # Ejecutar linter
npm run knip         # Detectar código sin usar
npm run cf-typegen   # Generar tipos de Cloudflare
```

## 📝 Convenciones de Código

### TypeScript
- Usar tipos explícitos donde sea importante
- Interfaces para objetos compartidos
- Tipos derivados de Zod para validación

### React
- Componentes funcionales con hooks
- Props destructuradas
- Custom hooks para lógica reutilizable
- Context para estado global

### Estilos
- Tailwind CSS para estilos
- Componentes UI basados en shadcn/ui
- Variables CSS para temas (`:root` y `.dark`)

### Base de Datos
- Nombres en snake_case
- Timestamps automáticos (`created_at`, `updated_at`)
- IDs autoincrement
- Campos booleanos con prefijo `is_` o `has_`

## 🤝 Contribución

Este es un proyecto de gestión interna. Para modificaciones:

1. Crear rama desde `main`
2. Implementar cambios con commits descriptivos
3. Probar localmente con `npm run check`
4. Crear pull request con descripción detallada

## 📄 Licencia

Proyecto privado - Todos los derechos reservados.

## 📞 Soporte

Para preguntas o problemas:
- Consultar documentación en `/docs`
- Revisar logs en el panel de Cloudflare
- Contactar al equipo de desarrollo

---

**Versión**: 1.0.0  
**Última actualización**: 2024  
**Plataforma**: [Mocha](https://getmocha.com)
