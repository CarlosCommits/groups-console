function Invoke-GroupsConsoleGetGroupMemberships {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:GroupsConsoleExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before reading group memberships.'
    }

    if (-not $Payload.ContainsKey('member') -or -not $Payload.member) {
        throw 'A member payload is required for groups.getMemberships.'
    }

    $member = $Payload.member
    $exchangeIdentity = [string]$member.exchangeIdentity

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'A member exchangeIdentity is required for groups.getMemberships.'
    }

    $resolvedRecipient = Get-Recipient -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $resolvedRecipient) {
        throw "Exchange recipient '$exchangeIdentity' could not be resolved."
    }

    $distinguishedName = if ($resolvedRecipient.PSObject.Properties.Name -contains 'DistinguishedName' -and $resolvedRecipient.DistinguishedName) {
        [string]$resolvedRecipient.DistinguishedName
    }
    else {
        $null
    }

    if ([string]::IsNullOrWhiteSpace($distinguishedName)) {
        throw "Exchange recipient '$exchangeIdentity' does not have a DistinguishedName for membership lookup."
    }

    $memberExchangeIdentity = Get-GroupsConsoleRecipientWriteIdentity -Recipient $resolvedRecipient

    function ConvertTo-GroupsConsoleOPathStringLiteral {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Value
        )

        if ($Value -match "[`r`n`0]") {
            throw 'Exchange filter values cannot contain control characters.'
        }

        # Exchange OPATH single-quoted literals escape embedded single quotes by doubling them.
        # Other DN characters, including commas, backslashes, and double quotes, remain literal.
        return "'$($Value.Replace("'", "''"))'"
    }

    $distinguishedNameFilterLiteral = ConvertTo-GroupsConsoleOPathStringLiteral -Value $distinguishedName

    $memberObjectId = if ($resolvedRecipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $resolvedRecipient.ExternalDirectoryObjectId) {
        [string]$resolvedRecipient.ExternalDirectoryObjectId
    }
    elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'Guid' -and $resolvedRecipient.Guid) {
        [string]$resolvedRecipient.Guid
    }
    elseif ($member.PSObject.Properties.Name -contains 'objectId' -and $member.objectId) {
        [string]$member.objectId
    }
    else {
        $null
    }

    $memberPrimaryEmail = if ($resolvedRecipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $resolvedRecipient.PrimarySmtpAddress) {
        [string]$resolvedRecipient.PrimarySmtpAddress
    }
    elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $resolvedRecipient.ExternalEmailAddress) {
        $rawExternalEmail = $resolvedRecipient.ExternalEmailAddress.ToString()
        if ($rawExternalEmail -match '^(?i)smtp:(.+)$') {
            $Matches[1]
        }
        else {
            $rawExternalEmail
        }
    }
    elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $resolvedRecipient.WindowsEmailAddress) {
        [string]$resolvedRecipient.WindowsEmailAddress
    }
    elseif ($member.PSObject.Properties.Name -contains 'primaryEmail' -and $member.primaryEmail) {
        [string]$member.primaryEmail
    }
    else {
        $null
    }

    function ConvertTo-GroupsConsoleGroupMembershipItem {
        param(
            [Parameter(Mandatory = $true)]
            $ResolvedGroup
        )

        $groupKind = switch ($ResolvedGroup.RecipientTypeDetails.ToString()) {
            'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
            'MailUniversalDistributionGroup' { 'distributionList' }
            default { $null }
        }

        if ($null -eq $groupKind) {
            return $null
        }

        $groupObjectId = if ($ResolvedGroup.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $ResolvedGroup.ExternalDirectoryObjectId) {
            [string]$ResolvedGroup.ExternalDirectoryObjectId
        }
        elseif ($ResolvedGroup.PSObject.Properties.Name -contains 'Guid' -and $ResolvedGroup.Guid) {
            [string]$ResolvedGroup.Guid
        }
        else {
            $null
        }

        $whenChangedUtc = $null
        if ($ResolvedGroup.PSObject.Properties.Name -contains 'WhenChangedUTC' -and $ResolvedGroup.WhenChangedUTC) {
            $whenChangedUtc = ([datetime]$ResolvedGroup.WhenChangedUTC).ToUniversalTime().ToString('o')
        }
        elseif ($ResolvedGroup.PSObject.Properties.Name -contains 'WhenChanged' -and $ResolvedGroup.WhenChanged) {
            $whenChangedUtc = ([datetime]$ResolvedGroup.WhenChanged).ToUniversalTime().ToString('o')
        }

        return @{
            objectId = $groupObjectId
            exchangeIdentity = [string]$ResolvedGroup.Identity
            displayName = [string]$ResolvedGroup.DisplayName
            alias = if ($ResolvedGroup.Alias) { [string]$ResolvedGroup.Alias } else { $null }
            primaryEmail = if ($ResolvedGroup.PrimarySmtpAddress) { [string]$ResolvedGroup.PrimarySmtpAddress } else { $null }
            groupKind = $groupKind
            managedByDisplayNames = @($ResolvedGroup.ManagedBy | ForEach-Object { [string]$_ })
            whenChangedUtc = $whenChangedUtc
        }
    }

    $items = @(
        Get-DistributionGroup -ResultSize Unlimited -IncludeManagedByWithDisplayNames -Filter "Members -eq $distinguishedNameFilterLiteral" -ErrorAction Stop |
            ForEach-Object {
                $membershipItem = ConvertTo-GroupsConsoleGroupMembershipItem -ResolvedGroup $_
                if ($null -ne $membershipItem) {
                    $membershipItem
                }
            }
    )

    $items = @($items | Sort-Object DisplayName)

    return @{
        member = @{
            exchangeIdentity = $memberExchangeIdentity
            objectId = $memberObjectId
            primaryEmail = $memberPrimaryEmail
        }
        items = $items
    }
}
