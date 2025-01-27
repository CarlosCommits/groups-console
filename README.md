# RAD APP - Office 365 Exchange Distribution List Manager

```
______  ___ ______    ___  ____________ 
| ___ \/ _ \|  _  \  / _ \ | ___ \ ___ \
| |_/ / /_\ \ | | | / /_\ \| |_/ / |_/ /
|    /|  _  | | | | |  _  ||  __/|  __/ 
| |\ \| | | | |/ /  | | | || |   | |    
\_| \_\_| |_/___/   \_| |_/\_|   \_|    
```

## Overview

RAD APP is a PowerShell-based tool designed to simplify the management of Office 365 Exchange Distribution Lists. It provides an intuitive interface for managing distribution lists, contacts, and group memberships within your Office 365 environment.

## Features

- Generate comprehensive distribution list reports
- Add contacts to multiple distribution lists simultaneously
- Create new contacts in the address book
- Update company information for existing contacts
- Export distribution list data to Excel

## Prerequisites

- Windows PowerShell 5.1 or later
- Office 365 account with appropriate Exchange Online management permissions
- Internet connection

## Required PowerShell Modules

The script will automatically install these modules if they're not present:
- ExchangeOnlineManagement
- ImportExcel

## Installation & Setup

1. Download the `RAD app.ps1` script to your local machine
2. Open PowerShell as an administrator
3. Navigate to the directory containing the script
4. Run the script:
   ```powershell
   .\RAD app.ps1
   ```

The script will automatically:
- Set the appropriate execution policy
- Install required PowerShell modules
- Connect to Exchange Online using your credentials

## Usage Guide

### 1. Distribution List Report
Generates a comprehensive Excel report containing:
- All distribution lists
- List members
- Contact information
- Company affiliations

**Output**: Creates an Excel file named `DistributionListReport_[date].xlsx` in the script's directory

### 2. Add Contact to Multiple Distribution Lists
Allows you to:
- Select a contact by email address
- Choose multiple distribution lists using a grid view
- Optionally send an email notification to the contact

**Note**: Hold the Ctrl key to select multiple distribution lists in the grid view

### 3. Add New Contact
Creates a new contact in the address book with:
- First name
- Last name
- Email address
- Company name

The script prevents duplicate contacts by checking existing entries

### 4. Add 'Company' Name to Contacts
Updates company information for contacts by:
- Reading from an existing Distribution List Excel file
- Updating only empty company fields
- Preserving existing company information

## Troubleshooting

### Common Issues and Solutions

1. **Execution Policy Error**
   - The script automatically sets the execution policy to RemoteSigned
   - If you encounter issues, manually run:
     ```powershell
     Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
     ```

2. **Module Installation Failures**
   - Ensure you have internet connectivity
   - Run PowerShell as administrator
   - Manually install modules if needed:
     ```powershell
     Install-Module ExchangeOnlineManagement -Force
     Install-Module ImportExcel -Force
     ```

3. **Connection Issues**
   - Verify your Office 365 credentials
   - Ensure you have appropriate Exchange Online permissions
   - Check your internet connection

4. **Excel Export Errors**
   - Ensure Excel is not running while generating reports
   - Verify you have write permissions in the script's directory

## Best Practices

1. Run regular distribution list reports to maintain accurate records
2. Review changes before confirming any modifications
3. Keep the Excel reports for audit purposes
4. Verify contact information before adding new entries

## Security Note

- The script requires Office 365 authentication
- All operations are logged and traceable
- No passwords are stored locally

## Support

If you encounter issues:
1. Verify prerequisites are met
2. Check the troubleshooting section
3. Review the error messages in the PowerShell console
4. Ensure you're using the latest version of the script

## Exiting the Application

- Select option 5 from the main menu
- The script will automatically disconnect from Exchange Online
- Wait for the "Thank you for using RAD APP!" message before closing the window
