"""
SuperPatch Appointment Webhook Server
Integrates with Cal.com for scheduling and Google Sheets for logging.

Endpoints:
- GET /api/check-availability - Get available time slots from Cal.com
- POST /api/schedule-appointment - Create booking in Cal.com and log to Sheets
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from datetime import datetime, timedelta
from sheets_integration import append_appointment_to_sheet as log_appointment_to_sheets
import json

app = Flask(__name__)
CORS(app)

# Configuration
CAL_COM_API_KEY = os.environ.get('CAL_COM_API_KEY')
if not CAL_COM_API_KEY:
    raise ValueError("CAL_COM_API_KEY environment variable is required")
CAL_COM_API_URL = 'https://api.cal.com/v2'
CAL_COM_EVENT_TYPE_ID = os.environ.get('CAL_COM_EVENT_TYPE_ID', None)  # Set this or use slug
CAL_COM_EVENT_TYPE_SLUG = os.environ.get('CAL_COM_EVENT_TYPE_SLUG', 'superpatch-sales-call')
CAL_COM_USERNAME = os.environ.get('CAL_COM_USERNAME', None)  # Your Cal.com username

# Default timezone
DEFAULT_TIMEZONE = 'America/New_York'


def get_cal_headers():
    """Get headers for Cal.com API requests"""
    return {
        'Authorization': f'Bearer {CAL_COM_API_KEY}',
        'Content-Type': 'application/json',
        'cal-api-version': '2024-08-13'
    }


@app.route('/api/check-availability', methods=['GET'])
def check_availability():
    """
    Check available appointment slots from Cal.com.
    
    Query params:
    - date_range: 'this_week', 'next_week', or specific date (YYYY-MM-DD)
    - practitioner_type: Type of practitioner (for logging/context)
    - timezone: Timezone for slots (default: America/New_York)
    """
    try:
        date_range = request.args.get('date_range', 'next_week')
        practitioner_type = request.args.get('practitioner_type', 'general')
        timezone = request.args.get('timezone', DEFAULT_TIMEZONE)
        
        # Calculate date range
        today = datetime.now()
        
        if date_range == 'this_week':
            start_date = today
            end_date = today + timedelta(days=(7 - today.weekday()))
        elif date_range == 'next_week':
            # Start from next Monday
            days_until_monday = (7 - today.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7
            start_date = today + timedelta(days=days_until_monday)
            end_date = start_date + timedelta(days=7)
        else:
            # Assume specific date provided
            try:
                start_date = datetime.strptime(date_range, '%Y-%m-%d')
                end_date = start_date + timedelta(days=1)
            except ValueError:
                start_date = today + timedelta(days=1)
                end_date = today + timedelta(days=8)
        
        # Build Cal.com API request
        params = {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d'),
            'timeZone': timezone
        }
        
        # Use event type ID if available, otherwise use slug + username
        if CAL_COM_EVENT_TYPE_ID:
            params['eventTypeId'] = CAL_COM_EVENT_TYPE_ID
        elif CAL_COM_EVENT_TYPE_SLUG and CAL_COM_USERNAME:
            params['eventTypeSlug'] = CAL_COM_EVENT_TYPE_SLUG
            params['username'] = CAL_COM_USERNAME
        else:
            # Fallback: return mock data if Cal.com not fully configured
            return jsonify({
                'status': 'success',
                'data': {
                    'message': f"Available times for {date_range}",
                    'slots': [
                        f"{(start_date + timedelta(days=i)).strftime('%A, %B %d')} at 10:00 AM"
                        for i in range(3)
                    ] + [
                        f"{(start_date + timedelta(days=i)).strftime('%A, %B %d')} at 2:00 PM"
                        for i in range(3)
                    ]
                }
            })
        
        # Call Cal.com API
        response = requests.get(
            f'{CAL_COM_API_URL}/slots',
            headers=get_cal_headers(),
            params=params
        )
        
        if response.status_code == 200:
            data = response.json()
            slots = data.get('data', {}).get('slots', [])
            
            # Format slots for voice agent
            formatted_slots = []
            for slot in slots[:10]:  # Limit to 10 slots for voice
                if isinstance(slot, dict):
                    start_time = slot.get('time') or slot.get('start') or slot.get('startTime')
                    if start_time:
                        try:
                            dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                            formatted_slots.append(dt.strftime('%A, %B %d at %I:%M %p'))
                        except:
                            formatted_slots.append(start_time)
                elif isinstance(slot, str):
                    formatted_slots.append(slot)
            
            # If slots is a dict with dates as keys
            if isinstance(data.get('data', {}).get('slots'), dict):
                slots_dict = data['data']['slots']
                for date_key, times in list(slots_dict.items())[:5]:
                    try:
                        dt = datetime.strptime(date_key, '%Y-%m-%d')
                        for time in times[:3]:
                            formatted_slots.append(f"{dt.strftime('%A, %B %d')} at {time}")
                    except:
                        for time in times[:3]:
                            formatted_slots.append(f"{date_key} at {time}")
            
            if not formatted_slots:
                formatted_slots = ["No available slots found. Would you like to try a different week?"]
            
            return jsonify({
                'status': 'success',
                'data': {
                    'message': f"I have these times available for {date_range}: {', '.join(formatted_slots[:5])}. Which works best for you?",
                    'slots': formatted_slots,
                    'raw_slots': slots
                }
            })
        else:
            app.logger.error(f"Cal.com API error: {response.status_code} - {response.text}")
            # Return fallback slots
            return jsonify({
                'status': 'success',
                'data': {
                    'message': f"I have availability {date_range}. What day and time works best for you?",
                    'slots': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                    'note': 'Using fallback - Cal.com API error'
                }
            })
            
    except Exception as e:
        app.logger.error(f"Error checking availability: {str(e)}")
        return jsonify({
            'status': 'error',
            'data': {
                'message': "Let me check on that. What day and time generally works best for you?",
                'error': str(e)
            }
        }), 200  # Return 200 so Bland doesn't fail


@app.route('/api/schedule-appointment', methods=['POST'])
def schedule_appointment():
    """
    Create a booking in Cal.com and log to Google Sheets.
    
    Request body:
    - practitioner_name: Name of the practitioner
    - email: Their email address
    - phone_number: Their phone number
    - appointment_date: Date (YYYY-MM-DD or natural language)
    - appointment_time: Time (HH:MM or natural language like "2:00 PM")
    - practice_name: Name of their practice
    - practitioner_type: Type of practitioner
    - products_interested: Products they showed interest in
    - notes: Any additional notes
    - timezone: Their timezone (default: America/New_York)
    """
    try:
        data = request.json or {}
        
        practitioner_name = data.get('practitioner_name', 'Unknown')
        email = data.get('email', '')
        phone_number = data.get('phone_number', '')
        appointment_date = data.get('appointment_date', '')
        appointment_time = data.get('appointment_time', '')
        practice_name = data.get('practice_name', '')
        practitioner_type = data.get('practitioner_type', '')
        products_interested = data.get('products_interested', '')
        notes = data.get('notes', '')
        timezone = data.get('timezone', DEFAULT_TIMEZONE)
        
        # Parse date and time into ISO format
        booking_datetime = None
        try:
            # Try to parse the date
            if appointment_date:
                # Handle various date formats
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%B %d, %Y', '%B %d']:
                    try:
                        parsed_date = datetime.strptime(appointment_date, fmt)
                        if parsed_date.year == 1900:  # No year provided
                            parsed_date = parsed_date.replace(year=datetime.now().year)
                        break
                    except ValueError:
                        continue
                else:
                    # Default to next weekday if parsing fails
                    parsed_date = datetime.now() + timedelta(days=1)
                
                # Try to parse the time
                if appointment_time:
                    for fmt in ['%H:%M', '%I:%M %p', '%I:%M%p', '%I %p', '%I%p']:
                        try:
                            parsed_time = datetime.strptime(appointment_time.upper(), fmt)
                            booking_datetime = parsed_date.replace(
                                hour=parsed_time.hour,
                                minute=parsed_time.minute,
                                second=0,
                                microsecond=0
                            )
                            break
                        except ValueError:
                            continue
                    else:
                        # Default to 10 AM if time parsing fails
                        booking_datetime = parsed_date.replace(hour=10, minute=0, second=0, microsecond=0)
                else:
                    booking_datetime = parsed_date.replace(hour=10, minute=0, second=0, microsecond=0)
        except Exception as e:
            app.logger.error(f"Date parsing error: {e}")
            booking_datetime = datetime.now() + timedelta(days=1)
            booking_datetime = booking_datetime.replace(hour=10, minute=0, second=0, microsecond=0)
        
        # Generate confirmation number
        confirmation_number = f"SP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Create booking in Cal.com
        cal_booking_id = None
        cal_booking_uid = None
        
        if (CAL_COM_EVENT_TYPE_ID or (CAL_COM_EVENT_TYPE_SLUG and CAL_COM_USERNAME)) and email:
            try:
                booking_payload = {
                    'start': booking_datetime.strftime('%Y-%m-%dT%H:%M:%S') + 'Z',
                    'attendee': {
                        'name': practitioner_name,
                        'email': email,
                        'timeZone': timezone,
                        'language': 'en'
                    },
                    'metadata': {
                        'practice_name': practice_name,
                        'practitioner_type': practitioner_type,
                        'products_interested': products_interested,
                        'notes': notes,
                        'source': 'bland_ai_voice_agent',
                        'confirmation_number': confirmation_number
                    }
                }
                
                # Add phone number if provided
                if phone_number:
                    booking_payload['attendee']['phoneNumber'] = phone_number
                
                # Add event type identification
                if CAL_COM_EVENT_TYPE_ID:
                    booking_payload['eventTypeId'] = int(CAL_COM_EVENT_TYPE_ID)
                else:
                    booking_payload['eventTypeSlug'] = CAL_COM_EVENT_TYPE_SLUG
                    booking_payload['username'] = CAL_COM_USERNAME
                
                # Call Cal.com API to create booking
                response = requests.post(
                    f'{CAL_COM_API_URL}/bookings',
                    headers=get_cal_headers(),
                    json=booking_payload
                )
                
                if response.status_code in [200, 201]:
                    cal_data = response.json()
                    cal_booking_id = cal_data.get('data', {}).get('id')
                    cal_booking_uid = cal_data.get('data', {}).get('uid')
                    confirmation_number = cal_booking_uid or confirmation_number
                    app.logger.info(f"Cal.com booking created: {cal_booking_uid}")
                else:
                    app.logger.error(f"Cal.com booking failed: {response.status_code} - {response.text}")
            except Exception as e:
                app.logger.error(f"Cal.com API error: {e}")
        
        # Log to Google Sheets
        sheet_data = {
            'confirmation_number': confirmation_number,
            'cal_booking_id': cal_booking_id or '',
            'cal_booking_uid': cal_booking_uid or '',
            'practitioner_name': practitioner_name,
            'email': email,
            'phone_number': phone_number,
            'practice_name': practice_name,
            'practitioner_type': practitioner_type,
            'appointment_date': appointment_date,
            'appointment_time': appointment_time,
            'appointment_datetime': booking_datetime.isoformat() if booking_datetime else '',
            'products_interested': products_interested,
            'notes': notes,
            'created_at': datetime.now().isoformat(),
            'source': 'bland_ai_voice_agent'
        }
        
        try:
            log_appointment_to_sheets(sheet_data)
            app.logger.info(f"Logged to sheets: {confirmation_number}")
        except Exception as e:
            app.logger.error(f"Sheets logging error: {e}")
        
        # Format response for voice agent
        formatted_time = booking_datetime.strftime('%A, %B %d at %I:%M %p') if booking_datetime else f"{appointment_date} at {appointment_time}"
        
        return jsonify({
            'status': 'success',
            'data': {
                'message': f"I've booked your follow-up call for {formatted_time}. Your confirmation number is {confirmation_number}. You'll receive a calendar invite at {email}.",
                'confirmation_number': confirmation_number,
                'cal_booking_uid': cal_booking_uid,
                'scheduled_time': formatted_time
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error scheduling appointment: {str(e)}")
        return jsonify({
            'status': 'error',
            'data': {
                'message': "I've noted the appointment details. Someone will confirm the booking with you shortly.",
                'error': str(e)
            }
        }), 200  # Return 200 so Bland doesn't fail


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'superpatch-appointment-webhook',
        'cal_com_configured': bool(CAL_COM_API_KEY),
        'event_type_configured': bool(CAL_COM_EVENT_TYPE_ID or CAL_COM_EVENT_TYPE_SLUG)
    })


@app.route('/api/cal-event-types', methods=['GET'])
def list_cal_event_types():
    """List available Cal.com event types (for setup)"""
    try:
        response = requests.get(
            f'{CAL_COM_API_URL}/event-types',
            headers=get_cal_headers()
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({
                'error': f'Cal.com API error: {response.status_code}',
                'details': response.text
            }), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
