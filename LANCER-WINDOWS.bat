@echo off
chcp 65001 >nul
title Livraison et Ventes - Lancement

rem --- Demande les droits administrateur (necessaire pour le pare-feu) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Demande d'autorisation administrateur...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo  Node.js n'est pas installe. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b
)

echo.
echo  1/3  Autorisation du pare-feu Windows (ports 3000 et 8081)...
netsh advfirewall firewall delete rule name="Livraison Ventes" >nul 2>&1
netsh advfirewall firewall add rule name="Livraison Ventes" dir=in action=allow protocol=TCP localport=3000,8081 >nul
echo       OK

echo  2/3  Demarrage du serveur (nouvelle fenetre)...
start "SERVEUR - ne pas fermer" cmd /k "cd /d "%~dp0serveur" && npm install && npm start"

echo  3/3  Demarrage de l'application (nouvelle fenetre avec le QR code)...
start "APPLICATION - ne pas fermer" cmd /k "cd /d "%~dp0application-mobile" && npm install && npx expo start"

echo.
echo  C'est lance ! Attendez que le QR code apparaisse dans la fenetre APPLICATION,
echo  puis scannez-le avec Expo Go sur le telephone (meme Wi-Fi que l'ordinateur).
echo.
echo  Comptes de demo (mot de passe demo1234) :
echo    Client 0500000010  -  Livreur 0100000020  -  Commercant 0700000001
echo.
pause
