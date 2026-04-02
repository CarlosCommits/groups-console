# ASCII Title and Module Checks
$asciiTitle = @"
______  ___ ______    ___  ____________ 
| ___ \/ _ \|  _  \  / _ \ | ___ \ ___ \
| |_/ / /_\ \ | | | / /_\ \| |_/ / |_/ /
|    /|  _  | | | | |  _  ||  __/|  __/ 
| |\ \| | | | |/ /  | | | || |   | |    
\_| \_\_| |_/___/   \_| |_/\_|   \_|                                                                                    


"@

Write-Host $asciiTitle
Write-Host "Welcome to Groups Console - Your Office 365 Exchange Administration Tool"

# Change execution policy
Write-Host "`nChecking and setting execution policy..."
if ((Get-ExecutionPolicy -Scope CurrentUser) -ne 'RemoteSigned') {
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
}

# Check if exchange online module is installed and install if it is not
Write-Host "Checking ExchangeOnlineManagement module..."
if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
    Write-Host "Installing ExchangeOnlineManagement module..."
    Install-Module -Name ExchangeOnlineManagement -AllowClobber -Scope CurrentUser -Force
}

# Check if ImportExcel module is installed and install if it is not
Write-Host "Checking ImportExcel module..."
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Host "Installing ImportExcel module..."
    Install-Module -Name ImportExcel -Scope CurrentUser -Force
}

# Prompt for email
$email = Read-Host "`nPlease enter your email to sign in and get started"

# Connect to Exchange Online
Write-Host "Connecting to Exchange Online..."
Connect-ExchangeOnline -UserPrincipalName $email -ShowProgress $true

# Menu options
function Show-Menu {
    param (
        [string]$title = 'Menu'
    )
    Write-Host "================ $title ================"
    Write-Host "1. Distribution List Report"
    Write-Host "2. Add Contact to Multiple Distribution Lists"
    Write-Host "3. Add New Contact"
    Write-Host "4. Add 'Company' name to Contacts"
    Write-Host "5. Exit"
    Write-Host "========================================"
}

# Functions for each task

function ExchangeDistListReport {
    Write-Host "Distribution List Report Script..."
    # Retrieve all distribution groups and their members
    Write-Host "Retrieving distribution lists..."
    $distLists = Get-DistributionGroup -ResultSize Unlimited
    $distListMembers = @{}

    foreach ($list in $distLists) {
        Write-Host "Processing members for distribution list: $($list.DisplayName)..."
        $members = Get-DistributionGroupMember -Identity $list.Identity
        foreach ($member in $members) {
            if (-not $distListMembers.ContainsKey($member.PrimarySmtpAddress)) {
                $distListMembers[$member.PrimarySmtpAddress] = @()
            }
            $distListMembers[$member.PrimarySmtpAddress] += $list.DisplayName
        }
    }

    # Retrieve and process contacts and mail users
    Write-Host "Starting retrieval of mail users and contacts..."

    $contacts = Get-MailContact -ResultSize Unlimited
    $mailboxes = Get-Mailbox -ResultSize Unlimited

    # Retrieve all contacts with the Company attribute from AD
    $adContacts = Get-Contact -ResultSize Unlimited | Select-Object DisplayName, WindowsEmailAddress, Company

    # Combine mail contacts with AD contacts to get the Company attribute
    $combinedContacts = foreach ($mailContact in $contacts) {
        $adContact = $adContacts | Where-Object { $_.WindowsEmailAddress -eq $mailContact.PrimarySmtpAddress }
        if ($adContact) {
            $mailContact | Add-Member -NotePropertyName Company -NotePropertyValue $adContact.Company -Force
        }
        $mailContact
    }

    # Now $combinedContacts has all mail contacts with Company information where available


    # Replace the original line with this
    $allUsersAndContacts = $combinedContacts + $mailboxes  # Combine both sets

    # $allUsersAndContacts = $contacts + $mailboxes  # Combine both sets
    $results = @()

    Write-Host "Retrieved $($allUsersAndContacts.Count) users and contacts."

    $totalItems = $allUsersAndContacts.Count
    $counter = 0

    foreach ($userOrContact in $allUsersAndContacts) {

        $counter++
        $percentComplete = [math]::Round(($counter / $totalItems) * 100, 0)
        Write-Progress -Activity "Processing users and contacts" -Status "$counter out of $totalItems completed" -PercentComplete $percentComplete

        #Write-Host "Processing user/contact: $($userOrContact.DisplayName) with email: $($userOrContact.PrimarySmtpAddress)..."

        $obj = [PSCustomObject]@{
            'ContactName' = $userOrContact.DisplayName
            'ContactEmail' = $userOrContact.PrimarySmtpAddress
            'Company' = $userOrContact.Company
        }

        foreach ($list in $distLists) {
            $isMember = $distListMembers[$userOrContact.PrimarySmtpAddress] -contains $list.DisplayName
            if ($isMember) {
                #Write-Host "`tUser/Contact is a member of distribution group: $($list.DisplayName)."
            }
            $obj | Add-Member -NotePropertyName $list.DisplayName -NotePropertyValue $(if($isMember){"X"} else {""})
        }

        $results += $obj
    }

     # Get the current date and format it
     $date = Get-Date -Format "yyyy-MM-dd"

    # Display and export to CSV
    Write-Host "Exporting results to Excel..."
    $filePath = "DistributionListReport_$date.xlsx"
    $results | Export-Excel -Path $filePath -AutoSize -AutoFilter -TableName "DistributionLists"
    

    Write-Host "`nScript completed! -- the excel file is located in the same folder as this script.`n"
}


