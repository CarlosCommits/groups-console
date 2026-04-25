function Invoke-RadAppUpdateContactCompany {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before updating contacts.'
    }

    $exchangeIdentity = [string]$Payload.exchangeIdentity
    $companyName = if ($Payload.ContainsKey('companyName') -and $null -ne $Payload.companyName) {
        [string]$Payload.companyName
    }
    else {
        ''
    }
    $requestedCompanyName = $companyName.Trim()
    $targetCompanyName = if ([string]::IsNullOrWhiteSpace($requestedCompanyName)) { $null } else { $requestedCompanyName }

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'exchangeIdentity is required for contacts.updateCompany.'
    }

    $mailContact = Get-MailContact -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    $updateDetail = 'Verified company update.'

    try {
        Set-Contact -Identity $exchangeIdentity -Company $targetCompanyName -ErrorAction Stop | Out-Null
    }
    catch {
        $updateDetail = "Company update was attempted, but Exchange returned an error: $($_.Exception.Message)"
    }

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

    $appliedCompany = if ($contact.Company) { [string]$contact.Company } else { $null }
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
            companyName = $appliedCompany
        }
        verification = @{
            attempted = $true
            companyApplied = ($appliedCompany -eq $targetCompanyName)
            detail = if ($appliedCompany -eq $targetCompanyName) { $updateDetail } else { 'Company update was attempted, but verification did not match the requested value.' }
        }
    }
}
