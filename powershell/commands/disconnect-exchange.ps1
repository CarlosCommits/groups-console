function Invoke-GroupsConsoleDisconnectExchange {
    if (-not $script:GroupsConsoleExchangeConnectionContext) {
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
    $script:GroupsConsoleExchangeConnectionContext = $null

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
