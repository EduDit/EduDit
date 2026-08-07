' Launch DitDash (web version) locally with no visible console window.
' Double-click this instead of run_web.bat to avoid the console flash.
Option Explicit

Dim fso, shell, scriptDir, venvPythonw, pythonwPath, port, url
Dim appData, flagPath, iconPath

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
port = "8000"
url = "http://localhost:" & port
iconPath = scriptDir & "\assets\icon.ico"

' --- One-time setup: create Desktop + Start Menu shortcuts automatically ---
appData = shell.ExpandEnvironmentStrings("%APPDATA%") & "\DitDash"
flagPath = appData & "\shortcut_created.flag"

If Not fso.FileExists(flagPath) Then
    If Not fso.FolderExists(appData) Then fso.CreateFolder(appData)
    fso.CreateTextFile(flagPath, True).Close ' only do this once

    CreateShortcut shell.SpecialFolders("Desktop") & "\DitDash.lnk"
    CreateShortcut shell.SpecialFolders("Programs") & "\DitDash.lnk"
End If

venvPythonw = scriptDir & "\.venv\Scripts\pythonw.exe"
If fso.FileExists(venvPythonw) Then
    pythonwPath = venvPythonw
Else
    pythonwPath = "pythonw.exe"
End If

' Start the local server fully hidden (window style 0), don't wait for it.
shell.Run """" & pythonwPath & """ """ & scriptDir & "\web\serve.py"" " & port, 0, False

' Give the server a moment to come up, then open the browser.
WScript.Sleep 800
shell.Run url, 1, False

Sub CreateShortcut(path)
    Dim link
    Set link = shell.CreateShortcut(path)
    link.TargetPath = shell.ExpandEnvironmentStrings("%windir%\System32\wscript.exe")
    link.Arguments = """" & scriptDir & "\run_web.vbs"""
    link.WorkingDirectory = scriptDir
    link.Description = "Launch DitDash (web)"
    If fso.FileExists(iconPath) Then link.IconLocation = iconPath
    link.Save
End Sub
