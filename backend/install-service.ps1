# One-click setup: runs campaign sender every minute automatically
$taskName = "OneMail-SendCampaigns"
$scriptPath = "$PSScriptRoot\send-campaigns.vbs"

# Create VBS to run silently
@"
Set WShell = CreateObject("WScript.Shell")
WShell.Run "cmd /c `"cd /d $PSScriptRoot && node run.js`"", 0, False
"@ | Out-File -FilePath $scriptPath -Encoding ASCII

# Create scheduled task (every minute)
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 365)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force

Write-Host "✅ OneMail Sender installed! Runs every minute automatically."
Write-Host "   Campaigns will be sent automatically without any action."
