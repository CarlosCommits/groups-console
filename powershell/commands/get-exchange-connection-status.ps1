function Get-GroupsConsoleExchangeConnectionStatus {
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

    $connection = Get-ConnectionInformation -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($null -eq $connection) {
        $script:GroupsConsoleExchangeConnectionContext = $null

        return @{
            state = 'disconnected'
            detail = 'The Exchange session is no longer available.'
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

    return @{
        state = 'connected'
        detail = $script:GroupsConsoleExchangeConnectionContext.Detail
        psVersion = $PSVersionTable.PSVersion.ToString()
        psEdition = $PSVersionTable.PSEdition
        userPrincipalName = if ($connection.PSObject.Properties.Name -contains 'UserPrincipalName') { [string]$connection.UserPrincipalName } else { $script:GroupsConsoleExchangeConnectionContext.UserPrincipalName }
        connectionId = if ($connection.PSObject.Properties.Name -contains 'ConnectionId') { [string]$connection.ConnectionId } else { $script:GroupsConsoleExchangeConnectionContext.ConnectionId }
        tenantId = if ($connection.PSObject.Properties.Name -contains 'TenantId') { [string]$connection.TenantId } elseif ($connection.PSObject.Properties.Name -contains 'TenantID') { [string]$connection.TenantID } else { $script:GroupsConsoleExchangeConnectionContext.TenantId }
        tokenStatus = if ($connection.PSObject.Properties.Name -contains 'TokenStatus') { [string]$connection.TokenStatus } else { $script:GroupsConsoleExchangeConnectionContext.TokenStatus }
        tokenExpiryTimeUtc = if ($connection.PSObject.Properties.Name -contains 'TokenExpiryTimeUTC') { [string]$connection.TokenExpiryTimeUTC } else { $script:GroupsConsoleExchangeConnectionContext.TokenExpiryTimeUtc }
        connectedAtUtc = $script:GroupsConsoleExchangeConnectionContext.ConnectedAtUtc
    }
}
