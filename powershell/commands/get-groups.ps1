function Invoke-GroupsConsoleListGroups {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:GroupsConsoleExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before listing groups.'
    }

    $kind = if ($Payload.ContainsKey('kind') -and -not [string]::IsNullOrWhiteSpace([string]$Payload.kind)) {
        [string]$Payload.kind
    }
    else {
        'all'
    }

    $filter = $null

    switch ($kind) {
        'distributionList' {
            $filter = "RecipientTypeDetails -eq 'MailUniversalDistributionGroup'"
        }
        'mailEnabledSecurityGroup' {
            $filter = "RecipientTypeDetails -eq 'MailUniversalSecurityGroup'"
        }
        'all' {
            $filter = "RecipientTypeDetails -eq 'MailUniversalDistributionGroup' -or RecipientTypeDetails -eq 'MailUniversalSecurityGroup'"
        }
        default {
            throw "Unsupported group listing kind: $kind"
        }
    }

    $groups = Get-DistributionGroup -ResultSize Unlimited -Filter $filter -IncludeManagedByWithDisplayNames |
        Sort-Object DisplayName

    $items = @(
        foreach ($group in $groups) {
            $groupKind = switch ($group.RecipientTypeDetails.ToString()) {
                'MailUniversalSecurityGroup' { 'mailEnabledSecurityGroup' }
                default { 'distributionList' }
            }

            $objectId = if ($group.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $group.ExternalDirectoryObjectId) {
                [string]$group.ExternalDirectoryObjectId
            }
            elseif ($group.PSObject.Properties.Name -contains 'Guid' -and $group.Guid) {
                [string]$group.Guid
            }
            else {
                $null
            }

            $whenChangedUtc = $null
            if ($group.PSObject.Properties.Name -contains 'WhenChangedUTC' -and $group.WhenChangedUTC) {
                $whenChangedUtc = ([datetime]$group.WhenChangedUTC).ToUniversalTime().ToString('o')
            }
            elseif ($group.PSObject.Properties.Name -contains 'WhenChanged' -and $group.WhenChanged) {
                $whenChangedUtc = ([datetime]$group.WhenChanged).ToUniversalTime().ToString('o')
            }

            @{
                objectId = $objectId
                exchangeIdentity = [string]$group.Identity
                displayName = [string]$group.DisplayName
                alias = if ($group.Alias) { [string]$group.Alias } else { $null }
                primaryEmail = if ($group.PrimarySmtpAddress) { [string]$group.PrimarySmtpAddress } else { $null }
                groupKind = $groupKind
                managedByDisplayNames = @($group.ManagedBy | ForEach-Object { [string]$_ })
                whenChangedUtc = $whenChangedUtc
            }
        }
    )

    return @{
        appliedKind = $kind
        items = $items
    }
}
