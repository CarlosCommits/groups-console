BeforeAll {
    function Get-DistributionGroup { param($Identity, $ErrorAction) }
    function Get-DistributionGroupMember { param($Identity, $ResultSize) }
    function Remove-DistributionGroupMember {
        param($Identity, $Member, [switch]$BypassSecurityGroupManagerCheck, [switch]$Confirm, $ErrorAction)
    }

    . (Join-Path $PSScriptRoot '..\commands\remove-group-member.ps1')
}

Describe 'Invoke-GroupsConsoleRemoveGroupMembers' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = @{ state = 'connected' }
        $script:memberReadCount = 0
        $script:contactObjectId = '11111111-1111-1111-1111-111111111111'
        $script:guestObjectId = '22222222-2222-2222-2222-222222222222'
        $script:contactGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        $script:guestGuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

        $script:contact = [pscustomobject]@{
            Identity                  = 'Example Recipient'
            DistinguishedName         = 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,DC=EXAMPLE,DC=COM'
            ExternalDirectoryObjectId = $script:contactObjectId
            Guid                      = $script:contactGuid
            PrimarySmtpAddress        = 'member@example.com'
            RecipientTypeDetails      = 'MailContact'
        }
        $script:guest = [pscustomobject]@{
            Identity                  = 'Example Recipient'
            DistinguishedName         = 'CN=Example Guest,OU=exampletenant.onmicrosoft.com,DC=EXAMPLE,DC=COM'
            ExternalDirectoryObjectId = $script:guestObjectId
            Guid                      = $script:guestGuid
            PrimarySmtpAddress        = 'member@example.com'
            RecipientTypeDetails      = 'GuestMailUser'
        }

        Mock Get-DistributionGroup {
            [pscustomobject]@{
                Identity                  = 'Trade'
                RecipientTypeDetails      = 'MailUniversalDistributionGroup'
                ExternalDirectoryObjectId = '33333333-3333-3333-3333-333333333333'
            }
        }
        Mock Remove-DistributionGroupMember { }
    }

    It 'removes the selected contact without cross-matching a same-email guest' {
        Mock Get-DistributionGroupMember {
            $script:memberReadCount++
            if ($script:memberReadCount -eq 1) {
                return @($script:contact, $script:guest)
            }

            return @($script:guest)
        }

        $result = Invoke-GroupsConsoleRemoveGroupMembers -Payload @{
            group = @{
                exchangeIdentity = 'Trade'
                objectId = '33333333-3333-3333-3333-333333333333'
                groupKind = 'distributionList'
            }
            members = @(
                @{
                    exchangeIdentity = $script:contactGuid
                    objectId = $script:contactObjectId
                    primaryEmail = 'member@example.com'
                }
            )
            verify = $true
        }

        $result.summary.removed | Should -Be 1
        $result.verification.verifiedRemoved | Should -Be 1
        $result.items[0].member.exchangeIdentity | Should -Be $script:contactGuid
        Should -Invoke Remove-DistributionGroupMember -Times 1 -Exactly -ParameterFilter {
            $Identity -eq 'Trade' -and $Member -eq $script:contactGuid
        }
    }

    It 'removes the selected guest without cross-matching a same-email contact' {
        Mock Get-DistributionGroupMember {
            $script:memberReadCount++
            if ($script:memberReadCount -eq 1) {
                return @($script:contact, $script:guest)
            }

            return @($script:contact)
        }

        $result = Invoke-GroupsConsoleRemoveGroupMembers -Payload @{
            group = @{
                exchangeIdentity = 'Trade'
                objectId = '33333333-3333-3333-3333-333333333333'
                groupKind = 'distributionList'
            }
            members = @(
                @{
                    exchangeIdentity = $script:guestGuid
                    objectId = $script:guestObjectId
                    primaryEmail = 'member@example.com'
                }
            )
            verify = $true
        }

        $result.summary.removed | Should -Be 1
        $result.verification.verifiedRemoved | Should -Be 1
        $result.items[0].member.exchangeIdentity | Should -Be $script:guestGuid
        Should -Invoke Remove-DistributionGroupMember -Times 1 -Exactly -ParameterFilter {
            $Identity -eq 'Trade' -and $Member -eq $script:guestGuid
        }
    }
}
