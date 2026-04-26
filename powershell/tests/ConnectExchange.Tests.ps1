BeforeAll {
    . (Join-Path $PSScriptRoot '..\commands\connect-exchange.ps1')
}

Describe 'Invoke-GroupsConsoleConnectExchange' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = $null
        $script:statusResult = @{
            state             = 'connected'
            userPrincipalName = 'ccanas@theesa.com'
            tenantId          = '90e9e865-badf-483e-b6ba-440486db0fd6'
        }

        Mock Get-GroupsConsoleExchangeConnectionStatus {
            return $script:statusResult
        }

        Mock Get-ConnectionInformation {
            return @(
                [pscustomobject]@{
                    UserPrincipalName = 'ccanas@theesa.com'
                    ConnectionId      = 'connection-1'
                    TenantId          = '90e9e865-badf-483e-b6ba-440486db0fd6'
                    TokenStatus       = 'Active'
                    TokenExpiryTimeUTC = '2026-04-15T05:20:36Z'
                }
            )
        }
    }

    It 'passes DisableWAM when the module supports it' {
        Mock Get-Command {
            return [pscustomobject]@{
                Parameters = @{
                    DisableWAM = [pscustomobject]@{ Name = 'DisableWAM' }
                }
            }
        } -ParameterFilter { $Name -eq 'Connect-ExchangeOnline' }

        Mock Connect-ExchangeOnline {}

        $result = Invoke-GroupsConsoleConnectExchange -Payload @{
            userPrincipalName = 'ccanas@theesa.com'
        }

        $result.state | Should -Be 'connected'
        Should -Invoke Connect-ExchangeOnline -Times 1 -ParameterFilter {
            $UserPrincipalName -eq 'ccanas@theesa.com' -and
            $ShowBanner -eq $false -and
            $SkipLoadingFormatData -eq $true -and
            $DisableWAM -eq $true
        }
    }

    It 'omits DisableWAM when the module does not support it' {
        Mock Get-Command {
            return [pscustomobject]@{
                Parameters = @{}
            }
        } -ParameterFilter { $Name -eq 'Connect-ExchangeOnline' }

        Mock Connect-ExchangeOnline {}

        $result = Invoke-GroupsConsoleConnectExchange -Payload @{
            userPrincipalName = 'ccanas@theesa.com'
        }

        $result.state | Should -Be 'connected'
        Should -Invoke Connect-ExchangeOnline -Times 1 -ParameterFilter {
            $UserPrincipalName -eq 'ccanas@theesa.com' -and
            $ShowBanner -eq $false -and
            $SkipLoadingFormatData -eq $true -and
            -not $PSBoundParameters.ContainsKey('DisableWAM')
        }
    }
}
