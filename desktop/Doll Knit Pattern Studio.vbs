' Opens Doll Knit Pattern Studio on this computer.
' 1. gets the latest version from GitHub (skipped quietly when offline)
' 2. starts the small local server in the background (stays running until you sign out)
' 3. opens the app in its own window
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
repo = fso.GetParentFolderName(here)

sh.Run "cmd /c cd /d """ & repo & """ && git pull --ff-only --quiet", 0, True
sh.Run "cmd /c node """ & here & "\serve.mjs""", 0, False
WScript.Sleep 800

url = "http://localhost:5196/index.html"
chrome = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
chromeUser = sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe"
edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If fso.FileExists(chrome) Then
  sh.Run """" & chrome & """ --app=" & url, 1, False
ElseIf fso.FileExists(chromeUser) Then
  sh.Run """" & chromeUser & """ --app=" & url, 1, False
ElseIf fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=" & url, 1, False
Else
  sh.Run url, 1, False
End If
