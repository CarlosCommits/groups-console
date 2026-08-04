$ErrorActionPreference = 'Stop'

$requiredVersion = [version]'5.7.1'
$pesterModule = Get-Module -ListAvailable -Name Pester |
    Where-Object { $_.Version -eq $requiredVersion } |
    Select-Object -First 1

if ($null -eq $pesterModule) {
    throw "Pester $requiredVersion is required. Install it with: Install-Module -Name Pester -RequiredVersion $requiredVersion -Scope CurrentUser -Force -SkipPublisherCheck"
}

Import-Module $pesterModule.Path -Force -ErrorAction Stop

$testPath = Join-Path $PSScriptRoot '..\powershell\tests'
$result = Invoke-Pester -Path $testPath -Output Detailed -PassThru

if ($result.Result -ne 'Passed') {
    exit 1
}
