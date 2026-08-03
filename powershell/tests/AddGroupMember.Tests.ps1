function Get-DistributionGroup { param($Identity, $ErrorAction) }
function Get-DistributionGroupMember { param($Identity, $ResultSize) }
function Add-DistributionGroupMember { param($Identity, $Member, [switch]$BypassSecurityGroupManagerCheck, [switch]$Confirm, $ErrorAction) }

. (Join-Path $PSScriptRoot '..\commands\add-group-member.ps1')

Describe 'Invoke-GroupsConsoleAddGroupMembers' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = @{ state = 'connected' }
        $script:memberReadCount = 0
        $script:contactObjectId = '11111111-1111-1111-1111-111111111111'
        $script:guestObjectId = '22222222-2222-2222-2222-222222222222'
        $script:contactGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        $script:contactDn = 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,OU=Microsoft Exchange Hosted Organizations,DC=EXAMPLE,DC=COM'

        $script:contact = [pscustomobject]@{
            Identity                  = 'Example Recipient'
            DistinguishedName         = $script:contactDn
            ExternalDirectoryObjectId = $script:contactObjectId
            Guid                      = $script:contactGuid
            PrimarySmtpAddress        = 'member@example.com'
            RecipientTypeDetails      = 'MailContact'
        }
        $script:guest = [pscustomobject]@{
            Identity                  = 'Example Recipient'
            DistinguishedName         = 'CN=Example Guest,OU=exampletenant.onmicrosoft.com,OU=Microsoft Exchange Hosted Organizations,DC=EXAMPLE,DC=COM'
            ExternalDirectoryObjectId = $script:guestObjectId
            Guid                      = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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

        Mock Get-DistributionGroupMember {
            $script:memberReadCount++
            if ($script:memberReadCount -eq 1) {
                return @($script:guest)
            }

            return @($script:guest, $script:contact)
        }

        Mock Add-DistributionGroupMember { }
    }

    It 'adds the selected contact and keeps a same-email existing guest as a separate member' {
        $result = Invoke-GroupsConsoleAddGroupMembers -Payload @{
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
                },
                @{
                    exchangeIdentity = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
                    objectId = $script:guestObjectId
                    primaryEmail = 'member@example.com'
                }
            )
            verify = $true
        }

        $result.summary.added | Should Be 1
        $result.summary.alreadyMember | Should Be 1
        $result.verification.verifiedAdded | Should Be 1
        $result.items[0].member.exchangeIdentity | Should Be $script:contactGuid
        Assert-MockCalled Add-DistributionGroupMember -Times 1 -ParameterFilter {
            $Identity -eq 'Trade' -and $Member -eq $script:contactGuid
        }
    }
}
