@echo off
title Stop VMC Server
color 0c
echo ===================================================
echo             STOPPING VMC BACKGROUND SERVER
echo ===================================================
echo.
echo Searching for VMC server active process on port 8000...
echo.

powershell -ExecutionPolicy Bypass -NoProfile -Command ^
  "try { ^
     $conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue; ^
     if ($conn) { ^
       $pidToKill = $conn.OwningProcess; ^
       Stop-Process -Id $pidToKill -Force; ^
       Write-Host '[SUCCESS] VMC Server stopped successfully!' -ForegroundColor Green; ^
     } else { ^
       Write-Host '[INFO] No VMC Server is currently running on port 8000.' -ForegroundColor Yellow; ^
     } ^
   } catch { ^
     Write-Host '[ERROR] Failed to stop the process: ' $_.Exception.Message -ForegroundColor Red; ^
   }"

echo.
echo Press any key to exit.
pause > nul