function AddUserToGroups {   
    Write-Host "This script will allow you to add a contact to multiple distribution lists.`nNote you have to hold the 'Ctrl' key when selecting the lists, then click 'OK' on the bottom right corner `n"
    function Get-ValidRecipient {
        do {
            # Ask for the recipient email address
            $recipientEmail = Read-Host "Please enter the recipient email address"
            # Try to get a Mail Contact
            $recipient = Get-MailContact -Identity $recipientEmail -ErrorAction SilentlyContinue
            # If not a Mail Contact, try to get a Mailbox User
            if (-not $recipient) {
                $recipient = Get-Mailbox -Identity $recipientEmail -ErrorAction SilentlyContinue
            }
            if (-not $recipient) {
                Write-Host "No contact or mailbox user found with the email $recipientEmail. Please try again."
            }
        } while (-not $recipient)
        return $recipient
    }
    
    # Retrieve the valid recipient
    $validRecipient = Get-ValidRecipient
    
    # Retrieve all distribution groups
    $distGroups = Get-DistributionGroup -ResultSize Unlimited
    Write-Host "Retrieved $($distGroups.Count) distribution lists. -- Please select which lists you would like to add this contact to"
    
    # Display distribution groups and let the user select which to add the recipient to
    $selectedGroups = $distGroups | Out-GridView -Title "Select distribution lists to add the recipient to" -PassThru
    
    # Track added groups for the email message
    $addedGroups = @()
    
    # Add the recipient to the selected distribution groups
    foreach ($group in $selectedGroups) {
        # Check if the recipient is already a member of the distribution group
        $isAlreadyMember = $null -ne (Get-DistributionGroupMember -Identity $group.Identity | Where-Object { $_.PrimarySmtpAddress -eq $validRecipient.PrimarySmtpAddress })
        if ($isAlreadyMember) {
            Write-Host "Recipient $($validRecipient.PrimarySmtpAddress) is already a member of $($group.DisplayName)."
        } else {
            try {
                Add-DistributionGroupMember -Identity $group.Identity -Member $validRecipient.PrimarySmtpAddress
                Write-Host "Successfully added $($validRecipient.PrimarySmtpAddress) to $($group.DisplayName)."
                $addedGroups += $group.DisplayName
            } catch {
                Write-Host "An error occurred adding $($validRecipient.PrimarySmtpAddress) to $($group.DisplayName): $_"
            }
        }
    }
    
    # Option to send an email with the added groups
    if ($addedGroups.Count -gt 0) {
        $sendEmail = Read-Host "Do you want to create an email to the user with the added groups? (y/n)"
        if ($sendEmail -eq 'y') {
            #$fromEmail = $email  # Your logged-in email
            $toEmail = $validRecipient.PrimarySmtpAddress
            $subject = "You have been added to new ESA distribution groups"
            
            # Create plain text table
            $plainTextTable = "Distribution Lists`n-------------------`n"
            foreach ($group in $addedGroups) {
                $plainTextTable += "$group`n"
            }
            
            $body = "Hello $($validRecipient.DisplayName),`n`nYou have been added to the following distribution lists:`n`n$plainTextTable`n`nPlease note, this is an automated message.`n"

            # Construct the mailto link without encoding spaces as '+'
            $mailtoLink = "mailto:($toEmail)?Subject=$([uri]::EscapeDataString($subject))&body=$([uri]::EscapeDataString($body))"

            # Launch the mailto link
            Start-Process $mailtoLink
            
            Write-Host "A new email has been created. Please review and send the email."
        }
    }
    
    Write-Host "Script completed!"
}


