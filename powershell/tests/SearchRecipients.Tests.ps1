BeforeAll {
    function Get-Recipient { param($ResultSize, $Filter) }

    . (Join-Path $PSScriptRoot '..\commands\recipient-identity.ps1')
    . (Join-Path $PSScriptRoot '..\commands\search-recipients.ps1')
}

Describe 'Invoke-GroupsConsoleSearchRecipients directory identity' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = @{ state = 'connected' }
        $script:recipient = [pscustomobject]@{
            Identity                  = 'Example Guest'
            DisplayName               = 'Example Guest'
            Guid                      = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
            ExternalDirectoryObjectId = '11111111-1111-1111-1111-111111111111'
            PrimarySmtpAddress        = 'guest@example.com'
            RecipientTypeDetails      = 'GuestMailUser'
        }
        Mock Get-Recipient { $script:recipient }
    }

    It 'returns the Entra directory ID without replacing the Exchange write GUID' {
        $result = Invoke-GroupsConsoleSearchRecipients -Payload @{ query = 'Example'; types = @('guestMailUser') }

        $result.items.Count | Should -Be 1
        $result.items[0].externalDirectoryObjectId | Should -Be $script:recipient.ExternalDirectoryObjectId
        $result.items[0].objectId | Should -Be $script:recipient.ExternalDirectoryObjectId
        $result.items[0].exchangeIdentity | Should -Be $script:recipient.Guid
    }

    It 'does not claim the fallback Exchange GUID is an Entra directory ID' {
        $script:recipient.PSObject.Properties.Remove('ExternalDirectoryObjectId')
        $result = Invoke-GroupsConsoleSearchRecipients -Payload @{ query = 'Example'; types = @('guestMailUser') }

        $result.items[0].ContainsKey('externalDirectoryObjectId') | Should -BeTrue
        $result.items[0].externalDirectoryObjectId | Should -BeNullOrEmpty
        $result.items[0].objectId | Should -Be $script:recipient.Guid
        $result.items[0].exchangeIdentity | Should -Be $script:recipient.Guid
    }
}
