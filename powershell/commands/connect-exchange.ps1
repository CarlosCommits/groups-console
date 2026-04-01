function Invoke-RadAppConnectExchange {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    $userPrincipalName = [string]$Payload.userPrincipalName

    if ([string]::IsNullOrWhiteSpace($userPrincipalName)) {
        throw 'A userPrincipalName is required for exchange.connect.'
    }

    if ($script:RadAppExchangeConnectionContext -and $script:RadAppExchangeConnectionContext.State -eq 'connected') {
        if ($script:RadAppExchangeConnectionContext.UserPrincipalName -eq $userPrincipalName) {
            return Get-RadAppExchangeConnectionStatus
        }

        throw "Exchange Online is already connected as $($script:RadAppExchangeConnectionContext.UserPrincipalName). Disconnect first before connecting as a different user."
    }

    Connect-ExchangeOnline `
        -UserPrincipalName $userPrincipalName `
        -ShowBanner:$false `
        -SkipLoadingFormatData `
        -DisableWAM

    $connection = Get-ConnectionInformation -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $connection) {
        throw 'Connect-ExchangeOnline completed without an active connection.'
    }

    $script:RadAppExchangeConnectionContext = @{
        State = 'connected'
        UserPrincipalName = $connection.UserPrincipalName
        ConnectionId = [string]$connection.ConnectionId
        TenantId = if ($connection.PSObject.Properties.Name -contains 'TenantId') { [string]$connection.TenantId } elseif ($connection.PSObject.Properties.Name -contains 'TenantID') { [string]$connection.TenantID } else { $null }
        TokenStatus = if ($connection.PSObject.Properties.Name -contains 'TokenStatus') { [string]$connection.TokenStatus } else { $null }
        TokenExpiryTimeUtc = if ($connection.PSObject.Properties.Name -contains 'TokenExpiryTimeUTC') { [string]$connection.TokenExpiryTimeUTC } else { $null }
        ConnectedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        Detail = 'Connected to Exchange Online.'
    }

    return Get-RadAppExchangeConnectionStatus
}
