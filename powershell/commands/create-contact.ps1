function Invoke-RadAppCreateContact {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before creating contacts.'
    }

    $displayName = [string]$Payload.displayName
    $alias = [string]$Payload.alias
    $firstName = if ($Payload.ContainsKey('firstName') -and $null -ne $Payload.firstName) { [string]$Payload.firstName } else { '' }
    $lastName = if ($Payload.ContainsKey('lastName') -and $null -ne $Payload.lastName) { [string]$Payload.lastName } else { '' }
    $email = [string]$Payload.email
    $companyName = if ($Payload.ContainsKey('companyName') -and $null -ne $Payload.companyName) { [string]$Payload.companyName } else { '' }

    if ([string]::IsNullOrWhiteSpace($displayName) -or [string]::IsNullOrWhiteSpace($alias) -or [string]::IsNullOrWhiteSpace($email)) {
        throw 'displayName, alias, and email are required for contacts.create.'
    }

    $displayName = $displayName.Trim()
    $alias = $alias.Trim()
    $email = $email.Trim()
    $firstName = $firstName.Trim()
    $lastName = $lastName.Trim()
    $companyName = $companyName.Trim()

    if ($alias -notmatch '^[A-Za-z0-9!#%*+\-/=\?\^_~]+(\.[A-Za-z0-9!#%*+\-/=\?\^_~]+)*$') {
        throw 'Alias can contain letters, numbers, ! # % * + - / = ? ^ _ ~, and periods between other valid characters. Spaces and leading/trailing periods are not allowed.'
    }

    if ($alias.Length -gt 64) {
        throw 'Alias must be 64 characters or fewer.'
    }

    if ($displayName.Length -gt 256) {
        throw 'Display name must be 256 characters or fewer.'
    }

    $existingMailContact = Get-MailContact -Identity $email -ErrorAction SilentlyContinue
    $existingContact = Get-Contact -Identity $email -ErrorAction SilentlyContinue
    if ($existingMailContact -or $existingContact) {
        throw "A contact with identity '$email' already exists."
    }

    $existingAliasRecipient = Get-Recipient -Identity $alias -ErrorAction SilentlyContinue
    if ($existingAliasRecipient) {
        throw "Alias '$alias' is already used by an existing Exchange recipient."
    }

    New-MailContact -Name $alias -Alias $alias -DisplayName $displayName -FirstName $firstName -LastName $lastName -ExternalEmailAddress $email -ErrorAction Stop | Out-Null

    $companyDetail = if ($companyName) { 'Verified contact creation and company assignment.' } else { 'Verified contact creation.' }
    $profileApplied = $true

    $setContactParams = @{
        Identity = $email
        ErrorAction = 'Stop'
    }

    $optionalSetContactStringFields = @{
        Company = $companyName
        Title = if ($Payload.ContainsKey('title') -and $null -ne $Payload.title) { [string]$Payload.title } else { '' }
        Department = if ($Payload.ContainsKey('department') -and $null -ne $Payload.department) { [string]$Payload.department } else { '' }
        Phone = if ($Payload.ContainsKey('phone') -and $null -ne $Payload.phone) { [string]$Payload.phone } else { '' }
        Office = if ($Payload.ContainsKey('office') -and $null -ne $Payload.office) { [string]$Payload.office } else { '' }
        StreetAddress = if ($Payload.ContainsKey('streetAddress') -and $null -ne $Payload.streetAddress) { [string]$Payload.streetAddress } else { '' }
        City = if ($Payload.ContainsKey('city') -and $null -ne $Payload.city) { [string]$Payload.city } else { '' }
        StateOrProvince = if ($Payload.ContainsKey('stateOrProvince') -and $null -ne $Payload.stateOrProvince) { [string]$Payload.stateOrProvince } else { '' }
        PostalCode = if ($Payload.ContainsKey('postalCode') -and $null -ne $Payload.postalCode) { [string]$Payload.postalCode } else { '' }
        CountryOrRegion = if ($Payload.ContainsKey('countryOrRegion') -and $null -ne $Payload.countryOrRegion) { [string]$Payload.countryOrRegion } else { '' }
    }

    foreach ($entry in $optionalSetContactStringFields.GetEnumerator()) {
        $value = $entry.Value.Trim()
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $setContactParams[$entry.Key] = $value
        }
    }

    if ($setContactParams.Count -gt 2) {
        try {
            Set-Contact @setContactParams | Out-Null
        }
        catch {
            $profileApplied = $false
            $companyDetail = "Contact was created, but Exchange returned an error while setting profile details: $($_.Exception.Message)"
        }
    }

    $mailContact = Get-MailContact -Identity $email -ErrorAction Stop | Select-Object -First 1
    $contact = Get-Contact -Identity $email -ErrorAction Stop | Select-Object -First 1

    $objectId = if ($mailContact.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $mailContact.ExternalDirectoryObjectId) {
        [string]$mailContact.ExternalDirectoryObjectId
    }
    elseif ($mailContact.PSObject.Properties.Name -contains 'Guid' -and $mailContact.Guid) {
        [string]$mailContact.Guid
    }
    else {
        $null
    }

    $appliedCompany = if ($contact.Company) { [string]$contact.Company } else { $null }
    $primaryEmail = if ($mailContact.ExternalEmailAddress) {
        Get-RadAppNormalizedExternalEmailAddress -MailContact $mailContact
    }
    elseif ($mailContact.PrimarySmtpAddress) {
        [string]$mailContact.PrimarySmtpAddress
    }
    else {
        $email
    }

    return @{
        outcome = 'created'
        contact = @{
            exchangeIdentity = [string]$mailContact.Identity
            objectId = $objectId
            primaryEmail = $primaryEmail
            displayName = [string]$mailContact.DisplayName
            companyName = $appliedCompany
        }
        verification = @{
            attempted = $true
            companyApplied = if ($companyName) { (($appliedCompany -eq $companyName) -and $profileApplied) } else { $profileApplied }
            detail = if (-not $profileApplied) { $companyDetail } elseif (-not $companyName -or $appliedCompany -eq $companyName) { $companyDetail } else { 'Contact was created, but company or profile verification did not match the requested value.' }
        }
    }
}
