@echo off
title P.Q.P. - Iniciando Servidores...
echo ========================================================
echo    P.Q.P. - PRA QUEM PODE (Iniciando Jogo)
echo ========================================================
echo.
echo Limpando portas e processos antigos (3000, 3001, 5175)...

powershell -NoProfile -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 3000, 3001, 5175 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1

echo Ligando os servidores atualizados...
start "PQP - Jogo Local (3000)" /D "%~dp0jogo-local" cmd /k npm run dev
start "PQP - Backend (3001)" /D "%~dp0backend" cmd /k npm run dev
start "PQP - Online (5175)" /D "%~dp0online" cmd /k npm run dev

echo Aguardando inicializacao dos servidores...
timeout /t 5 >nul

echo Abrindo o jogo no seu navegador...
start "" "http://localhost:5175"
exit
