# ControlTerm — Control Semanal de Temperatura

Aplicación web offline (PWA) para el control semanal de planillas de temperatura cada lunes por distritos y servicios, con múltiples termómetros por establecimiento, alertas de cadena de frío, exportación a Excel/PDF, impresión y recordatorios por WhatsApp o correo.

## Cómo publicar en GitHub Pages (sin pantalla en blanco)

> **Importante:** GitHub Pages no ejecuta archivos TypeScript (`.tsx`) directamente desde la raíz del proyecto. Por eso el repositorio ya incluye la carpeta compilada **`docs/`** lista para publicar y el flujo automático de **GitHub Actions**.

### Opción 1: Más rápida (usando la carpeta `docs/` ya compilada)
1. Sube toda esta carpeta a tu repositorio en GitHub (incluyendo la carpeta `docs/`).
2. En GitHub, abre **Settings → Pages**.
3. En **Build and deployment → Source**, selecciona **Deploy from a branch**.
4. En **Branch**, elige **`main`** (o `master`) y la carpeta **`/docs`**, luego haz clic en **Save**.
5. Espera 1–2 minutos y abre el enlace que muestra GitHub Pages.

### Opción 2: Automática con GitHub Actions (si modificas el código fuente)
1. En GitHub, abre **Settings → Pages**.
2. En **Source**, selecciona **GitHub Actions**.
3. Cada vez que subas cambios a `main` o `master`, el archivo `.github/workflows/deploy.yml` compilará automáticamente la aplicación y la publicará.

## Desarrollo local y compilación
```bash
npm install
npm run dev       # Inicia servidor local en http://localhost:3000
npm run build     # Compila en dist/
npm run build:gh  # Actualiza la carpeta docs/ para GitHub Pages
```
