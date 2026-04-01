param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
)

$ErrorActionPreference = 'Stop'

switch ($CommandName) {
    'bootstrap.inspectEnvironment' {
        $module = Get-Module -ListAvailable -Name ExchangeOnlineManagement |
            Sort-Object Version -Descending |
            Select-Object -First 1 Name, Version, ModuleBase

        $moduleImport = $null

        if ($module) {
            try {
                $importedModule = Import-Module ExchangeOnlineManagement -PassThru -ErrorAction Stop |
                    Select-Object -First 1 Name, Version, ModuleBase

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

        $result = [pscustomobject]@{
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
                    name       = $module.Name
                    version    = $module.Version.ToString()
                    moduleBase = $module.ModuleBase
                    import     = $moduleImport
                }
            }
            else {
                $null
            }
        }

        $result | ConvertTo-Json -Compress -Depth 6
        exit 0
    }

    default {
        Write-Error "Unknown RAD-app worker command: $CommandName"
        exit 1
    }
}
