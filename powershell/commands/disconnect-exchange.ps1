function Invoke-RadAppDisconnectExchange {
    if (-not $script:RadAppExchangeConnectionContext) {
        return @{
            state = 'disconnected'
            detail = 'No active Exchange session.'
            psVersion = $PSVersionTable.PSVersion.ToString()
            psEdition = $PSVersionTable.PSEdition
            userPrincipalName = $null
            connectionId = $null
            tenantId = $null
            tokenStatus = $null
            tokenExpiryTimeUtc = $null
            connectedAtUtc = $null
        }
    }

    Disconnect-ExchangeOnline -Confirm:$false
    $script:RadAppExchangeConnectionContext = $null

    return @{
        state = 'disconnected'
        detail = 'Disconnected from Exchange Online.'
        psVersion = $PSVersionTable.PSVersion.ToString()
        psEdition = $PSVersionTable.PSEdition
        userPrincipalName = $null
        connectionId = $null
        tenantId = $null
        tokenStatus = $null
        tokenExpiryTimeUtc = $null
        connectedAtUtc = $null
    }
}
