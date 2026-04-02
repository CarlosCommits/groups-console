function Invoke-RadAppAddGroupMembers {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before adding group members.'
    }

    if (-not $Payload.ContainsKey('group') -or -not $Payload.group) {
        throw 'A group payload is required for groups.addMembers.'
    }

    if (-not $Payload.ContainsKey('members') -or -not $Payload.members -or $Payload.members.Count -eq 0) {
        throw 'At least one member is required for groups.addMembers.'
    }

    if (-not $Payload.ContainsKey('verify') -or $Payload.verify -ne $true) {
        throw 'groups.addMembers requires verify=true.'
    }

    $group = $Payload.group
    $exchangeIdentity = [string]$group.exchangeIdentity

    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'A group exchangeIdentity is required for groups.addMembers.'
    }

    $resolvedGroup = Get-DistributionGroup -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $resolvedGroup) {
        throw "Exchange group '$exchangeIdentity' could not be resolved."
    }

    $groupKind = switch ($resolvedGroup.RecipientTypeDetails.ToString()) {
        'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
        'MailUniversalDistributionGroup' { 'distributionList' }
        default {
            throw "Unsupported group type for groups.addMembers: $($resolvedGroup.RecipientTypeDetails)"
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
    $addedMembers = @()

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

        $isAlreadyMember = $false
        foreach ($existingMember in $existingMembers) {
            if ([string]$existingMember.Identity -eq $normalizedMember.exchangeIdentity) {
                $isAlreadyMember = $true
                break
            }

            if ($recipientPrimaryEmail -and $existingMember.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and [string]$existingMember.PrimarySmtpAddress -eq $recipientPrimaryEmail) {
                $isAlreadyMember = $true
                break
            }
        }

        if ($isAlreadyMember) {
            $results += @{
                member = $normalizedMember
                status = 'alreadyMember'
                detail = 'Recipient is already a member of the group.'
            }
            continue
        }

        try {
            Add-DistributionGroupMember -Identity $resolvedGroup.Identity -Member $resolvedRecipient.Identity -BypassSecurityGroupManagerCheck -Confirm:$false -ErrorAction Stop
            $results += @{
                member = $normalizedMember
                status = 'added'
                detail = 'Added successfully.'
            }
            $addedMembers += $normalizedMember
        }
        catch {
            if ($_.Exception.Message -match 'MemberAlreadyExistsException') {
                $results += @{
                    member = $normalizedMember
                    status = 'alreadyMember'
                    detail = 'Recipient is already a member of the group.'
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

    $verifiedAdded = 0
    if ($addedMembers.Count -gt 0) {
        $verifiedMembers = @(Get-DistributionGroupMember -Identity $resolvedGroup.Identity -ResultSize Unlimited)

        foreach ($addedMember in $addedMembers) {
            $isVerified = $false
            foreach ($verifiedMember in $verifiedMembers) {
                if ([string]$verifiedMember.Identity -eq $addedMember.exchangeIdentity) {
                    $isVerified = $true
                    break
                }

                if ($addedMember.primaryEmail -and $verifiedMember.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and [string]$verifiedMember.PrimarySmtpAddress -eq $addedMember.primaryEmail) {
                    $isVerified = $true
                    break
                }
            }

            if ($isVerified) {
                $verifiedAdded++
            }
            else {
                foreach ($result in $results) {
                    if ($result.status -eq 'added' -and $result.member.exchangeIdentity -eq $addedMember.exchangeIdentity) {
                        $result.status = 'verificationFailed'
                        $result.detail = 'The member add was attempted, but verification did not confirm the membership.'
                    }
                }
            }
        }
    }

    $addedCount = @($results | Where-Object { $_.status -eq 'added' }).Count
    $alreadyMemberCount = @($results | Where-Object { $_.status -eq 'alreadyMember' }).Count
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
            added = $addedCount
            alreadyMember = $alreadyMemberCount
            invalid = $invalidCount
            verificationFailed = $verificationFailedCount
            failed = $failedCount
        }
        items = @($results)
        verification = @{
            attempted = $true
            verifiedAdded = $verifiedAdded
            detail = "Verified $verifiedAdded added member(s); $verificationFailedCount member(s) could not be confirmed."
        }
    }
}
