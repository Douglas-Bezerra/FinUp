@echo off
cd /d "%~dp0"

if not exist "webapp\.env" (
    echo ERRO: webapp\.env nao existe.
    echo Crie esse arquivo a partir de webapp\.env.example.
    exit /b 1
)

findstr /C:"VITE_USE_DATA_CONNECT_EMULATOR=true" "webapp\.env" >nul
if errorlevel 1 (
    echo ERRO: defina VITE_USE_DATA_CONNECT_EMULATOR=true em webapp\.env antes de iniciar o emulador.
    exit /b 1
)

call firebase emulators:start --only dataconnect
exit /b %errorlevel%
