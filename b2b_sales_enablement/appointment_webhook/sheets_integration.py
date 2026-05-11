#!/usr/bin/env python3
"""
Google Sheets Integration for SuperPatch Appointments

Setup:
1. Go to Google Cloud Console
2. Create a project and enable Google Sheets API
3. Create a Service Account
4. Download the JSON key file
5. Share your Google Sheet with the service account email
6. Set GOOGLE_SHEETS_CREDENTIALS env var to the JSON file path
7. Set GOOGLE_SHEET_ID env var to your sheet ID
"""

import os
import json
from datetime import datetime

# Check if Google Sheets API is available
try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False
    print("Google Sheets API not installed. Run: pip install google-api-python-client google-auth-oauthlib")


SCOPES = ['https://www.googleapis.com/auth/spreadsheets']


def get_sheets_service():
    """Get authenticated Google Sheets service"""
    if not SHEETS_AVAILABLE:
        return None
    
    creds_file = os.environ.get('GOOGLE_SHEETS_CREDENTIALS')
    if not creds_file or not os.path.exists(creds_file):
        print("GOOGLE_SHEETS_CREDENTIALS not set or file not found")
        return None
    
    credentials = Credentials.from_service_account_file(creds_file, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=credentials)
    return service


def append_appointment_to_sheet(appointment_data: dict) -> bool:
    """
    Append appointment data to Google Sheet
    
    Args:
        appointment_data: Dict with appointment details
    
    Returns:
        True if successful, False otherwise
    """
    service = get_sheets_service()
    if not service:
        return False
    
    sheet_id = os.environ.get('GOOGLE_SHEET_ID')
    if not sheet_id:
        print("GOOGLE_SHEET_ID not set")
        return False
    
    # Prepare row data.
    # Prefer 'confirmation_number' (the key server.py sends); fall back to
    # 'confirmation' for any legacy callers.
    confirmation_value = (
        appointment_data.get('confirmation_number')
        or appointment_data.get('confirmation')
        or appointment_data.get('cal_booking_uid')
        or ''
    )
    row = [
        confirmation_value,
        datetime.now().isoformat(),
        appointment_data.get('practitioner_name', ''),
        appointment_data.get('practitioner_type', ''),
        appointment_data.get('practice_name', ''),
        appointment_data.get('phone_number', ''),
        appointment_data.get('email', ''),
        appointment_data.get('appointment_date', ''),
        appointment_data.get('appointment_time', ''),
        appointment_data.get('products_interested', ''),
        appointment_data.get('notes', ''),
        appointment_data.get('call_id', ''),
        'Scheduled'  # Status
    ]
    
    try:
        body = {'values': [row]}
        result = service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range='Appointments!A:M',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
        print(f"Appended {result.get('updates', {}).get('updatedCells', 0)} cells")
        return True
    except Exception as e:
        print(f"Error appending to sheet: {e}")
        return False


def get_appointments_from_sheet() -> list:
    """Get all appointments from Google Sheet"""
    service = get_sheets_service()
    if not service:
        return []
    
    sheet_id = os.environ.get('GOOGLE_SHEET_ID')
    if not sheet_id:
        return []
    
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range='Appointments!A:M'
        ).execute()
        
        rows = result.get('values', [])
        if len(rows) < 2:
            return []
        
        headers = rows[0]
        appointments = []
        for row in rows[1:]:
            appointment = {}
            for i, header in enumerate(headers):
                appointment[header] = row[i] if i < len(row) else ''
            appointments.append(appointment)
        
        return appointments
    except Exception as e:
        print(f"Error reading sheet: {e}")
        return []


# Example Google Sheet structure:
SHEET_HEADERS = [
    "Confirmation",
    "Timestamp", 
    "Name",
    "Type",
    "Practice",
    "Phone",
    "Email",
    "Date",
    "Time",
    "Products",
    "Notes",
    "Call ID",
    "Status"
]

if __name__ == "__main__":
    print("Google Sheets Integration Module")
    print(f"Sheets API Available: {SHEETS_AVAILABLE}")
    print(f"\nRequired environment variables:")
    print(f"  GOOGLE_SHEETS_CREDENTIALS: {os.environ.get('GOOGLE_SHEETS_CREDENTIALS', 'NOT SET')}")
    print(f"  GOOGLE_SHEET_ID: {os.environ.get('GOOGLE_SHEET_ID', 'NOT SET')}")
    print(f"\nSheet Headers: {SHEET_HEADERS}")
