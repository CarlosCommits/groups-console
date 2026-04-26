Describe 'PowerShell scaffold' {
    It 'loads the Exchange module placeholder path' {
        $modulePath = Join-Path $PSScriptRoot '..\modules\GroupsConsole.Exchange\GroupsConsole.Exchange.psm1'

        Test-Path $modulePath | Should -BeTrue
    }

    It 'loads the Validation module placeholder path' {
        $modulePath = Join-Path $PSScriptRoot '..\modules\GroupsConsole.Validation\GroupsConsole.Validation.psm1'

        Test-Path $modulePath | Should -BeTrue
    }
}
