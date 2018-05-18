Param(
  [Parameter(Mandatory=$True,Position=1)]
  [string]$environmentPath, # slug path
  [string]$name = "qubic",
  [string]$path = "C:\Apps\qubic",
  [string]$port = "4000",
  [string]$hostname = "127.0.0.1",
  [string]$mongoUrl = "mongodb://localhost:27017/qubic",
  [string]$nodeEnv = "production",
  [string]$qubicEnv = "DEV",
  [string]$runAs = "USSLONDON\s-ApplicationsDev",
  [string]$runAsPassword,
  [string]$processes = "web",
  [string]$logDir = "C:\Logs",
  [string]$environmentExtra = ""

)
#TODO: make only private variables parameters -- the rest will be in $env: ... can probably just take all the QUBE_ and set those.
##

Write-Verbose "Deploying $($name) on: $env:ComputerName" -verbose

function SetEnv ($name, $value) {
    Write-Verbose "  [$($name)]: $($value)" -verbose
    [Environment]::SetEnvironmentVariable($name, $value, "Machine")
}

#-------------------------------------------
#-- SET ENVIRONMENT VARIABLES
#-------------------------------------------
Write-Verbose "SET ENV VARS - START" -verbose
#[Environment]::SetEnvironmentVariable("QUBE_SSL_PATH", $sslPath, "Machine")
SetEnv "QUBE_MONGODB_URL" $mongoUrl
SetEnv "QUBE_PORT" $port
SetEnv "QUBE_HOST" $hostname

# TODO: Use this when we move to an agent on the box model
#Get-ChildItem -path env:* | Where-Object { $_.Name -like "QUBE:*" } | ForEach-Object {
#    Write-Verbose "Set $($_.Name.Substring(5))=$($_.Value)" -verbose
#    [Environment]::SetEnvironmentVariable($_.Name.Substring(5), $_.Value, "Machine")
#}

Write-Verbose "SET ENV VARS - END" -verbose


$env:Path = "$($path);$($path)\.noroku\bin;$($path)\.noroku\Python27;$path\.noroku\node;$($env:Path);C:\Apps\fu\"

$servs = @{}
function StopNSSM ($x) {
    Write-Verbose "Stopping: $($x.DisplayName)" -verbose
    stop-service $x -force
    $servs[$x.Name] = $x.Name
}

function InstallNSSM ($x, $procs, $dir) {
    Set-Location -Path $dir
    $app = $procs[$x] -split ' ',2
    $exe = $app[0]
    $argsy = $app[1]
    Write-Verbose "Argsy: $argsy"
    #Copy environment variables to the arguments of the process
    Get-ChildItem -path env:* | % {
        $argsy = $argsy.Replace("`$$($_.Name)", $_.Value)
    }
    Write-Verbose "Arguments [$exe]: $argsy" -verbose
    $name = "$($name)-$x"

    If ($servs[$name]) {
        Write-Verbose "Updatting NSSM: $name" -verbose
        nssm set $name Application $exe
        nssm set $name AppParameters $argsy
        $servs.Remove($name)
    } else {
        Write-Verbose "Installing NSSM: $name" -verbose
        nssm install $name $exe $argsy
    }
    nssm set $name Start SERVICE_AUTO_START
    nssm set $name ObjectName $runAs $runAsPassword
    nssm set $name AppDirectory $dir
    nssm set $name AppEnvironmentExtra ('"' + $AppEnvironmentExtra +'"')
    nssm set $name AppStdout "$($logDir)\$($name).log"
    nssm set $name AppStderr "$($logDir)\$($name).log"
    nssm set $name AppRotateFiles 1
    nssm set $name AppRotateOnline 1
    nssm set $name AppRotateBytes 10000000
    start-service $name
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
function Expand-Archive
{
    param([string]$zipfile, [string]$dest)

    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipfile, $dest)
}

function Get-ProcfileContent ($filePath) {
  $procs = @{}
  switch -regex -file $filePath
  {
    "([^:]+)\s*:\s*(.*)"
    {
        $name,$value = $matches[1..2]
        $procs[$name] = $value
    }
  }
  return $procs
}

$AppEnvironmentExtra= "NODE_ENV=$($nodeEnv)`nPATH=$($env:Path)`n$($environmentExtra)"

Write-Verbose "Procs: $processes" -verbose
Write-Verbose "Env: $AppEnvironmentExtra" -verbose

# Stop old services
Get-Service "$($name)*" | Foreach { StopNSSM $_ }
Write-Verbose "Stopping Website Qubic"
Stop-Website Qubic
Start-Sleep 3
if (Test-Path $path) {
    Write-Verbose "Removing Old Files: $path" -verbose
    Try {
      Remove-Item $path -recurse 
    } Catch {
      Write-Verbose "Could not fully remove $path"
    }
}
Write-Verbose "Exapanding New Files: $environmentPath to $path" -verbose
Expand-Archive $environmentPath $path
Write-Verbose "Replacing Template web.config" -verbose
(Get-Content (Join-Path $path "public\web.config.template")).replace("{{QUBE_PORT}}", $port) | Set-Content (Join-Path $path "public\web.config")
Write-Verbose "Starting Website Qubic"
Start-Website Qubic
# TODO: create any directories you might need
#$Config.Dirs.GetEnumerator() | Foreach { if (Test-Path $_.Value) {  } else { New-Item -ItemType Directory -path $_.Value } }
$oldpath = Get-Location
$procs = Get-ProcfileContent (Join-Path $path "Procfile")
# Install processes
$processes -split ',' | Foreach { InstallNSSM $_ $procs $path }


$servs.GetEnumerator() | % { 
    Write-Verbose "Disabling: $($_.Name)" -verbose
    #probably better marking them as disabled
    nssm set $_.Name Start SERVICE_DISABLED
    #nssm remove $_.Name confirm
}

Set-Location $oldpath