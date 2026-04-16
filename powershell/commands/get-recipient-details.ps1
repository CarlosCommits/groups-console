function Invoke-RadAppGetRecipientDetails {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $script:RadAppExchangeConnectionContext) {
        throw 'No active Exchange session. Connect to Exchange Online before reading recipient details.'
    }

    $exchangeIdentity = if ($Payload.ContainsKey('exchangeIdentity')) { [string]$Payload.exchangeIdentity } else { '' }
    if ([string]::IsNullOrWhiteSpace($exchangeIdentity)) {
        throw 'exchangeIdentity is required for exchange.getRecipientDetails.'
    }

    $recipient = Get-Recipient -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1
    $recipientTypeDetails = [string]$recipient.RecipientTypeDetails

    $recipientType = switch ($recipientTypeDetails) {
        'MailUser' { 'mailUser' }
        'UserMailbox' { 'mailbox' }
        'SharedMailbox' { 'mailbox' }
        'RoomMailbox' { 'mailbox' }
        'EquipmentMailbox' { 'mailbox' }
        default {
            throw 'Recipient details are only available for mailbox and mail user entries.'
        }
    }

    $mailRecipient = if ($recipientType -eq 'mailUser') {
        Get-MailUser -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1
    }
    else {
        Get-Mailbox -Identity $exchangeIdentity -ErrorAction Stop | Select-Object -First 1
    }
    $user = Get-User -Identity $exchangeIdentity -ErrorAction SilentlyContinue | Select-Object -First 1

    $objectId = if ($recipient.PSObject.Properties.Name -contains 'ExternalDirectoryObjectId' -and $recipient.ExternalDirectoryObjectId) {
        [string]$recipient.ExternalDirectoryObjectId
    }
    elseif ($recipient.PSObject.Properties.Name -contains 'Guid' -and $recipient.Guid) {
        [string]$recipient.Guid
    }
    else {
        $null
    }

    $externalEmailAddress = if ($recipientType -eq 'mailUser' -and $mailRecipient.PSObject.Properties.Name -contains 'ExternalEmailAddress' -and $mailRecipient.ExternalEmailAddress) {
        $normalizedExternalEmail = Get-RadAppNormalizedExternalEmailAddress -MailContact $mailRecipient
        if ($normalizedExternalEmail) { $normalizedExternalEmail } else { $null }
    }
    else {
        $null
    }

    $primaryEmail = if ($mailRecipient.PSObject.Properties.Name -contains 'PrimarySmtpAddress' -and $mailRecipient.PrimarySmtpAddress) {
        [string]$mailRecipient.PrimarySmtpAddress
    }
    elseif ($mailRecipient.PSObject.Properties.Name -contains 'WindowsEmailAddress' -and $mailRecipient.WindowsEmailAddress) {
        [string]$mailRecipient.WindowsEmailAddress
    }
    else {
        $null
    }

    $userPrincipalName = if ($mailRecipient.PSObject.Properties.Name -contains 'UserPrincipalName' -and $mailRecipient.UserPrincipalName) {
        [string]$mailRecipient.UserPrincipalName
    }
    elseif ($user -and $user.PSObject.Properties.Name -contains 'UserPrincipalName' -and $user.UserPrincipalName) {
        [string]$user.UserPrincipalName
    }
    else {
        $null
    }

    return @{
        recipient = @{
            exchangeIdentity = [string]$recipient.Identity
            objectId = $objectId
            primaryEmail = $primaryEmail
            externalEmailAddress = $externalEmailAddress
            displayName = if ($recipient.DisplayName) { [string]$recipient.DisplayName } else { [string]$recipient.Identity }
            alias = if ($recipient.Alias) { [string]$recipient.Alias } else { $null }
            companyName = if ($user -and $user.Company) { [string]$user.Company } else { $null }
            firstName = if ($user -and $user.FirstName) { [string]$user.FirstName } else { $null }
            lastName = if ($user -and $user.LastName) { [string]$user.LastName } else { $null }
            title = if ($user -and $user.Title) { [string]$user.Title } else { $null }
            department = if ($user -and $user.Department) { [string]$user.Department } else { $null }
            phone = if ($user -and $user.Phone) { [string]$user.Phone } else { $null }
            office = if ($user -and $user.Office) { [string]$user.Office } else { $null }
            userPrincipalName = $userPrincipalName
            recipientType = $recipientType
            recipientTypeDetails = $recipientTypeDetails
        }
    }
}
