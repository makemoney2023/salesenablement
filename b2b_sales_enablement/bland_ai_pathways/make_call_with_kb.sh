#!/bin/bash
# SuperPatch Sales Call with Knowledge Base
# Usage: ./make_call_with_kb.sh <phone_number> <pathway_type>
# Example: ./make_call_with_kb.sh "+15551234567" "chiropractors"

API_KEY="${BLAND_API_KEY:?BLAND_API_KEY environment variable is required}"
KB_ID="b671527d-0c2d-4a21-9586-033dad3b0255"

# Cal.com Integration Tools
CHECK_AVAILABILITY_TOOL="TL-79a3c232-ca51-4244-b5d2-21f4e70fd872"
BOOK_APPOINTMENT_TOOL="TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526"

PHONE_NUMBER=$1
PATHWAY_TYPE=$2

# Pathway IDs
declare -A PATHWAYS
PATHWAYS["chiropractors"]="cf2233ef-7fb2-49ff-af29-0eee47204e9f"
PATHWAYS["massage"]="d202aad7-bcb6-478c-a211-b00877545e05"
PATHWAYS["naturopaths"]="1d07d635-147e-4f69-a4cd-c124b33b073d"
PATHWAYS["integrative"]="1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa"
PATHWAYS["functional"]="236dbd85-c74d-4774-a7af-4b5812015c68"
PATHWAYS["acupuncturists"]="154f93f4-54a5-4900-92e8-0fa217508127"

PATHWAY_ID=${PATHWAYS[$PATHWAY_TYPE]}

if [ -z "$PATHWAY_ID" ]; then
    echo "Unknown pathway type: $PATHWAY_TYPE"
    echo "Available: chiropractors, massage, naturopaths, integrative, functional, acupuncturists"
    exit 1
fi

echo "Making call to $PHONE_NUMBER using $PATHWAY_TYPE pathway..."

curl -X POST "https://api.bland.ai/v1/calls" \
  -H "authorization: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone_number\": \"$PHONE_NUMBER\",
    \"pathway_id\": \"$PATHWAY_ID\",
    \"voice\": \"78c8543e-e5fe-448e-8292-20a7b8c45247\",
    \"first_sentence\": \"Hi, this is Jennifer with SuperPatch.\",
    \"wait_for_greeting\": true,
    \"record\": true
  }"

echo ""
echo "Call initiated using pathway (tools configured in pathway)."
