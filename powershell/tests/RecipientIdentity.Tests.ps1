BeforeAll {
    . (Join-Path $PSScriptRoot '..\commands\recipient-identity.ps1')
}

Describe 'Get-GroupsConsoleRecipientWriteIdentity' {
    It 'prefers the Exchange GUID over weaker identity values' {
        $recipient = [pscustomobject]@{
            Guid              = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
            DistinguishedName = 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,DC=EXAMPLE,DC=COM'
            Identity          = 'Example Recipient'
        }

        Get-GroupsConsoleRecipientWriteIdentity -Recipient $recipient |
            Should -Be 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    }

    It 'falls back to the distinguished name when no GUID is available' {
        $recipient = [pscustomobject]@{
            DistinguishedName = 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,DC=EXAMPLE,DC=COM'
            Identity          = 'Example Recipient'
        }

        Get-GroupsConsoleRecipientWriteIdentity -Recipient $recipient |
            Should -Be 'CN=Example Contact,OU=exampletenant.onmicrosoft.com,DC=EXAMPLE,DC=COM'
    }

    It 'uses Identity only when no stronger Exchange identity is available' {
        $recipient = [pscustomobject]@{
            Identity = 'Unique Recipient Identity'
        }

        Get-GroupsConsoleRecipientWriteIdentity -Recipient $recipient |
            Should -Be 'Unique Recipient Identity'
    }

    It 'rejects recipients without a usable write identity' {
        { Get-GroupsConsoleRecipientWriteIdentity -Recipient ([pscustomobject]@{}) } |
            Should -Throw 'The Exchange recipient does not expose a usable write identity.'
    }
}
