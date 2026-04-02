function Invoke-RadAppCreateContact {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before creating contacts.'
    }

    $firstName = [string]$Payload.firstName
    $lastName = [string]$Payload.lastName
    $email = [string]$Payload.email
    $companyName = [string]$Payload.companyName

    if ([string]::IsNullOrWhiteSpace($firstName) -or [string]::IsNullOrWhiteSpace($lastName) -or [string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($companyName)) {
        throw 'firstName, lastName, email, and companyName are required for contacts.create.'
    }

    $existingMailContact = Get-MailContact -Identity $email -ErrorAction SilentlyContinue
    $existingContact = Get-Contact -Identity $email -ErrorAction SilentlyContinue
    if ($existingMailContact -or $existingContact) {
        throw "A contact with identity '$email' already exists."
    }

    $displayName = "$firstName $lastName"

    New-MailContact -Name $displayName -DisplayName $displayName -FirstName $firstName -LastName $lastName -ExternalEmailAddress $email -ErrorAction Stop | Out-Null

    $companyDetail = 'Verified contact creation and company assignment.'

    try {
        Set-Contact -Identity $email -Company $companyName -ErrorAction Stop | Out-Null
    }
    catch {
        $companyDetail = "Contact was created, but Exchange returned an error while setting company: $($_.Exception.Message)"
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

    return @{
        contact = @{
            exchangeIdentity = [string]$mailContact.Identity
            objectId = $objectId
            primaryEmail = if ($mailContact.ExternalEmailAddress) { [string]$mailContact.ExternalEmailAddress } else { $email }
            displayName = [string]$mailContact.DisplayName
            companyName = $appliedCompany
        }
        verification = @{
            attempted = $true
            companyApplied = ($appliedCompany -eq $companyName)
            detail = if ($appliedCompany -eq $companyName) { $companyDetail } else { 'Contact was created, but company verification did not match the requested value.' }
        }
    }
}
