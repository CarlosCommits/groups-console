Describe 'PowerShell scaffold' {
    It 'loads the Exchange module placeholder path' {
        $modulePath = Join-Path $PSScriptRoot '..\modules\RadApp.Exchange\RadApp.Exchange.psm1'

        Test-Path $modulePath | Should -BeTrue
    }

    It 'loads the Validation module placeholder path' {
        $modulePath = Join-Path $PSScriptRoot '..\modules\RadApp.Validation\RadApp.Validation.psm1'

        Test-Path $modulePath | Should -BeTrue
    }
}
