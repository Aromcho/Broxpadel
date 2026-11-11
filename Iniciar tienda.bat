@echo off
chcp 65001 >nul
title Brox Padel - tienda local
cd /d "%~dp0"
echo.
echo  BROX PADEL - levantando la tienda en tu PC
echo  ------------------------------------------
where node >nul 2>nul || (echo  Falta Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y volve a abrir este archivo. & pause & exit /b 1)
if not exist node_modules (
  echo  Instalando dependencias, la primera vez tarda unos minutos...
  call npm install || goto error
)
echo  Preparando base de datos y catalogo...
call npm run setup || goto error
echo.
echo  Listo. En unos segundos se abre http://localhost:3000
echo  Panel: http://localhost:3000/admin  -  admin@broxpadel.com / BroxPadel2026!
echo  Para cortar: cerra esta ventana o Ctrl+C.
echo.
start "" cmd /c "timeout /t 30 >nul & start http://localhost:3000"
call npm run dev
goto :eof
:error
echo.
echo  Algo fallo. Si dice que no encuentra Docker: abri Docker Desktop, espera que diga "Engine running" y volve a abrir este archivo.
pause
