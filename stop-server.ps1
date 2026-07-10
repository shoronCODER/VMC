# Stop VMC processes
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object { $_.CommandLine -like "*server.ps1*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
}

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*mail-server.js*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
}

$existingProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    foreach ($pid in $existingProcess) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}
