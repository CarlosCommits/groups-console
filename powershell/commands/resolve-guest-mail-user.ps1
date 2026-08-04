function Invoke-GroupsConsoleResolveGuestMailUser {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:GroupsConsoleExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before resolving guest membership targets.'
    }

    $guestObjectId = if ($Payload.ContainsKey('objectId')) { [string]$Payload.objectId } else { '' }
    if ([string]::IsNullOrWhiteSpace($guestObjectId)) {
        throw 'A guest objectId is required to resolve a GuestMailUser membership target.'
    }

    $parsedGuestObjectId = [Guid]::Empty
    if (-not [Guid]::TryParse($guestObjectId, [ref]$parsedGuestObjectId)) {
        throw 'Guest objectId must be a valid GUID.'
    }

    $canonicalGuestObjectId = $parsedGuestObjectId.ToString()
    $escapedGuestObjectId = $canonicalGuestObjectId.Replace("'", "''")

    $primaryEmail = if ($Payload.ContainsKey('primaryEmail') -and $Payload.primaryEmail) {
        [string]$Payload.primaryEmail
    }
    else {
        $null
    }

    $resolvedRecipient = $null

    $mailUserByIdentity = Get-MailUser -Identity $canonicalGuestObjectId -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($mailUserByIdentity) {
        $resolvedRecipient = $mailUserByIdentity
    }

    if ($null -eq $resolvedRecipient) {
        $recipientByIdentity = Get-Recipient -Identity $canonicalGuestObjectId -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($recipientByIdentity) {
            $resolvedRecipient = $recipientByIdentity
        }
    }

    if ($null -eq $resolvedRecipient) {
        $filteredMailUser = Get-MailUser -ResultSize Unlimited -Filter "ExternalDirectoryObjectId -eq '$escapedGuestObjectId'" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($filteredMailUser) {
            $resolvedRecipient = $filteredMailUser
        }
    }

    if ($null -eq $resolvedRecipient) {
        $fallbackMatch = Get-MailUser -ResultSize Unlimited -ErrorAction SilentlyContinue |
            Where-Object {
                ($_.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $_.ExternalDirectoryObjectId -and [string]$_.ExternalDirectoryObjectId -eq $canonicalGuestObjectId) -or
                ($_.PSObject.Properties.Name -contains 'Guid' -and $_.Guid -and [string]$_.Guid -eq $canonicalGuestObjectId)
            } |
            Select-Object -First 1

        if ($fallbackMatch) {
            $resolvedRecipient = $fallbackMatch
        }
    }

    if ($null -eq $resolvedRecipient) {
        return @{
            resolved = $false
            member = $null
            detail = 'The selected guest is not yet visible in Exchange as a GuestMailUser.'
        }
    }

    if ($resolvedRecipient.RecipientTypeDetails.ToString() -ne 'GuestMailUser') {
        return @{
            resolved = $false
            member = $null
            detail = "Exchange resolved '$canonicalGuestObjectId' to '$($resolvedRecipient.RecipientTypeDetails)', not GuestMailUser."
        }
    }

    $resolvedPrimaryEmail = if ($resolvedRecipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $resolvedRecipient.PrimarySmtpAddress) {
        [string]$resolvedRecipient.PrimarySmtpAddress
    }
    else {
        $normalizedExternalEmail = Get-GroupsConsoleNormalizedExternalEmailAddress -MailContact $resolvedRecipient
        if ($normalizedExternalEmail) {
            $normalizedExternalEmail
        }
        else {
            $primaryEmail
        }
    }

    $resolvedObjectId = if ($resolvedRecipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $resolvedRecipient.ExternalDirectoryObjectId) {
        [string]$resolvedRecipient.ExternalDirectoryObjectId
    }
    elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'Guid' -and $resolvedRecipient.Guid) {
        [string]$resolvedRecipient.Guid
    }
    else {
        $canonicalGuestObjectId
    }

    $resolvedExchangeIdentity = Get-GroupsConsoleRecipientWriteIdentity -Recipient $resolvedRecipient

    return @{
        resolved = $true
        member = @{
            exchangeIdentity = $resolvedExchangeIdentity
            objectId = $resolvedObjectId
            primaryEmail = $resolvedPrimaryEmail
        }
        detail = 'Resolved the selected guest to an Exchange GuestMailUser.'
    }
}
