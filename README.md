# 🚲 BiciCoruña Monitor

Sistema de monitorización en tiempo real del servicio de bicicletas públicas de A Coruña.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11+-yellow)

## 📋 Descripción

BiciCoruña Monitor es una aplicación web completa para visualizar y analizar la disponibilidad de bicicletas públicas en A Coruña. Incluye:

- 🗺️ **Mapa interactivo** con marcadores de estaciones coloreados por disponibilidad
- 📊 **Estadísticas en tiempo real** de bicicletas y huecos libres
- 📍 **Geolocalización** para encontrar estaciones cercanas
- 📈 **Histórico de datos** para análisis de patrones
- 🔗 **Integración con n8n** para automatizaciones
- 🌙 **Modo oscuro/claro** con diseño responsive

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTML/CSS/JS (Mobile-First) + Leaflet.js           │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ API REST
┌────────────────────────▼────────────────────────────────────┐
│                        BACKEND                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FastAPI + SQLAlchemy + Pydantic                    │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼───────┐  ┌─────▼─────┐   ┌──────▼──────┐
│  PostgreSQL   │  │  n8n      │   │  GBFS API   │
│  (Histórico)  │  │  (Flows)  │   │  (Datos)    │
└───────────────┘  └───────────┘   └─────────────┘
```

## 📁 Estructura del Proyecto

```
corusmart/
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── api/v1/            # Endpoints versionados
│   │   ├── models/            # Modelos SQLAlchemy
│   │   ├── services/          # Lógica de negocio
│   │   ├── db/                # Base de datos
│   │   └── integrations/      # n8n, APIs externas
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # Aplicación web
│   ├── css/                   # Estilos
│   ├── js/
│   │   ├── modules/           # Módulos JS
│   │   ├── config.js          # Configuración
│   │   └── app.js             # Entrada principal
│   └── index.html
│
├── n8n/                        # Workflows n8n
│   └── bicicoruna-workflow.json
│
├── docker-compose.yml          # Orquestación
├── nginx.conf                  # Config del servidor web
├── .env.example                # Variables de entorno
└── README.md
```

## 🚀 Inicio Rápido

### Requisitos

- Docker y Docker Compose
- (Opcional) Python 3.11+ para desarrollo local

### Instalación con Docker (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/rferreiroa/corusmart.git
cd corusmart

# 2. Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 3. Levantar los servicios
docker compose up -d

# 4. Verificar que todo está corriendo
docker compose ps
```

La aplicación estará disponible en:
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/api/docs
- **n8n** (si está activo): http://localhost:5678

### Instalación para Desarrollo

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bicicoruna"

# Ejecutar
uvicorn app.main:app --reload

# Frontend (simplemente servir los archivos estáticos)
cd ../frontend
python -m http.server 3000
```

## 📡 API Endpoints

### Sistemas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/systems` | Listar sistemas |
| GET | `/api/v1/systems/{id}` | Obtener sistema |
| GET | `/api/v1/systems/{id}/stats` | Estadísticas del sistema |

### Estaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/stations` | Listar estaciones |
| GET | `/api/v1/stations/{id}` | Obtener estación |
| GET | `/api/v1/stations/{id}/status/current` | Estado actual |
| GET | `/api/v1/stations/{id}/status?from=...&to=...` | Histórico |

### Webhooks (n8n)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/ingest` | Recibir datos de n8n |
| GET | `/api/v1/webhooks/stats/{system_id}` | Estadísticas para n8n |

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión PostgreSQL | `postgresql://...` |
| `DEBUG` | Modo debug | `false` |
| `CORS_ORIGINS` | Orígenes permitidos | `*` |
| `N8N_BASE_URL` | URL de n8n | `http://localhost:5678` |
| `INGESTION_INTERVAL_SECONDS` | Intervalo de actualización | `120` |

### Integración con n8n

El proyecto incluye un workflow de n8n (`n8n/bicicoruna-workflow.json`) que:

1. Cada minuto, obtiene datos de la API GBFS de Bicicoruña
2. Procesa y combina información de estaciones
3. Envía los datos al backend via webhook

Para importar el workflow:
1. Abrir n8n (http://localhost:5678)
2. Ir a Workflows → Import from File
3. Seleccionar `n8n/bicicoruna-workflow.json`

## 📊 Modelo de Datos

### Systems (Sistemas)
```
id: string (PK)
name: string
type: string (bike_sharing)
city: string
country: string
gbfs_url: string
is_active: boolean
```

### Stations (Estaciones)
```
id: integer (PK)
system_id: string (FK)
external_id: string
name: string
lat: float
lon: float
capacity: integer
```

### Station_Status (Estado)
```
id: integer (PK)
station_id: integer (FK)
timestamp: datetime
bikes_available: integer
docks_available: integer
ebikes_available: integer
occupancy_rate: float
```

## 🗺️ Roadmap

- [x] **v1.0** - Frontend con datos en tiempo real
- [x] **v2.0** - Backend API + Base de datos histórica
- [ ] **v2.1** - Gráficos de histórico por estación
- [ ] **v2.2** - Soporte para BiciMAD
- [ ] **v2.3** - PWA + Notificaciones push
- [ ] **v3.0** - Predicciones ML de disponibilidad

## 🤝 Contribuir

1. Fork el repositorio
2. Crear una rama (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

## 👤 Autor

**Roi Ferreiroa**
- GitHub: [@rferreiroa](https://github.com/rferreiroa)
- Web: [roi-automation.es](https://roi-automation.es)

---

⭐ Si este proyecto te resulta útil, ¡dale una estrella!
