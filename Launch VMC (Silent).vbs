Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
currentDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Launch the PowerShell server in hidden mode (0 = Hidden window, False = Don't wait for completion)
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & currentDir & "\server.ps1""", 0, False

' Wait 1 second for the server to start, then open the browser
Wscript.Sleep 1000
WshShell.Run "cmd.exe /c start http://localhost:8000/", 0, False
