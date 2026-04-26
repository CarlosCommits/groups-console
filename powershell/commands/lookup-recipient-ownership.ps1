function Invoke-GroupsConsoleLookupRecipientOwnership {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:GroupsConsoleExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before checking recipient ownership.'
    }

    $email = if ($Payload.ContainsKey('email')) { [string]$Payload.email } else { '' }
    if ([string]::IsNullOrWhiteSpace($email)) {
        throw 'An email address is required for Exchange recipient ownership lookup.'
    }

    $normalizedEmail = $email.Trim().ToLowerInvariant()
    $escapedEmail = $normalizedEmail.Replace("'", "''")
    $records = New-Object System.Collections.ArrayList
    $seenKeys = New-Object 'System.Collections.Generic.HashSet[string]'

    $recipientMatches = @()

    $identityRecipient = Get-Recipient -Identity $normalizedEmail -ErrorAction SilentlyContinue
    if ($identityRecipient) {
        $recipientMatches += @($identityRecipient)
    }

    $filteredRecipients = Get-Recipient -ResultSize Unlimited -Filter "PrimarySmtpAddress -eq '$escapedEmail' -or WindowsEmailAddress -eq '$escapedEmail'" -ErrorAction SilentlyContinue
    if ($filteredRecipients) {
        $recipientMatches += @($filteredRecipients)
    }

    $proxyRecipients = Get-Recipient -ResultSize Unlimited -Filter "EmailAddresses -eq 'smtp:$escapedEmail' -or EmailAddresses -eq 'SMTP:$escapedEmail'" -ErrorAction SilentlyContinue
    if ($proxyRecipients) {
        $recipientMatches += @($proxyRecipients)
    }

    if ($recipientMatches.Count -eq 0) {
        $proxyFallbackRecipients = Get-Recipient -ResultSize Unlimited -ErrorAction SilentlyContinue |
            Where-Object {
                $_.PSObject.Properties.Name -contains 'EmailAddresses' -and $_.EmailAddresses -and
                (@(
                        $_.EmailAddresses |
                            ForEach-Object { $_.ToString() } |
                            Where-Object { $_ -match '^(?i)smtp:' } |
                            ForEach-Object { $_.Substring(5).ToLowerInvariant() }
                    ) -contains $normalizedEmail)
            }

        if ($proxyFallbackRecipients) {
            $recipientMatches += @($proxyFallbackRecipients)
        }
    }

    foreach ($recipient in ($recipientMatches | Sort-Object Identity -Unique)) {
        $mappedRecord = ConvertTo-GroupsConsoleOwnershipRecord -Recipient $recipient -TargetEmail $normalizedEmail
        if ($null -ne $mappedRecord) {
            $recordKey = Get-GroupsConsoleOwnershipRecordKey -Record $mappedRecord
            if (-not $seenKeys.Contains($recordKey)) {
                [void]$seenKeys.Add($recordKey)
                [void]$records.Add($mappedRecord)
            }
        }
    }

    $mailContactMatches = @()

    $mailContact = Get-MailContact -Identity $normalizedEmail -ErrorAction SilentlyContinue
    if ($mailContact) {
        $mailContactMatches += @($mailContact)
    }

    $mailContactMatches += @(
        Get-MailContact -ResultSize Unlimited -ErrorAction SilentlyContinue |
            Where-Object {
                $normalizedExternalEmail = Get-GroupsConsoleNormalizedExternalEmailAddress -MailContact $_
                $normalizedExternalEmail -and $normalizedExternalEmail -eq $normalizedEmail
            }
    )

    foreach ($matchedMailContact in ($mailContactMatches | Sort-Object Identity -Unique)) {
        $contactRecord = ConvertTo-GroupsConsoleMailContactOwnershipRecord -MailContact $matchedMailContact -TargetEmail $normalizedEmail
        if ($null -ne $contactRecord) {
            $recordKey = Get-GroupsConsoleOwnershipRecordKey -Record $contactRecord
            if (-not $seenKeys.Contains($recordKey)) {
                [void]$seenKeys.Add($recordKey)
                [void]$records.Add($contactRecord)
            }
        }
    }

    return @{
        targetEmail = $normalizedEmail
        records = @($records)
    }
}

