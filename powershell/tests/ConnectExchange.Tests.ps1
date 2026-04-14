BeforeAll {
    . (Join-Path $PSScriptRoot '..\commands\connect-exchange.ps1')
}

Describe 'Invoke-RadAppConnectExchange' {
    BeforeEach {
        $script:RadAppExchangeConnectionContext = $null
        $script:statusResult = @{
            state             = 'connected'
            userPrincipalName = 'ccanas@example.com'
            tenantId          = '11111111-1111-1111-1111-111111111111'
        }

        Mock Get-RadAppExchangeConnectionStatus {
            return $script:statusResult
        }

        Mock Get-ConnectionInformation {
            return @(
                [pscustomobject]@{
                    UserPrincipalName = 'ccanas@example.com'
                    ConnectionId      = 'connection-1'
                    TenantId          = '11111111-1111-1111-1111-111111111111'
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

        $result = Invoke-RadAppConnectExchange -Payload @{
            userPrincipalName = 'ccanas@example.com'
        }

        $result.state | Should -Be 'connected'
        Should -Invoke Connect-ExchangeOnline -Times 1 -ParameterFilter {
            $UserPrincipalName -eq 'ccanas@example.com' -and
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

        $result = Invoke-RadAppConnectExchange -Payload @{
            userPrincipalName = 'ccanas@example.com'
        }

        $result.state | Should -Be 'connected'
        Should -Invoke Connect-ExchangeOnline -Times 1 -ParameterFilter {
            $UserPrincipalName -eq 'ccanas@example.com' -and
            $ShowBanner -eq $false -and
            $SkipLoadingFormatData -eq $true -and
            -not $PSBoundParameters.ContainsKey('DisableWAM')
        }
    }
}
