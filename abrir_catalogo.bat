@echo off
title Catalogo de Balcao - Interruptores e Capas
echo ========================================================
echo   INICIANDO CATALOGO INTERNO DE BALCAO (OFFLINE-FIRST)
echo ========================================================
echo.
echo Abrindo navegador em http://localhost:1420 ...
start http://localhost:1420/
echo.
bun run dev
