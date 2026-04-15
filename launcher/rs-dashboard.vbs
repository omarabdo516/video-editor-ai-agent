' RS Reels Dashboard launcher — hidden-window variant.
'
' This runs rs-dashboard.cmd with WindowStyle=0 (hidden) so the
' desktop shortcut opens the Dashboard in the browser without
' showing a terminal window. The tradeoff: you can't Ctrl+C to stop
' it — the dashboard keeps running in the background until you kill
' it via Task Manager OR close the browser tab AND stop the related
' node.exe processes.
'
' For a visible terminal that you can stop with Ctrl+C, use
' rs-dashboard.cmd directly instead.

Set objShell = CreateObject("WScript.Shell")
Set objFso = CreateObject("Scripting.FileSystemObject")

' Resolve the absolute path to rs-dashboard.cmd next to this script.
scriptDir = objFso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = objFso.BuildPath(scriptDir, "rs-dashboard.cmd")

' Run with WindowStyle=0 (hidden), don't wait for completion.
objShell.Run Chr(34) & cmdPath & Chr(34), 0, False
