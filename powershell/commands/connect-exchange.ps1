function Invoke-GroupsConsoleConnectExchange {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    $userPrincipalName = [string]$Payload.userPrincipalName

    if ([string]::IsNullOrWhiteSpace($userPrincipalName)) {
        throw 'A userPrincipalName is required for exchange.connect.'
    }

    if ($script:GroupsConsoleExchangeConnectionContext -and $script:GroupsConsoleExchangeConnectionContext.State -eq 'connected') {
        if ($script:GroupsConsoleExchangeConnectionContext.UserPrincipalName -eq $userPrincipalName) {
            return Get-GroupsConsoleExchangeConnectionStatus
        }

        throw "Exchange Online is already connected as $($script:GroupsConsoleExchangeConnectionContext.UserPrincipalName). Disconnect first before connecting as a different user."
    }

    $connectExchangeCommand = Get-Command Connect-ExchangeOnline -ErrorAction Stop
    $connectExchangeParameters = @{
        UserPrincipalName     = $userPrincipalName
        ShowBanner            = $false
        SkipLoadingFormatData = $true
    }

    if ($connectExchangeCommand.Parameters.ContainsKey('DisableWAM')) {
        $connectExchangeParameters.DisableWAM = $true
    }

    Connect-ExchangeOnline @connectExchangeParameters

    $connection = Get-ConnectionInformation -ErrorAction Stop | Select-Object -First 1

    if ($null -eq $connection) {
        throw 'Connect-ExchangeOnline completed without an active connection.'
    }

    $script:GroupsConsoleExchangeConnectionContext = @{
        State = 'connected'
        UserPrincipalName = $connection.UserPrincipalName
        ConnectionId = [string]$connection.ConnectionId
        TenantId = if ($connection.PSObject.Properties.Name -contains 'TenantId') { [string]$connection.TenantId } elseif ($connection.PSObject.Properties.Name -contains 'TenantID') { [string]$connection.TenantID } else { $null }
        TokenStatus = if ($connection.PSObject.Properties.Name -contains 'TokenStatus') { [string]$connection.TokenStatus } else { $null }
        TokenExpiryTimeUtc = if ($connection.PSObject.Properties.Name -contains 'TokenExpiryTimeUTC') { [string]$connection.TokenExpiryTimeUTC } else { $null }
        ConnectedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        Detail = 'Connected to Exchange Online.'
    }

    return Get-GroupsConsoleExchangeConnectionStatus
}
