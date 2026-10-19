:: webapp/iniciar-webapp.bat
:: Inicia o servidor de desenvolvimento do projeto webapp
:: Para executar o projeto web, execute "npm start" no terminal
:: Para executar este 
:: =====================================================================

@echo off
cd /d "%~dp0"
call npm run dev
