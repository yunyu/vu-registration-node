**POWERSHELL AUTOMATION SCRIPT**

This script lets you pre-program your environment variables and class choices, and runs the actual registration program until it succeeds. Ideally, you could start the script up and go get a cup of coffee - which you'll likely need, since registration is at 8:00 am...

You'll need to fill out these fields:

Path
==
The path to the script installation location should be typed in at the top of the script (Where it currently says ".\vu-registration-node").
Alternatively, open your PowerShell window in the vu-registation-node directly, and delete the *cd .\vu-registration-node ....* line altogether

Username
==
Replace the *username* string corresponding to $env:VUNET_ID with your own VuNet ID. Don't use your Commodore ID!

Password
==
Replace the *password* string corresponding to $env:VUNET_PW with your own VuNet password.

TimeCheck
==
This is the variable controlling registration time. Since the time is arbitrary, you can theoretically start up the script at any time on a given day, and have it idle until the registration time is reached. At this point, the actual requests will start being sent to the server.

Syntax:
```powershell
$TimeCheck = "HH:MM:SS"
```
By default, the start time is set to 2 seconds past 8:00 am. You can set this to any time you choose, as long as it is later than the current time.

Timeout
==
The script should NOT run indefinitely. Therefore, a timeout value is used to specify how many minutes should elapse before the program terminates.
You can use these flags to customize your timeout value:
```powershell
$timeout = new-timespan -Hour HH $timeout = new-timespan
```
By default, this timeout is set to 25 minutes.

Classlist
==
Populate your classlist the way it's described in the README.