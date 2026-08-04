BeforeAll {
    function Get-MailContact { }
    function Set-Contact { }
    function Get-Contact { }

    . (Join-Path $PSScriptRoot '..\commands\lookup-recipient-ownership.ps1')
    . (Join-Path $PSScriptRoot '..\commands\update-contact-company.ps1')
}

Describe 'Invoke-GroupsConsoleUpdateContactCompany' {
    BeforeEach {
        $script:GroupsConsoleExchangeConnectionContext = @{ state = 'connected' }

        Mock Get-MailContact {
            return [pscustomobject]@{
                Identity                  = 'Jane External'
                ExternalDirectoryObjectId = 'contact-1'
                ExternalEmailAddress      = 'SMTP:jane.personal@example.com'
                PrimarySmtpAddress        = $null
            }
        }

        Mock Set-Contact {
            return $null
        }

        Mock Get-Contact {
            return [pscustomobject]@{
                Company = 'New Company'
            }
        }
    }

    It 'normalizes the returned external email address after updating company' {
        $result = Invoke-GroupsConsoleUpdateContactCompany -Payload @{
            exchangeIdentity = 'Jane External'
            companyName = 'New Company'
        }

        $result.contact.primaryEmail | Should -Be 'jane.personal@example.com'
        $result.contact.primaryEmail | Should -Not -Be 'SMTP:jane.personal@example.com'
        $result.verification.companyApplied | Should -BeTrue

        Should -Invoke Get-MailContact -Times 1 -Exactly
        Should -Invoke Set-Contact -Times 1 -Exactly
        Should -Invoke Get-Contact -Times 1 -Exactly
    }

    It 'clears the company value when the requested company is blank' {
        Mock Get-Contact {
            return [pscustomobject]@{
                Company = $null
            }
        }

        $result = Invoke-GroupsConsoleUpdateContactCompany -Payload @{
            exchangeIdentity = 'Jane External'
            companyName = ''
        }

        $result.contact.companyName | Should -BeNullOrEmpty
        $result.verification.companyApplied | Should -BeTrue

        Should -Invoke Set-Contact -Times 1 -Exactly -ParameterFilter { $Company -eq $null }
    }
}
