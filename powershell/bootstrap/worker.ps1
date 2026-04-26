param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
)

$ErrorActionPreference = 'Stop'

function Get-RadAppEnvironmentProbe {
    $module = Get-Module -ListAvailable -Name ExchangeOnlineManagement |
        Sort-Object Version -Descending |
        Select-Object -First 1 Name, Version, ModuleBase

    $moduleImport = $null
    $commandChecks = @{
        connectExchangeOnline    = $false
        disconnectExchangeOnline = $false
        getConnectionInformation = $false
    }

    if ($module) {
        try {
            $importedModule = Import-Module ExchangeOnlineManagement -PassThru -ErrorAction Stop |
                Select-Object -First 1 Name, Version, ModuleBase

            $availableCommandNames = @(Get-Command -Module ExchangeOnlineManagement -Name Connect-ExchangeOnline, Disconnect-ExchangeOnline, Get-ConnectionInformation -ErrorAction SilentlyContinue |
                    Select-Object -ExpandProperty Name)

            $commandChecks = @{
                connectExchangeOnline    = $availableCommandNames -contains 'Connect-ExchangeOnline'
                disconnectExchangeOnline = $availableCommandNames -contains 'Disconnect-ExchangeOnline'
                getConnectionInformation = $availableCommandNames -contains 'Get-ConnectionInformation'
            }

            $moduleImport = @{
                importable = $true
                name       = $importedModule.Name
                version    = $importedModule.Version.ToString()
                moduleBase = $importedModule.ModuleBase
            }
        }
        catch {
            $moduleImport = @{
                importable = $false
                error      = $_.Exception.Message
            }
        }
        finally {
            Remove-Module ExchangeOnlineManagement -Force -ErrorAction SilentlyContinue
        }
    }

    return [pscustomobject]@{
        psVersion                = $PSVersionTable.PSVersion.ToString()
        psEdition                = $PSVersionTable.PSEdition
        executionPolicy          = (Get-ExecutionPolicy).ToString()
        executionPolicies        = @(Get-ExecutionPolicy -List | ForEach-Object {
                @{
                    scope           = $_.Scope.ToString()
                    executionPolicy = $_.ExecutionPolicy.ToString()
                }
            })
        exchangeOnlineManagement = if ($module) {
            @{
                name              = $module.Name
                version           = $module.Version.ToString()
                moduleBase        = $module.ModuleBase
                commandChecks     = $commandChecks
                import            = $moduleImport
            }
        }
        else {
            $null
        }
    }
}

switch ($CommandName) {
    'bootstrap.inspectEnvironment' {
        $result = Get-RadAppEnvironmentProbe

        $result | ConvertTo-Json -Compress -Depth 6
        exit 0
    }

    'exchange.getCapabilities' {
        $probe = Get-RadAppEnvironmentProbe
        $exchangeModule = $probe.exchangeOnlineManagement
        $status = 'missing'
        $detail = 'ExchangeOnlineManagement is not installed for the selected PowerShell runtime.'

        if ($null -ne $exchangeModule) {
            $hasRequiredCommands = $exchangeModule.commandChecks.connectExchangeOnline -and $exchangeModule.commandChecks.disconnectExchangeOnline -and $exchangeModule.commandChecks.getConnectionInformation

            if ($exchangeModule.import.importable -eq $true -and $hasRequiredCommands) {
                $status = 'ready'
                $detail = "ExchangeOnlineManagement $($exchangeModule.version) is importable and ready for a future connection flow."
            }
            elseif ($exchangeModule.import.importable -eq $true) {
                $status = 'warning'
                $detail = "ExchangeOnlineManagement $($exchangeModule.version) imports successfully, but the expected pre-auth cmdlet subset is incomplete."
            }
            else {
                $status = 'warning'
                $detail = "ExchangeOnlineManagement $($exchangeModule.version) is installed but not importable: $($exchangeModule.import.error)"
            }
        }

        $result = [pscustomobject]@{
            status                   = $status
            detail                   = $detail
            psVersion                = $probe.psVersion
            psEdition                = $probe.psEdition
            executionPolicy          = $probe.executionPolicy
            exchangeOnlineManagement = $exchangeModule
        }

        $result | ConvertTo-Json -Compress -Depth 6
        exit 0
    }

    'exchange.installModule' {
        $existingModule = Get-Module -ListAvailable -Name ExchangeOnlineManagement |
            Sort-Object Version -Descending |
            Select-Object -First 1 Name, Version, ModuleBase

        if ($null -eq $existingModule) {
            $provider = Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue
            if ($null -eq $provider) {
                Install-PackageProvider -Name NuGet -Scope CurrentUser -Force -ErrorAction Stop | Out-Null
            }

            Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
        }

        $probe = Get-RadAppEnvironmentProbe
        $exchangeModule = $probe.exchangeOnlineManagement

        if ($null -eq $exchangeModule) {
            throw 'ExchangeOnlineManagement installation completed, but the module was not found afterward.'
        }

        $hasRequiredCommands = $exchangeModule.commandChecks.connectExchangeOnline -and $exchangeModule.commandChecks.disconnectExchangeOnline -and $exchangeModule.commandChecks.getConnectionInformation
        if ($exchangeModule.import.importable -ne $true -or -not $hasRequiredCommands) {
            throw "ExchangeOnlineManagement was installed but is not ready: $($exchangeModule.import.error)"
        }

        $result = [pscustomobject]@{
            status                   = 'ready'
            detail                   = "ExchangeOnlineManagement $($exchangeModule.version) is installed and importable."
            psVersion                = $probe.psVersion
            psEdition                = $probe.psEdition
            executionPolicy          = $probe.executionPolicy
            exchangeOnlineManagement = $exchangeModule
        }

        $result | ConvertTo-Json -Compress -Depth 6
        exit 0
    }

    default {
        Write-Error "Unknown Groups Console worker command: $CommandName"
        exit 1
    }
}
