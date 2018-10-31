cd .\vu-registration-node
$env:VUNET_ID = "username"

$env:VUNET_PW = "password"

node vu-registration.js savecookies

$TimeCheck = "08:00:02"

$TimeNow = Get-Date -format HH:mm:ss

$timeout = new-timespan -Hour 0 -Minutes 25

$sw = [diagnostics.stopwatch]::StartNew()

while ($sw.elapsed -lt $timeout){
    
    if ($TimeNow -ge $TimeCheck){
    
        node vu-registration.js register 0000:true, 0000:true
    
        Write-Host "Success!"
    
        break
    }
    
    $TimeNow = Get-Date -format HH:mm:ss
    
    Write-Host "Time Now is:" + $TimeNow
    
    start-sleep -seconds 1
}
 
write-host "Timed out"
pause