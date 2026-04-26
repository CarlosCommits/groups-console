function Invoke-GroupsConsoleGetGroupMembers {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:GroupsConsoleExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before reading group members.'
    }

    if (-not $Payload.ContainsKey('group') -or -not $Payload.group) {
        throw 'A group payload is required for groups.getMembers.'
    }

    $group = $Payload.group
    $exchangeIdentity = [string]$group.exchangeIdentity

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'A group exchangeIdentity is required for groups.getMembers.'
    }

    $resolvedGroup = Get-DistributionGroup -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $resolvedGroup) {
        throw "Exchange group '$exchangeIdentity' could not be resolved."
    }

    $groupKind = switch ($resolvedGroup.RecipientTypeDetails.ToString()) {
        'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
        'MailUniversalDistributionGroup' { 'distributionList' }
        default {
            throw "Unsupported group type for groups.getMembers: $($resolvedGroup.RecipientTypeDetails)"
        }
    }

    $groupObjectId = if ($resolvedGroup.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $resolvedGroup.ExternalDirectoryObjectId) {
        [string]$resolvedGroup.ExternalDirectoryObjectId
    }
    elseif ($resolvedGroup.PSObject.Properties.Name -contains 'Guid' -and $resolvedGroup.Guid) {
        [string]$resolvedGroup.Guid
    }
    else {
        $null
    }

    $members = Get-DistributionGroupMember -Identity $exchangeIdentity -ResultSize Unlimited |
        Sort-Object DisplayName

    $items = @(
        foreach ($member in $members) {
            $objectId = if ($member.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $member.ExternalDirectoryObjectId) {
                [string]$member.ExternalDirectoryObjectId
            }
            elseif ($member.PSObject.Properties.Name -contains 'Guid' -and $member.Guid) {
                [string]$member.Guid
            }
            else {
                $null
            }

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

            $primaryEmail = if ($member.PrimarySmtpAddress) {
                [string]$member.PrimarySmtpAddress
            }
            elseif ($member.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $member.ExternalEmailAddress) {
                $rawExternalEmail = $member.ExternalEmailAddress.ToString()
                if ($rawExternalEmail -match '^(?i)smtp:(.+)$') {
                    $Matches[1]
                }
                else {
                    $rawExternalEmail
                }
            }
            else {
                $null
            }

            @{
                objectId = $objectId
                exchangeIdentity = [string]$member.Identity
                displayName = [string]$member.DisplayName
                primaryEmail = $primaryEmail
                alias = if ($member.Alias) { [string]$member.Alias } else { $null }
                recipientType = $recipientType
                recipientTypeDetails = [string]$member.RecipientTypeDetails
            }
        }
    )

    return @{
        group = @{
            exchangeIdentity = [string]$resolvedGroup.Identity
            objectId = $groupObjectId
            groupKind = $groupKind
        }
        items = $items
    }
}
