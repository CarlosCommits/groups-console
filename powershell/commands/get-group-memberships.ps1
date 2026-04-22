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

    $distinguishedName = if ($resolvedRecipient.PSObject.Properties.Name -contains 'DistinguishedName' -and $resolvedRecipient.DistinguishedName) {
        [string]$resolvedRecipient.DistinguishedName
    }
    else {
        $null
    }

    if ([string]::IsNullOrWhiteSpace($distinguishedName)) {
        throw "Exchange recipient '$exchangeIdentity' does not have a DistinguishedName for membership lookup."
    }

    $escapedDistinguishedName = $distinguishedName.Replace("'", "''")

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

    function Add-RadAppIdentifier {
        param(
            [System.Collections.Generic.HashSet[string]]$Identifiers,
            [Parameter(Mandatory = $false)]
            [string]$Value
        )

        if ([string]::IsNullOrWhiteSpace($Value)) {
            return
        }

        [void]$Identifiers.Add($Value.Trim().ToLowerInvariant())
    }

    function Get-RadAppStrongRecipientIdentifiers {
        param(
            [Parameter(Mandatory = $true)]
            $Recipient,
            [Parameter(Mandatory = $false)]
            $FallbackMember
        )

        $identifiers = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

        Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.Identity)

        if ($Recipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $Recipient.ExternalDirectoryObjectId) {
            Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.ExternalDirectoryObjectId)
        }
        elseif ($Recipient.PSObject.Properties.Name -contains 'Guid' -and $Recipient.Guid) {
            Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.Guid)
        }

        if ($null -ne $FallbackMember) {
            Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$FallbackMember.exchangeIdentity)
            Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$FallbackMember.objectId)
        }

        return $identifiers
    }

    function Get-RadAppWeakRecipientIdentifiers {
        param(
            [Parameter(Mandatory = $true)]
            $Recipient,
            [Parameter(Mandatory = $false)]
            $FallbackMember
        )

        $identifiers = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

        Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.Alias)
        Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.PrimarySmtpAddress)
        Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$Recipient.WindowsEmailAddress)

        if ($Recipient.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $Recipient.ExternalEmailAddress) {
            $rawExternalEmail = $Recipient.ExternalEmailAddress.ToString()
            if ($rawExternalEmail -match '^(?i)smtp:(.+)$') {
                Add-RadAppIdentifier -Identifiers $identifiers -Value $Matches[1]
            }
            else {
                Add-RadAppIdentifier -Identifiers $identifiers -Value $rawExternalEmail
            }
        }

        if ($null -ne $FallbackMember) {
            Add-RadAppIdentifier -Identifiers $identifiers -Value ([string]$FallbackMember.primaryEmail)
        }

        return $identifiers
    }

    function Test-RadAppGroupMemberMatch {
        param(
            [Parameter(Mandatory = $true)]
            $GroupMember,
            [System.Collections.Generic.HashSet[string]]$StrongRecipientIdentifiers,
            [System.Collections.Generic.HashSet[string]]$WeakRecipientIdentifiers
        )

        $strongCandidateIdentifiers = Get-RadAppStrongRecipientIdentifiers -Recipient $GroupMember
        $weakCandidateIdentifiers = Get-RadAppWeakRecipientIdentifiers -Recipient $GroupMember

        if ($StrongRecipientIdentifiers.Count -gt 0 -or $strongCandidateIdentifiers.Count -gt 0) {
            foreach ($candidateIdentifier in $strongCandidateIdentifiers) {
                if ($StrongRecipientIdentifiers.Contains($candidateIdentifier)) {
                    return $true
                }
            }

            return $false
        }

        foreach ($candidateIdentifier in $weakCandidateIdentifiers) {
            if ($WeakRecipientIdentifiers.Contains($candidateIdentifier)) {
                return $true
            }
        }

        return $false
    }

    function ConvertTo-RadAppGroupMembershipItem {
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

    $strongRecipientIdentifiers = Get-RadAppStrongRecipientIdentifiers -Recipient $resolvedRecipient -FallbackMember $member
    $weakRecipientIdentifiers = Get-RadAppWeakRecipientIdentifiers -Recipient $resolvedRecipient -FallbackMember $member
    $groupReferenceItems = @(
        Get-DistributionGroup -ResultSize Unlimited -IncludeManagedByWithDisplayNames -Filter "Members -eq '$escapedDistinguishedName'" -ErrorAction SilentlyContinue |
            ForEach-Object {
                $membershipItem = ConvertTo-RadAppGroupMembershipItem -ResolvedGroup $_
                if ($null -ne $membershipItem) {
                    $membershipItem
                }
            }
    )

    $items = if ($groupReferenceItems.Count -gt 0) {
        $groupReferenceItems
    }
    else {
        @(
            $resolvedGroups = Get-DistributionGroup -ResultSize Unlimited -IncludeManagedByWithDisplayNames -ErrorAction Stop

            foreach ($resolvedGroup in $resolvedGroups) {
                $membershipItem = ConvertTo-RadAppGroupMembershipItem -ResolvedGroup $resolvedGroup
                if ($null -eq $membershipItem) {
                    continue
                }

                $groupMembers = @(Get-DistributionGroupMember -Identity $resolvedGroup.Identity -ResultSize Unlimited -ErrorAction SilentlyContinue)
                if ($groupMembers.Count -eq 0) {
                    continue
                }

                $hasMatch = $false
                foreach ($groupMember in $groupMembers) {
                    if (Test-RadAppGroupMemberMatch -GroupMember $groupMember -StrongRecipientIdentifiers $strongRecipientIdentifiers -WeakRecipientIdentifiers $weakRecipientIdentifiers) {
                        $hasMatch = $true
                        break
                    }
                }

                if ($hasMatch) {
                    $membershipItem
                }
            }
        )
    }

    $items = @($items | Sort-Object DisplayName)

    return @{
        member = @{
            exchangeIdentity = [string]$resolvedRecipient.Identity
            objectId = $memberObjectId
            primaryEmail = $memberPrimaryEmail
        }
        items = $items
    }
}
