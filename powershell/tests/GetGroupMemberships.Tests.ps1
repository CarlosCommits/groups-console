BeforeAll {
    function Get-Recipient { param($Identity, $ErrorAction) }
    function Get-DistributionGroup {
        param($ResultSize, [switch]$IncludeManagedByWithDisplayNames, $Filter, $ErrorAction)
    }

    . (Join-Path $PSScriptRoot '..\commands\recipient-identity.ps1')
    . (Join-Path $PSScriptRoot '..\commands\get-group-memberships.ps1')
}

Describe 'Invoke-GroupsConsoleGetGroupMemberships' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = @{ state = 'connected' }
        $script:contactGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        $script:contactObjectId = '11111111-1111-1111-1111-111111111111'
        $script:contactDn = 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,OU=Microsoft Exchange Hosted Organizations,DC=EXAMPLE,DC=COM'

        Mock Get-Recipient {
            [pscustomobject]@{
                Identity                  = 'Example Recipient'
                DisplayName               = 'Example Recipient'
                DistinguishedName         = $script:contactDn
                ExternalDirectoryObjectId = $script:contactObjectId
                Guid                      = $script:contactGuid
                PrimarySmtpAddress        = 'member@example.com'
                RecipientTypeDetails      = 'MailContact'
            }
        }

        Mock Get-DistributionGroup {
            [pscustomobject]@{
                Identity                  = 'Trade'
                DisplayName               = 'Trade'
                Alias                     = 'trade'
                PrimarySmtpAddress        = 'trade@example.com'
                RecipientTypeDetails      = 'MailUniversalDistributionGroup'
                ExternalDirectoryObjectId = '33333333-3333-3333-3333-333333333333'
                ManagedBy                 = @()
            }
        }
    }

    It 'returns the selected contact GUID instead of a shared display name' {
        $result = Invoke-GroupsConsoleGetGroupMemberships -Payload @{
            member = @{
                exchangeIdentity = $script:contactGuid
                objectId = $script:contactObjectId
                primaryEmail = 'member@example.com'
            }
        }

        $result.member.exchangeIdentity | Should -Be $script:contactGuid
        $result.member.exchangeIdentity | Should -Not -Be 'Example Recipient'
        $result.items.Count | Should -Be 1
        Should -Invoke Get-Recipient -Times 1 -Exactly -ParameterFilter {
            $Identity -eq $script:contactGuid
        }
        Should -Invoke Get-DistributionGroup -Times 1 -Exactly -ParameterFilter {
            $Filter -eq "Members -eq '$($script:contactDn)'"
        }
    }
}
