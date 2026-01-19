# SuperPatch Appointment Webhook Server

Flask API server that integrates with **Cal.com** for scheduling and **Google Sheets** for logging.

## Features

- **Check Availability**: Get available time slots from Cal.com calendar
- **Create Bookings**: Schedule appointments in Cal.com with automatic calendar invites
- **Sheet Logging**: Log all appointments to Google Sheets for tracking
- **Bland.ai Integration**: Designed to work with Bland.ai custom tools

## Setup

### 1. Install Dependencies

```bash
cd b2b_sales_enablement/appointment_webhook
pip install -r requirements.txt
```

### 2. Configure Cal.com

You need your Cal.com API key and event type information.

**Get your Event Type ID:**

1. Go to Cal.com Dashboard → Event Types
2. Click on your event type
3. The ID is in the URL: `cal.com/event-types/[ID]`

Or use our endpoint after starting the server:
```bash
curl http://localhost:5000/api/cal-event-types
```

**Environment Variables:**

```bash
export CAL_COM_API_KEY="your_cal_com_api_key_here"
export CAL_COM_EVENT_TYPE_ID="123"  # Your event type ID
# OR use slug + username:
export CAL_COM_EVENT_TYPE_SLUG="superpatch-sales-call"
export CAL_COM_USERNAME="your-cal-username"
```

### 3. Configure Google Sheets (Optional)

For appointment logging to Google Sheets:

1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create service account credentials
4. Download `credentials.json` to this directory
5. Share your Google Sheet with the service account email

```bash
export GOOGLE_SHEET_ID="your-google-sheet-id"
```

### 4. Run the Server

```bash
python server.py
```

Server runs on `http://localhost:5000` by default.

## API Endpoints

### GET /api/check-availability

Check available time slots from Cal.com.

**Query Parameters:**
- `date_range`: `this_week`, `next_week`, or specific date (`YYYY-MM-DD`)
- `practitioner_type`: Type of practitioner (for context)
- `timezone`: Timezone for slots (default: `America/New_York`)

**Example:**
```bash
curl "http://localhost:5000/api/check-availability?date_range=next_week"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "I have these times available...",
    "slots": ["Monday, January 13 at 10:00 AM", "Tuesday, January 14 at 2:00 PM"]
  }
}
```

### POST /api/schedule-appointment

Create a booking in Cal.com and log to Google Sheets.

**Request Body:**
```json
{
  "practitioner_name": "Dr. Smith",
  "email": "drsmith@clinic.com",
  "phone_number": "+15551234567",
  "appointment_date": "2026-01-15",
  "appointment_time": "10:00 AM",
  "practice_name": "Smith Chiropractic",
  "practitioner_type": "chiropractor",
  "products_interested": "Freedom, REM",
  "notes": "Interested in wholesale program",
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "I've booked your follow-up call for Wednesday, January 15 at 10:00 AM...",
    "confirmation_number": "SP-20260108123456",
    "cal_booking_uid": "booking_uid_123",
    "scheduled_time": "Wednesday, January 15 at 10:00 AM"
  }
}
```

### GET /api/health

Health check endpoint.

### GET /api/cal-event-types

List available Cal.com event types (for setup).

## Bland.ai Custom Tools

These tools are already configured in your Bland.ai account:

### Check Availability Tool
- **Tool ID**: `TL-79a3c232-ca51-4244-b5d2-21f4e70fd872`
- **URL**: Your deployed webhook URL + `/api/check-availability`

### Schedule Appointment Tool
- **Tool ID**: `TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526`
- **URL**: Your deployed webhook URL + `/api/schedule-appointment`

## Deployment

### Option 1: Deploy to Railway/Render/Heroku

1. Push this directory to a git repo
2. Connect to Railway/Render/Heroku
3. Set environment variables in dashboard
4. Deploy

### Option 2: Deploy to AWS Lambda

Use Zappa or Serverless Framework to deploy as a serverless function.

### Option 3: Run on VPS

```bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 server:app
```

## Update Bland.ai Tools

After deploying, update your Bland.ai tools with the deployed URL:

```bash
# Update check-availability tool
curl -X POST "https://api.bland.ai/v1/tools/TL-79a3c232-ca51-4244-b5d2-21f4e70fd872" \
  -H "authorization: YOUR_BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": {
      "url": "https://YOUR_DEPLOYED_URL/api/check-availability"
    }
  }'

# Update schedule-appointment tool
curl -X POST "https://api.bland.ai/v1/tools/TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526" \
  -H "authorization: YOUR_BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": {
      "url": "https://YOUR_DEPLOYED_URL/api/schedule-appointment"
    }
  }'
```

## Testing

```bash
# Test availability
curl "http://localhost:5000/api/check-availability?date_range=next_week"

# Test booking
curl -X POST "http://localhost:5000/api/schedule-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "practitioner_name": "Test Doctor",
    "email": "test@example.com",
    "appointment_date": "2026-01-15",
    "appointment_time": "10:00 AM",
    "practice_name": "Test Clinic",
    "practitioner_type": "chiropractor"
  }'
```
