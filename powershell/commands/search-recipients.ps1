function Invoke-RadAppSearchRecipients {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before searching recipients.'
    }

    $query = if ($Payload.ContainsKey('query')) { [string]$Payload.query } else { '' }
    if ([string]::IsNullOrWhiteSpace($query) -or $query.Trim().Length -lt 2) {
        throw 'A search query with at least 2 characters is required for recipients.search.'
    }

    $limit = 25
    if ($Payload.ContainsKey('limit') -and $Payload.limit) {
        $limit = [Math]::Min([Math]::Max([int]$Payload.limit, 1), 100)
    }

    $requestedTypes = @()
    if ($Payload.ContainsKey('types') -and $Payload.types) {
        $requestedTypes = @($Payload.types | ForEach-Object { [string]$_ })
    }

    $appliedTypes = if ($requestedTypes.Count -gt 0) {
        $requestedTypes
    }
    else {
        @('mailbox', 'mailContact', 'mailUser', 'distributionList', 'mailEnabledSecurityGroup')
    }

    $escapedQuery = $query.Trim().Replace("'", "''")
    $filter = "Alias -like '$escapedQuery*' -or DisplayName -like '*$escapedQuery*' -or Name -like '*$escapedQuery*' -or PrimarySmtpAddress -like '$escapedQuery*'"
    $recipients = Get-Recipient -ResultSize Unlimited -Filter $filter |
        Sort-Object DisplayName

    $items = New-Object System.Collections.ArrayList

    foreach ($recipient in $recipients) {
        $recipientType = switch ($recipient.RecipientTypeDetails.ToString()) {
            'UserMailbox' { 'mailbox' }
            'SharedMailbox' { 'mailbox' }
            'RoomMailbox' { 'mailbox' }
            'EquipmentMailbox' { 'mailbox' }
            'MailContact' { 'mailContact' }
            'MailUser' { 'mailUser' }
            'MailUniversalDistributionGroup' { 'distributionList' }
            'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
            default { 'unknown' }
        }

        if ($appliedTypes -notcontains $recipientType) {
            continue
        }

        $objectId = if ($recipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $recipient.ExternalDirectoryObjectId) {
            [string]$recipient.ExternalDirectoryObjectId
        }
        elseif ($recipient.PSObject.Properties.Name -contains 'Guid' -and $recipient.Guid) {
            [string]$recipient.Guid
        }
        else {
            $null
        }

        $primaryEmail = if ($recipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $recipient.PrimarySmtpAddress) {
            [string]$recipient.PrimarySmtpAddress
        }
        elseif ($recipient.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $recipient.WindowsEmailAddress) {
            [string]$recipient.WindowsEmailAddress
        }
        else {
            $null
        }

        $companyName = $null
        $companySource = 'none'

        if ($recipientType -eq 'mailContact') {
            $contact = Get-Contact -Identity $recipient.Identity -ErrorAction SilentlyContinue
            if ($contact -and $contact.Company) {
                $companyName = [string]$contact.Company
                $companySource = 'exchange'
            }
        }
        elseif ($recipientType -eq 'mailbox' -or $recipientType -eq 'mailUser') {
            $user = Get-User -Identity $recipient.Identity -ErrorAction SilentlyContinue
            if ($user -and $user.Company) {
                $companyName = [string]$user.Company
                $companySource = 'exchange'
            }
        }

        [void]$items.Add(@{
                source = 'exchange'
                stableKey = if ($objectId) {
                    "exchange:objectId:$objectId"
                }
                elseif ($recipient.Identity) {
                    "exchange:identity:$([string]$recipient.Identity)"
                }
                elseif ($primaryEmail) {
                    "exchange:email:$($primaryEmail.ToLowerInvariant())"
                }
                else {
                    "exchange:displayName:$([string]$recipient.DisplayName)"
                }
                recipientType = $recipientType
                membershipSupport = if ($recipientType -ne 'unknown') { 'exchangeDirect' } else { 'unsupported' }
                objectId = $objectId
                exchangeIdentity = [string]$recipient.Identity
                primaryEmail = $primaryEmail
                displayName = [string]$recipient.DisplayName
                alias = if ($recipient.Alias) { [string]$recipient.Alias } else { $null }
                recipientTypeDetails = [string]$recipient.RecipientTypeDetails
                companyName = $companyName
                companySource = $companySource
            })

        if ($items.Count -ge $limit) {
            break
        }
    }

    return @{
        query = $query.Trim()
        appliedLimit = $limit
        appliedTypes = @($appliedTypes)
        sourceStatus = @{
            exchange = 'searched'
            graph = if ($appliedTypes -contains 'guestUser') { 'deferred' } else { 'skipped' }
        }
        items = @($items)
    }
}
