@echo off
title P.Q.P. - Painel Administrativo
echo ========================================================
echo    P.Q.P. - PAINEL ADMINISTRATIVO (Dono do Jogo)
echo ========================================================
echo.
echo Abrindo o painel admin...
start "PQP - Admin (Porta 5174)" /D "%~dp0admin" cmd /k npm run dev

timeout /t 3 >nul
echo Abrindo o painel no seu navegador...
start "" "http://localhost:5174"
exit
