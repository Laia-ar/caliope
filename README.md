# Calíope

Editor de markdown con funciones de IA para generación de preguntas.

## Requisitos previos

- **Git**
- **Node.js y npm** (recomendado: usar nvm)
- **Python 3.9+**
- **Docker** (opcional, para levantar todo con contenedores)

---

## Opción 1: Desarrollo local (sin Docker)

### Backend (Flask)

```bash
# Crear y activar entorno virtual
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependencias
cd backend
pip install -r requirements.txt

# Crear .env en la raíz del repo (ver .env.example)
# Levantar servidor
python app.py
# Accesible en: http://localhost:5000
```

### Frontend (Next.js)

```bash
cd frontend

# Instalar dependencias
npm install
# o si hay conflictos de peers: npm install --legacy-peer-deps

# Crear frontend/.env.local:
# NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
# BACKEND_URL=http://localhost:5000

# Levantar servidor de desarrollo
npm run dev
# Accesible en: http://localhost:3000
```

---

## Opción 2: Docker (recomendado)

Todo dockerizado, con Caddy incluido para SSL automático:

```bash
# Local
cp .env.example .env
docker compose up --build
```

Abrir http://localhost.

### En un servidor nuevo (VPS)

```bash
# 1. Clonar y entrar
git clone https://github.com/Laia-ar/caliope.git
cd caliope

# 2. Crear .env de producción (completar todos los valores)
cp .env.example .env
nano .env

# 3. Levantar
docker compose up --build -d
```

Caddy pide el certificado SSL de Let's Encrypt automáticamente. La app queda disponible en `https://tu-dominio.com`.

---

## Variables de entorno

### Backend (`.env` en raíz o `backend/.env`)

```
SECRET_KEY=tu-clave-secreta
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
OPENROUTER_API_KEY=tu-api-key
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:5000
```

---

## Estructura del proyecto

```
.
├── backend/          # API Flask
│   ├── app.py
│   ├── models.py
│   ├── requirements.txt
│   └── ...
├── frontend/         # Aplicación Next.js
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── ...
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Contribuidores

- Calde
- david-coronel
- Faco
- Jorge Martinez

## Licencia

Este proyecto está licenciado bajo la [GNU General Public License v3.0](LICENSE).
