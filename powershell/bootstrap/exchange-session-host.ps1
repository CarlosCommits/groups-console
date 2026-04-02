. "$PSScriptRoot\..\commands\get-exchange-connection-status.ps1"
. "$PSScriptRoot\..\commands\connect-exchange.ps1"
. "$PSScriptRoot\..\commands\disconnect-exchange.ps1"
. "$PSScriptRoot\..\commands\get-groups.ps1"
. "$PSScriptRoot\..\commands\get-group-members.ps1"

$ErrorActionPreference = 'Stop'
$script:RadAppExchangeConnectionContext = $null

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $requestId = 'unknown-request'

    try {
        $request = $line | ConvertFrom-Json -AsHashtable
        $requestId = [string]$request.requestId
        $command = [string]$request.command
        $payload = if ($request.ContainsKey('payload')) { $request.payload } else { @{} }

        switch ($command) {
            'connect' {
                $data = Invoke-RadAppConnectExchange -Payload $payload
            }
            'getStatus' {
                $data = Get-RadAppExchangeConnectionStatus
            }
            'disconnect' {
                $data = Invoke-RadAppDisconnectExchange
            }
            'listGroups' {
                $data = Invoke-RadAppListGroups -Payload $payload
            }
            'getGroupMembers' {
                $data = Invoke-RadAppGetGroupMembers -Payload $payload
            }
            'shutdown' {
                $data = Invoke-RadAppDisconnectExchange

                @{
                    requestId = $requestId
                    success = $true
                    data = $data
                } | ConvertTo-Json -Compress -Depth 6
                break
            }
            default {
                throw "Unknown Exchange session host command: $command"
            }
        }

        @{
            requestId = $requestId
            success = $true
            data = $data
        } | ConvertTo-Json -Compress -Depth 6
    }
    catch {
        @{
            requestId = $requestId
            success = $false
            error = @{
                message = $_.Exception.Message
            }
        } | ConvertTo-Json -Compress -Depth 6
    }
}
