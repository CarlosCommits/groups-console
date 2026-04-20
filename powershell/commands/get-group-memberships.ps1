function Invoke-RadAppGetGroupMemberships {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
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

    $groupReferences = @()
    if ($resolvedRecipient.PSObject.Properties.Name -contains 'MemberOfGroup' -and $resolvedRecipient.MemberOfGroup) {
        $groupReferences = @(
            $resolvedRecipient.MemberOfGroup |
                ForEach-Object { $_.ToString() } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                Select-Object -Unique
        )
    }

    $items = @(
        foreach ($groupReference in $groupReferences) {
            $resolvedGroup = Get-DistributionGroup -Identity $groupReference -IncludeManagedByWithDisplayNames -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -eq $resolvedGroup) {
                continue
            }

            $groupKind = switch ($resolvedGroup.RecipientTypeDetails.ToString()) {
                'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
                'MailUniversalDistributionGroup' { 'distributionList' }
                default { $null }
            }

            if ($null -eq $groupKind) {
                continue
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

            $whenChangedUtc = $null
            if ($resolvedGroup.PSObject.Properties.Name -contains 'WhenChangedUTC' -and $resolvedGroup.WhenChangedUTC) {
                $whenChangedUtc = ([datetime]$resolvedGroup.WhenChangedUTC).ToUniversalTime().ToString('o')
            }
            elseif ($resolvedGroup.PSObject.Properties.Name -contains 'WhenChanged' -and $resolvedGroup.WhenChanged) {
                $whenChangedUtc = ([datetime]$resolvedGroup.WhenChanged).ToUniversalTime().ToString('o')
            }

            @{
                objectId = $groupObjectId
                exchangeIdentity = [string]$resolvedGroup.Identity
                displayName = [string]$resolvedGroup.DisplayName
                alias = if ($resolvedGroup.Alias) { [string]$resolvedGroup.Alias } else { $null }
                primaryEmail = if ($resolvedGroup.PrimarySmtpAddress) { [string]$resolvedGroup.PrimarySmtpAddress } else { $null }
                groupKind = $groupKind
                managedByDisplayNames = @($resolvedGroup.ManagedBy | ForEach-Object { [string]$_ })
                whenChangedUtc = $whenChangedUtc
            }
        } | Sort-Object DisplayName
    )

    return @{
        member = @{
            exchangeIdentity = [string]$resolvedRecipient.Identity
            objectId = $memberObjectId
            primaryEmail = $memberPrimaryEmail
        }
        items = $items
    }
}
