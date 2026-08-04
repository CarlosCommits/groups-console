$ErrorActionPreference = 'Stop'

try {
    . "$PSScriptRoot\..\commands\recipient-identity.ps1"
    . "$PSScriptRoot\..\commands\get-exchange-connection-status.ps1"
    . "$PSScriptRoot\..\commands\connect-exchange.ps1"
    . "$PSScriptRoot\..\commands\disconnect-exchange.ps1"
    . "$PSScriptRoot\..\commands\lookup-recipient-ownership.ps1"
    . "$PSScriptRoot\..\commands\resolve-guest-mail-user.ps1"
    . "$PSScriptRoot\..\commands\create-contact.ps1"
    . "$PSScriptRoot\..\commands\get-recipient-details.ps1"
    . "$PSScriptRoot\..\commands\get-contact-details.ps1"
    . "$PSScriptRoot\..\commands\update-contact-company.ps1"
    . "$PSScriptRoot\..\commands\add-group-member.ps1"
    . "$PSScriptRoot\..\commands\remove-group-member.ps1"
    . "$PSScriptRoot\..\commands\search-recipients.ps1"
    . "$PSScriptRoot\..\commands\get-groups.ps1"
    . "$PSScriptRoot\..\commands\get-group-members.ps1"
    . "$PSScriptRoot\..\commands\get-group-memberships.ps1"
    . "$PSScriptRoot\..\commands\export-report-data.ps1"

    Get-Command Invoke-GroupsConsoleGetGroupMemberships -ErrorAction Stop | Out-Null
}
catch {
    [Console]::Out.WriteLine((@{
        requestId = 'unknown-request'
        success = $false
        error = @{
            message = "Exchange session host bootstrap failed: $($_.Exception.Message)"
        }
    } | ConvertTo-Json -Compress -Depth 6))

    exit 1
}

$script:GroupsConsoleExchangeConnectionContext = $null
$script:GroupsConsoleCurrentRequestId = $null

function ConvertTo-GroupsConsoleHashtable {
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

function Write-GroupsConsoleProgress {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Phase,
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter(Mandatory = $false)]
        [Nullable[int]]$Percent
    )

    if ([string]::IsNullOrWhiteSpace($script:GroupsConsoleCurrentRequestId)) {
        return
    }

    $payload = @{
        requestId = $script:GroupsConsoleCurrentRequestId
        phase = $Phase
        message = $Message
    }

    if ($null -ne $Percent) {
        $payload.percent = $Percent
    }

    [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 6))
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $requestId = 'unknown-request'

    try {
        $request = $line | ConvertFrom-Json
        $requestId = [string]$request.requestId
        $script:GroupsConsoleCurrentRequestId = $requestId
        $command = [string]$request.command
        $payload = if ($request.PSObject.Properties.Name -contains 'payload') {
            ConvertTo-GroupsConsoleHashtable $request.payload
        }
        else {
            @{}
        }

        switch ($command) {
            'connect' {
                $data = Invoke-GroupsConsoleConnectExchange -Payload $payload
            }
            'getStatus' {
                $data = Get-GroupsConsoleExchangeConnectionStatus
            }
            'disconnect' {
                $data = Invoke-GroupsConsoleDisconnectExchange
            }
            'createContact' {
                $data = Invoke-GroupsConsoleCreateContact -Payload $payload
            }
            'getRecipientDetails' {
                $data = Invoke-GroupsConsoleGetRecipientDetails -Payload $payload
            }
            'getContactDetails' {
                $data = Invoke-GroupsConsoleGetContactDetails -Payload $payload
            }
            'lookupRecipientOwnership' {
                $data = Invoke-GroupsConsoleLookupRecipientOwnership -Payload $payload
            }
            'resolveGuestMailUser' {
                $data = Invoke-GroupsConsoleResolveGuestMailUser -Payload $payload
            }
            'updateContactCompany' {
                $data = Invoke-GroupsConsoleUpdateContactCompany -Payload $payload
            }
            'searchRecipients' {
                $data = Invoke-GroupsConsoleSearchRecipients -Payload $payload
            }
            'addGroupMembers' {
                $data = Invoke-GroupsConsoleAddGroupMembers -Payload $payload
            }
            'removeGroupMembers' {
                $data = Invoke-GroupsConsoleRemoveGroupMembers -Payload $payload
            }
            'listGroups' {
                $data = Invoke-GroupsConsoleListGroups -Payload $payload
            }
            'getGroupMembers' {
                $data = Invoke-GroupsConsoleGetGroupMembers -Payload $payload
            }
            'getGroupMemberships' {
                $data = Invoke-GroupsConsoleGetGroupMemberships -Payload $payload
            }
            'exportReportData' {
                $data = Invoke-GroupsConsoleExportReportData -Payload $payload
            }
            'shutdown' {
                $data = Invoke-GroupsConsoleDisconnectExchange

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
    finally {
        $script:GroupsConsoleCurrentRequestId = $null
    }
}
