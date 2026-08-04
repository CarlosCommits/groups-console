function Get-GroupsConsoleRecipientWriteIdentity {
    param(
        [Parameter(Mandatory = $true)]
        $Recipient
    )

    if ($Recipient.PSObject.Properties.Name -contains 'Guid' -and $Recipient.Guid) {
        return [string]$Recipient.Guid
    }

    if ($Recipient.PSObject.Properties.Name -contains 'DistinguishedName' -and $Recipient.DistinguishedName) {
        return [string]$Recipient.DistinguishedName
    }

    if ($Recipient.PSObject.Properties.Name -contains 'Identity' -and $Recipient.Identity) {
        return [string]$Recipient.Identity
    }

    throw 'The Exchange recipient does not expose a usable write identity.'
}