function ConvertTo-GroupsConsoleOwnershipRecord {
    param(
        [Parameter(Mandatory = $true)]
        $Recipient,
        [Parameter(Mandatory = $true)]
        [string]$TargetEmail
    )

    $recipientType = switch ($Recipient.RecipientTypeDetails.ToString()) {
        'UserMailbox' { 'mailbox' }
        'SharedMailbox' { 'mailbox' }
        'RoomMailbox' { 'mailbox' }
        'EquipmentMailbox' { 'mailbox' }
        'MailContact' { 'mailContact' }
        'MailUser' { 'mailUser' }
        'GuestMailUser' { 'guestMailUser' }
        'MailUniversalDistributionGroup' { 'distributionList' }
        'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
        default { 'unknown' }
    }

    $primaryEmail = if ($Recipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $Recipient.PrimarySmtpAddress) {
        [string]$Recipient.PrimarySmtpAddress
    }
    elseif ($Recipient.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $Recipient.ExternalEmailAddress) {
        Get-GroupsConsoleNormalizedExternalEmailAddress -MailContact $Recipient
    }
    elseif ($Recipient.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $Recipient.WindowsEmailAddress) {
        [string]$Recipient.WindowsEmailAddress
    }
    else {
        $null
    }

    $alternateEmails = @()
    if ($Recipient.PSObject.Properties.Name -contains 'EmailAddresses' -and $Recipient.EmailAddresses) {
        $alternateEmails = @(
            $Recipient.EmailAddresses |
                ForEach-Object { $_.ToString() } |
                Where-Object { $_ -match '^(?i)smtp:' } |
                ForEach-Object { $_.Substring(5).ToLowerInvariant() } |
                Sort-Object -Unique
        )
    }

    $exactMatch = $false
    if ($primaryEmail -and $primaryEmail.ToLowerInvariant() -eq $TargetEmail) {
        $exactMatch = $true
    }
    elseif ($alternateEmails -contains $TargetEmail) {
        $exactMatch = $true
    }

    if (-not $exactMatch) {
        return $null
    }

    $objectId = if ($Recipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $Recipient.ExternalDirectoryObjectId) {
        [string]$Recipient.ExternalDirectoryObjectId
    }
    elseif ($Recipient.PSObject.Properties.Name -contains 'Guid' -and $Recipient.Guid) {
        [string]$Recipient.Guid
    }
    else {
        $null
    }

    return @{
        source = 'exchange'
        recipientType = $recipientType
        objectId = $objectId
        exchangeIdentity = if ($Recipient.Identity) { [string]$Recipient.Identity } else { $null }
        userPrincipalName = $null
        displayName = if ($Recipient.DisplayName) { [string]$Recipient.DisplayName } else { $TargetEmail }
        primaryEmail = if ($primaryEmail) { $primaryEmail.ToLowerInvariant() } else { $null }
        alternateEmails = @($alternateEmails)
    }
}

function ConvertTo-GroupsConsoleMailContactOwnershipRecord {
    param(
        [Parameter(Mandatory = $true)]
        $MailContact,
        [Parameter(Mandatory = $true)]
        [string]$TargetEmail
    )

    $externalEmailAddress = Get-GroupsConsoleNormalizedExternalEmailAddress -MailContact $MailContact

    if ($externalEmailAddress -ne $TargetEmail) {
        return $null
    }

    $objectId = if ($MailContact.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $MailContact.ExternalDirectoryObjectId) {
        [string]$MailContact.ExternalDirectoryObjectId
    }
    elseif ($MailContact.PSObject.Properties.Name -contains 'Guid' -and $MailContact.Guid) {
        [string]$MailContact.Guid
    }
    else {
        $null
    }

    return @{
        source = 'exchange'
        recipientType = 'mailContact'
        objectId = $objectId
        exchangeIdentity = if ($MailContact.Identity) { [string]$MailContact.Identity } else { $TargetEmail }
        userPrincipalName = $null
        displayName = if ($MailContact.DisplayName) { [string]$MailContact.DisplayName } else { $TargetEmail }
        primaryEmail = $externalEmailAddress
        alternateEmails = @($externalEmailAddress)
    }
}

function Get-GroupsConsoleNormalizedExternalEmailAddress {
    param(
        [Parameter(Mandatory = $true)]
        $MailContact
    )

    if (-not ($MailContact.PSObject.Properties.Name -contains 'ExternalEmailAddress') -or -not $MailContact.ExternalEmailAddress) {
        return $null
    }

    $rawValue = $MailContact.ExternalEmailAddress.ToString()
    if ($rawValue -match '^(?i)smtp:(.+)$') {
        return $Matches[1].ToLowerInvariant()
    }

    return $rawValue.ToLowerInvariant()
}

function Get-GroupsConsoleOwnershipRecordKey {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Record
    )

    if ($Record.objectId) {
        return "objectId:$($Record.objectId)"
    }

    if ($Record.exchangeIdentity) {
        return "exchangeIdentity:$($Record.exchangeIdentity.ToLowerInvariant())"
    }

    if ($Record.primaryEmail) {
        return "primaryEmail:$($Record.primaryEmail.ToLowerInvariant())"
    }

    return "displayName:$($Record.displayName.ToLowerInvariant())"
}
