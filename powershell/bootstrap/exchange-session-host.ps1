. "$PSScriptRoot\..\commands\get-exchange-connection-status.ps1"
. "$PSScriptRoot\..\commands\connect-exchange.ps1"
. "$PSScriptRoot\..\commands\disconnect-exchange.ps1"
. "$PSScriptRoot\..\commands\create-contact.ps1"
. "$PSScriptRoot\..\commands\update-contact-company.ps1"
. "$PSScriptRoot\..\commands\add-group-member.ps1"
. "$PSScriptRoot\..\commands\remove-group-member.ps1"
. "$PSScriptRoot\..\commands\search-recipients.ps1"
. "$PSScriptRoot\..\commands\get-groups.ps1"
. "$PSScriptRoot\..\commands\get-group-members.ps1"

$ErrorActionPreference = 'Stop'
$script:RadAppExchangeConnectionContext = $null

function ConvertTo-RadAppHashtable {
    param(
        [Parameter(Mandatory = $false)]
        $Value
    )

    if ($null -eq $Value) {
        return @{}
    }

    if ($Value -is [hashtable]) {
        return $Value
    }

    $result = @{}
    foreach ($property in $Value.PSObject.Properties) {
        $result[$property.Name] = $property.Value
    }

    return $result
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $requestId = 'unknown-request'

    try {
        $request = $line | ConvertFrom-Json
        $requestId = [string]$request.requestId
        $command = [string]$request.command
        $payload = if ($request.PSObject.Properties.Name -contains 'payload') {
            ConvertTo-RadAppHashtable $request.payload
        }
        else {
            @{}
        }

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
            'createContact' {
                $data = Invoke-RadAppCreateContact -Payload $payload
            }
            'updateContactCompany' {
                $data = Invoke-RadAppUpdateContactCompany -Payload $payload
            }
            'searchRecipients' {
                $data = Invoke-RadAppSearchRecipients -Payload $payload
            }
            'addGroupMembers' {
                $data = Invoke-RadAppAddGroupMembers -Payload $payload
            }
            'removeGroupMembers' {
                $data = Invoke-RadAppRemoveGroupMembers -Payload $payload
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
