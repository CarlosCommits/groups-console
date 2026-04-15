function Invoke-RadAppGetContactDetails {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before reading contact details.'
    }

    $exchangeIdentity = if ($Payload.ContainsKey('exchangeIdentity')) { [string]$Payload.exchangeIdentity } else { '' }
    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'exchangeIdentity is required for contacts.getDetails.'
    }

    $mailContact = Get-MailContact -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1
    $contact = Get-Contact -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    $objectId = if ($mailContact.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $mailContact.ExternalDirectoryObjectId) {
        [string]$mailContact.ExternalDirectoryObjectId
    }
    elseif ($mailContact.PSObject.Properties.Name -contains 'Guid' -and $mailContact.Guid) {
        [string]$mailContact.Guid
    }
    else {
        $null
    }

    $primaryEmail = if ($mailContact.ExternalEmailAddress) {
        Get-RadAppNormalizedExternalEmailAddress -MailContact $mailContact
    }
    elseif ($mailContact.PrimarySmtpAddress) {
        [string]$mailContact.PrimarySmtpAddress
    }
    else {
        $null
    }

    return @{
        contact = @{
            exchangeIdentity = [string]$mailContact.Identity
            objectId = $objectId
            primaryEmail = $primaryEmail
            displayName = if ($mailContact.DisplayName) { [string]$mailContact.DisplayName } else { [string]$mailContact.Identity }
            alias = if ($mailContact.Alias) { [string]$mailContact.Alias } else { $null }
            companyName = if ($contact.Company) { [string]$contact.Company } else { $null }
            firstName = if ($contact.FirstName) { [string]$contact.FirstName } else { $null }
            lastName = if ($contact.LastName) { [string]$contact.LastName } else { $null }
            title = if ($contact.Title) { [string]$contact.Title } else { $null }
            department = if ($contact.Department) { [string]$contact.Department } else { $null }
            phone = if ($contact.Phone) { [string]$contact.Phone } else { $null }
            office = if ($contact.Office) { [string]$contact.Office } else { $null }
            streetAddress = if ($contact.StreetAddress) { [string]$contact.StreetAddress } else { $null }
            city = if ($contact.City) { [string]$contact.City } else { $null }
            stateOrProvince = if ($contact.StateOrProvince) { [string]$contact.StateOrProvince } else { $null }
            postalCode = if ($contact.PostalCode) { [string]$contact.PostalCode } else { $null }
            countryOrRegion = if ($contact.CountryOrRegion) { [string]$contact.CountryOrRegion } else { $null }
            recipientTypeDetails = 'MailContact'
        }
    }
}
