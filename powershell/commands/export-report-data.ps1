function Invoke-RadAppExportReportData {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before generating report data.'
    }

    $appliedKind = if ($Payload.ContainsKey('kind') -and $Payload.kind) {
        [string]$Payload.kind
    }
    else {
        'all'
    }

    if ($appliedKind -notin @('all', 'distributionList', 'mailEnabledSecurityGroup')) {
        throw "Unsupported report kind '$appliedKind'."
    }

    Write-RadAppProgress -Phase 'preflight' -Message 'Collecting Exchange groups for report export.' -Percent 5

    $groups = @(Get-DistributionGroup -ResultSize Unlimited | Sort-Object DisplayName, PrimarySmtpAddress)
    if ($appliedKind -eq 'distributionList') {
        $groups = @($groups | Where-Object { $_.RecipientTypeDetails -eq 'MailUniversalDistributionGroup' })
    }
    elseif ($appliedKind -eq 'mailEnabledSecurityGroup') {
        $groups = @($groups | Where-Object { $_.RecipientTypeDetails -eq 'MailUniversalSecurityGroup' })
    }

    $normalizedGroups = New-Object System.Collections.ArrayList
    $rowsByKey = @{}
    $membershipCount = 0

    $totalGroups = if ($groups.Count -gt 0) { $groups.Count } else { 1 }

    for ($index = 0; $index -lt $groups.Count; $index++) {
        $group = $groups[$index]
        $groupKind = switch ($group.RecipientTypeDetails.ToString()) {
            'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
            default { 'distributionList' }
        }

        $groupObjectId = if ($group.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $group.ExternalDirectoryObjectId) {
            [string]$group.ExternalDirectoryObjectId
        }
        elseif ($group.PSObject.Properties.Name -contains 'Guid' -and $group.Guid) {
            [string]$group.Guid
        }
        else {
            $null
        }

        $groupPrimaryEmail = if ($group.PrimarySmtpAddress) {
            [string]$group.PrimarySmtpAddress
        }
        else {
            $null
        }

        [void]$normalizedGroups.Add(@{
            exchangeIdentity = [string]$group.Identity
            objectId = $groupObjectId
            groupKind = $groupKind
            displayName = [string]$group.DisplayName
            primaryEmail = $groupPrimaryEmail
        })

        $progressPercent = [Math]::Min(85, [int](5 + ((($index + 1) / $totalGroups) * 80)))
        Write-RadAppProgress -Phase 'executing' -Message "Reading members for group '$($group.DisplayName)'." -Percent $progressPercent

        $members = @(Get-DistributionGroupMember -Identity $group.Identity -ResultSize Unlimited)
        foreach ($member in $members) {
            $recipientType = switch ($member.RecipientTypeDetails.ToString()) {
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

            $memberObjectId = if ($member.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $member.ExternalDirectoryObjectId) {
                [string]$member.ExternalDirectoryObjectId
            }
            elseif ($member.PSObject.Properties.Name -contains 'Guid' -and $member.Guid) {
                [string]$member.Guid
            }
            else {
                $null
            }

            $memberPrimaryEmail = if ($member.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $member.PrimarySmtpAddress) {
                [string]$member.PrimarySmtpAddress
            }
            elseif ($member.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $member.WindowsEmailAddress) {
                [string]$member.WindowsEmailAddress
            }
            elseif ($member.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $member.ExternalEmailAddress) {
                Get-RadAppNormalizedExternalEmailAddress -MailContact $member
            }
            else {
                $null
            }

            $stableRecipientKey = if ($memberObjectId) {
                "exchange:objectId:$memberObjectId"
            }
            else {
                "exchange:identity:$([string]$member.Identity)".ToLowerInvariant()
            }

            if (-not $rowsByKey.ContainsKey($stableRecipientKey)) {
                $companyName = Get-RadAppReportRecipientCompanyName -Recipient $member -RecipientType $recipientType

                $rowsByKey[$stableRecipientKey] = @{
                    stableRecipientKey = $stableRecipientKey
                    source = 'exchange'
                    recipientType = $recipientType
                    recipientTypeDetails = [string]$member.RecipientTypeDetails
                    objectId = $memberObjectId
                    exchangeIdentity = [string]$member.Identity
                    displayName = if ($member.DisplayName) { [string]$member.DisplayName } else { [string]$member.Identity }
                    primaryEmail = $memberPrimaryEmail
                    companyName = $companyName
                    memberships = New-Object System.Collections.ArrayList
                }
            }

            if (-not ($rowsByKey[$stableRecipientKey].memberships -contains [string]$group.Identity)) {
                [void]$rowsByKey[$stableRecipientKey].memberships.Add([string]$group.Identity)
                $membershipCount++
            }
        }
    }

    Write-RadAppProgress -Phase 'verifying' -Message 'Normalizing membership matrix rows.' -Percent 92

    $normalizedRows = @(
        $rowsByKey.Values |
            Sort-Object displayName, primaryEmail |
            ForEach-Object {
                @{
                    stableRecipientKey = [string]$_.stableRecipientKey
                    source = [string]$_.source
                    recipientType = [string]$_.recipientType
                    recipientTypeDetails = [string]$_.recipientTypeDetails
                    objectId = if ($_.objectId) { [string]$_.objectId } else { $null }
                    exchangeIdentity = if ($_.exchangeIdentity) { [string]$_.exchangeIdentity } else { $null }
                    displayName = [string]$_.displayName
                    primaryEmail = if ($_.primaryEmail) { [string]$_.primaryEmail } else { $null }
                    companyName = if ($_.companyName) { [string]$_.companyName } else { $null }
                    memberships = @($_.memberships)
                }
            }
    )

    return @{
        appliedKind = $appliedKind
        generatedAt = [DateTime]::UtcNow.ToString('o')
        groups = @($normalizedGroups)
        rows = $normalizedRows
        summary = @{
            groupCount = $normalizedGroups.Count
            recipientCount = $normalizedRows.Count
            membershipCount = $membershipCount
        }
    }
}

function Get-RadAppReportRecipientCompanyName {
    param(
        [Parameter(Mandatory = $true)]
        $Recipient,
        [Parameter(Mandatory = $true)]
        [string]$RecipientType
    )

    if ($RecipientType -eq 'mailContact') {
        $contact = Get-Contact -Identity $Recipient.Identity -ErrorAction SilentlyContinue
        if ($contact -and $contact.Company) {
            return [string]$contact.Company
        }
    }

    if ($RecipientType -in @('mailbox', 'mailUser', 'guestMailUser')) {
        $user = Get-User -Identity $Recipient.Identity -ErrorAction SilentlyContinue
        if ($user -and $user.Company) {
            return [string]$user.Company
        }
    }

    return $null
}
