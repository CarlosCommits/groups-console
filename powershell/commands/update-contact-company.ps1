function Invoke-RadAppUpdateContactCompany {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before updating contacts.'
    }

    $exchangeIdentity = [string]$Payload.exchangeIdentity
    $companyName = [string]$Payload.companyName

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity) -or [string]::IsNullOrWhiteSpace($companyName)) {
        throw 'exchangeIdentity and companyName are required for contacts.updateCompany.'
    }

    $mailContact = Get-MailContact -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    $updateDetail = 'Verified company update.'

    try {
        Set-Contact -Identity $exchangeIdentity -Company $companyName -ErrorAction Stop | Out-Null
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

    return @{
        contact = @{
            exchangeIdentity = [string]$mailContact.Identity
            objectId = $objectId
            primaryEmail = if ($mailContact.ExternalEmailAddress) { [string]$mailContact.ExternalEmailAddress } else { $null }
            companyName = $appliedCompany
        }
        verification = @{
            attempted = $true
            companyApplied = ($appliedCompany -eq $companyName)
            detail = if ($appliedCompany -eq $companyName) { $updateDetail } else { 'Company update was attempted, but verification did not match the requested value.' }
        }
    }
}
