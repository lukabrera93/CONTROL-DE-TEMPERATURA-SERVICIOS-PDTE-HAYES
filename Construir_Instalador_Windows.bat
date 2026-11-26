@echo off
echo ============================================================
echo   ControlTerm - Generador de Instalador para Windows (.exe)
echo ============================================================
echo.
echo Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] No se encontro Node.js. Descargalo desde https://nodejs.org/
  pause
  exit /b 1
)

echo [1/3] Instalando dependencias...
call npm install
call npm install -D electron electron-builder

echo [2/3] Compilando aplicacion web offline...
call npm run build:electron

echo [3/3] Generando instalador ControlTerm-Setup.exe y version portable...
call npx electron-builder --config electron-builder.json --win

echo.
echo Listo! Revisa la carpeta "dist-electron" para obtener tu instalador .exe.
pause
