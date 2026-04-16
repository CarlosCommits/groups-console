BeforeAll {
    . (Join-Path $PSScriptRoot '..\commands\lookup-recipient-ownership.ps1')
    . (Join-Path $PSScriptRoot '..\commands\get-recipient-details.ps1')
}

Describe 'Invoke-RadAppGetRecipientDetails' {
    BeforeEach {
        $script:RadAppExchangeConnectionContext = @{ state = 'connected' }

        Mock Get-Recipient {
            return [pscustomobject]@{
                Identity                  = 'jane.external@example.com'
                RecipientTypeDetails      = 'MailUser'
                DisplayName               = 'Jane External'
                Alias                     = 'jexternal'
                ExternalDirectoryObjectId = 'recipient-2'
            }
        }

        Mock Get-MailUser {
            return [pscustomobject]@{
                PrimarySmtpAddress  = 'jane@yourcompany.com'
                ExternalEmailAddress = 'SMTP:Jane@Gmail.com'
                UserPrincipalName   = 'jane_external#EXT#@tenant.onmicrosoft.com'
            }
        }

        Mock Get-User {
            return [pscustomobject]@{
                Company           = 'Example Corp'
                FirstName         = 'Jane'
                LastName          = 'External'
                Title             = 'Director'
                Department        = 'Operations'
                Phone             = '+1 555-0100'
                Office            = 'HQ-201'
                UserPrincipalName = 'jane_external#EXT#@tenant.onmicrosoft.com'
            }
        }
    }

    It 'keeps primary email and normalizes the external target for mail users' {
        $result = Invoke-RadAppGetRecipientDetails -Payload @{
            exchangeIdentity = 'jane.external@example.com'
        }

        $result.recipient.recipientType | Should -Be 'mailUser'
        $result.recipient.primaryEmail | Should -Be 'jane@yourcompany.com'
        $result.recipient.externalEmailAddress | Should -Be 'jane@gmail.com'
        $result.recipient.externalEmailAddress | Should -Not -Be 'SMTP:Jane@Gmail.com'

        Should -Invoke Get-Recipient -Times 1
        Should -Invoke Get-MailUser -Times 1
        Should -Invoke Get-User -Times 1
    }
}
