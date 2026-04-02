function Invoke-RadAppRemoveGroupMembers {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before removing group members.'
    }

    if (-not $Payload.ContainsKey('group') -or -not $Payload.group) {
        throw 'A group payload is required for groups.removeMembers.'
    }

    if (-not $Payload.ContainsKey('members') -or -not $Payload.members -or $Payload.members.Count -eq 0) {
        throw 'At least one member is required for groups.removeMembers.'
    }

    if (-not $Payload.ContainsKey('verify') -or $Payload.verify -ne $true) {
        throw 'groups.removeMembers requires verify=true.'
    }

    $group = $Payload.group
    $exchangeIdentity = [string]$group.exchangeIdentity

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'A group exchangeIdentity is required for groups.removeMembers.'
    }

    $resolvedGroup = Get-DistributionGroup -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $resolvedGroup) {
        throw "Exchange group '$exchangeIdentity' could not be resolved."
    }

    $groupKind = switch ($resolvedGroup.RecipientTypeDetails.ToString()) {
        'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
        'MailUniversalDistributionGroup' { 'distributionList' }
        default {
            throw "Unsupported group type for groups.removeMembers: $($resolvedGroup.RecipientTypeDetails)"
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

    $existingMembers = @(Get-DistributionGroupMember -Identity $resolvedGroup.Identity -ResultSize Unlimited)
    $results = @()
    $removedMembers = @()
    $processedResolvedMembers = New-Object 'System.Collections.Generic.HashSet[string]'

    foreach ($memberRef in $Payload.members) {
        $resolvedRecipient = $null

        try {
            $resolvedRecipient = Get-Recipient -Identity ([string]$memberRef.exchangeIdentity) -ErrorAction Stop | Select-Object -First 1
        }
        catch {
            $results += @{
                member = @{
                    exchangeIdentity = [string]$memberRef.exchangeIdentity
                    objectId = if ($memberRef.objectId) { [string]$memberRef.objectId } else { $null }
                    primaryEmail = if ($memberRef.primaryEmail) { [string]$memberRef.primaryEmail } else { $null }
                }
                status = 'invalid'
                detail = "Recipient '$($memberRef.exchangeIdentity)' could not be resolved."
            }
            continue
        }

        $recipientObjectId = if ($resolvedRecipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $resolvedRecipient.ExternalDirectoryObjectId) {
            [string]$resolvedRecipient.ExternalDirectoryObjectId
        }
        elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'Guid' -and $resolvedRecipient.Guid) {
            [string]$resolvedRecipient.Guid
        }
        else {
            $null
        }

        $recipientPrimaryEmail = if ($resolvedRecipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $resolvedRecipient.PrimarySmtpAddress) {
            [string]$resolvedRecipient.PrimarySmtpAddress
        }
        elseif ($resolvedRecipient.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $resolvedRecipient.WindowsEmailAddress) {
            [string]$resolvedRecipient.WindowsEmailAddress
        }
        else {
            if ($memberRef.primaryEmail) { [string]$memberRef.primaryEmail } else { $null }
        }

        $normalizedMember = @{
            exchangeIdentity = [string]$resolvedRecipient.Identity
            objectId = $recipientObjectId
            primaryEmail = $recipientPrimaryEmail
        }

        $memberKey = if ($recipientObjectId) {
            "objectId:$recipientObjectId"
        }
        elseif ($recipientPrimaryEmail) {
            "primaryEmail:$($recipientPrimaryEmail.ToLowerInvariant())"
        }
        else {
            "exchangeIdentity:$($normalizedMember.exchangeIdentity.ToLowerInvariant())"
        }

        if (-not $processedResolvedMembers.Add($memberKey)) {
            $results += @{
                member = $normalizedMember
                status = 'notMember'
                detail = 'Recipient was already processed in this remove request.'
            }
            continue
        }

        $isCurrentMember = $false
        foreach ($existingMember in $existingMembers) {
            if ([string]$existingMember.Identity -eq $normalizedMember.exchangeIdentity) {
                $isCurrentMember = $true
                break
            }

            if ($recipientPrimaryEmail -and $existingMember.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and [string]$existingMember.PrimarySmtpAddress -eq $recipientPrimaryEmail) {
                $isCurrentMember = $true
                break
            }
        }

        if (-not $isCurrentMember) {
            $results += @{
                member = $normalizedMember
                status = 'notMember'
                detail = 'Recipient is not currently a member of the group.'
            }
            continue
        }

        try {
            Remove-DistributionGroupMember -Identity $resolvedGroup.Identity -Member $resolvedRecipient.Identity -BypassSecurityGroupManagerCheck -Confirm:$false -ErrorAction Stop
            $results += @{
                member = $normalizedMember
                status = 'removed'
                detail = 'Removed successfully.'
            }
            $removedMembers += $normalizedMember
        }
        catch {
            if ($_.Exception.Message -match 'not a member') {
                $results += @{
                    member = $normalizedMember
                    status = 'notMember'
                    detail = 'Recipient is not currently a member of the group.'
                }
            }
            else {
                $results += @{
                    member = $normalizedMember
                    status = 'failed'
                    detail = $_.Exception.Message
                }
            }
        }
    }

    $verifiedRemoved = 0
    if ($removedMembers.Count -gt 0) {
        $verifiedMembers = @(Get-DistributionGroupMember -Identity $resolvedGroup.Identity -ResultSize Unlimited)

        foreach ($removedMember in $removedMembers) {
            $stillPresent = $false
            foreach ($verifiedMember in $verifiedMembers) {
                if ([string]$verifiedMember.Identity -eq $removedMember.exchangeIdentity) {
                    $stillPresent = $true
                    break
                }

                if ($removedMember.primaryEmail -and $verifiedMember.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and [string]$verifiedMember.PrimarySmtpAddress -eq $removedMember.primaryEmail) {
                    $stillPresent = $true
                    break
                }
            }

            if (-not $stillPresent) {
                $verifiedRemoved++
            }
            else {
                foreach ($result in $results) {
                    if ($result.status -eq 'removed' -and $result.member.exchangeIdentity -eq $removedMember.exchangeIdentity) {
                        $result.status = 'verificationFailed'
                        $result.detail = 'The member removal was attempted, but verification still found the membership.'
                    }
                }
            }
        }
    }

    $removedCount = @($results | Where-Object { $_.status -eq 'removed' }).Count
    $notMemberCount = @($results | Where-Object { $_.status -eq 'notMember' }).Count
    $invalidCount = @($results | Where-Object { $_.status -eq 'invalid' }).Count
    $verificationFailedCount = @($results | Where-Object { $_.status -eq 'verificationFailed' }).Count
    $failedCount = @($results | Where-Object { $_.status -eq 'failed' }).Count

    return @{
        group = @{
            exchangeIdentity = [string]$resolvedGroup.Identity
            objectId = $groupObjectId
            groupKind = $groupKind
        }
        summary = @{
            requested = @($Payload.members).Count
            removed = $removedCount
            notMember = $notMemberCount
            invalid = $invalidCount
            verificationFailed = $verificationFailedCount
            failed = $failedCount
        }
        items = @($results)
        verification = @{
            attempted = $true
            verifiedRemoved = $verifiedRemoved
            detail = "Verified $verifiedRemoved removed member(s); $verificationFailedCount member(s) could not be confirmed."
        }
    }
}