function AddNewContact {
    Write-Host "Add New Contact to Address Book"
    
    # Prompt for contact details
    $firstName = Read-Host "Please enter the first name"
    $lastName = Read-Host "Please enter the last name"
    $email = Read-Host "Please enter the email address"
    $company = Read-Host "Please enter the company name"

    # Check if the contact already exists
    $existingMailContact = Get-MailContact -Filter "EmailAddresses -eq 'SMTP:$email'" -ErrorAction SilentlyContinue
    $existingADContact = Get-Contact -Filter "EmailAddresses -eq 'SMTP:$email'" -ErrorAction SilentlyContinue

    if ($existingMailContact -or $existingADContact) {
        Write-Host "`nA contact with the email address $email already exists.`n"
        return
    }

    # Add new contact
    try {
        New-MailContact -Name "$firstName $lastName" -DisplayName "$firstName $lastName" -FirstName $firstName -LastName $lastName -ExternalEmailAddress $email
        Write-Host "`nContact $firstName $lastName with email $email added successfully.`n"

        # Set the company attribute
        Set-Contact -Identity $email -Company $company -ErrorAction SilentlyContinue 
    } catch {
        Write-Host "An error occurred while adding the new contact: $_"
    }
}

function UpdateCompany {
    # Prompt the user at the start of the script
    Write-Host "`n`nThis function will scan the 'company' column of an existing DistributionList excel file and upload any new data found.`nNote, it will not replace any existing data if a 'Company' was already entered for the contact.`n`nPress 'Enter' to open file explorer and select the DistributionList Excel file."
    Read-Host

    # Install and import the required modules
    if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
        Install-Module -Name ImportExcel -Scope CurrentUser -Force
    }
    Import-Module ImportExcel

    # Function to open file dialog and get the selected file path
    function Get-OpenFileDialog {
        [System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms") | Out-Null
        $OpenFileDialog = New-Object System.Windows.Forms.OpenFileDialog
        $OpenFileDialog.InitialDirectory = [System.Environment]::GetFolderPath('Desktop')
        $OpenFileDialog.Filter = "Excel files (*.xlsx)|*.xlsx|All files (*.*)|*.*"
        $OpenFileDialog.FilterIndex = 1
        $OpenFileDialog.Multiselect = $false

        if ($OpenFileDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            return $OpenFileDialog.FileName
        } else {
            Write-Host "No file selected. Exiting script."
            exit
        }
    }

    # Get the selected file path
    $excelPath = Get-OpenFileDialog

    # Read contacts from the Excel file
    $excelData = Import-Excel -Path $excelPath

    # Initialize a counter for updated 'Company' fields
    $updatedCount = 0

    # Process each row in the Excel data
    foreach ($row in $excelData) {
        $contactEmail = $row.ContactEmail
        $company = $row.company

        # Check if the company field in the Excel sheet is not blank
        if ([string]::IsNullOrEmpty($company)) {
            continue
        }

        # Retrieve the contact to check if the 'Company' field already exists
        $contact = Get-Contact -Identity $contactEmail -ErrorAction SilentlyContinue

        if ($contact -and ($null -eq $contact.company -or $contact.company -eq "")) {
            # If 'Company' field is not set, update it
            Set-Contact -Identity $contactEmail -Company $company -ErrorAction SilentlyContinue
            Write-Host "Updated 'Company' for $contactEmail to '$company'."
            $updatedCount++
        }
        # Removed the else statement to avoid unnecessary output
    }

    # Display the total number of 'Company' fields updated
    Write-Host "$updatedCount 'Company' field(s) were updated.`n`n"

}


# Main program loop
do {
    Show-Menu
    $selection = Read-Host "Please select an option"
    switch ($selection) {
        1 { ExchangeDistListReport }
        2 { AddUserToGroups }
        3 {AddNewContact}
        4 {UpdateCompany}
        5 { Write-Host "`nExiting..."; break }
        default { Write-Host "Invalid selection. Please try again." }
    }
} while ($selection -ne 5)

# Disconnect from Exchange Online
Write-Host "Disconnecting from Exchange Online..."
Disconnect-ExchangeOnline -Confirm:$false


Write-Host "Thank you for using Groups Console!`n"
Read-Host
