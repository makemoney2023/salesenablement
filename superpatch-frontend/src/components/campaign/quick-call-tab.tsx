"use client";

import { useCallback, useReducer } from "react";
import { toast } from "sonner";
import { Loader2, Phone, Search, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PATHWAY_IDS_SHORT, KB_ID, VOICE_ID } from "@/lib/config/pathways";
import { ErrorBoundary } from "@/components/error-boundary";

// Types
interface PractitionerData {
  id: string;
  name: string;
  practitioner_type: string;
  address: string;
  city: string;
  province: string;
  phone: string | null;
  website?: string | null;
  rating?: number | null;
  review_count?: number | null;
  is_user_added?: boolean;
  do_not_call?: boolean;
  [key: string]: unknown;
}

// Quick call form state managed by useReducer
interface QuickCallState {
  phone: string;
  type: string;
  searching: boolean;
  making: boolean;
  result: PractitionerData | null;
  notFound: boolean;
  // Manual entry fields
  practiceName: string;
  contactName: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

type QuickCallAction =
  | { type: "SET_PHONE"; phone: string }
  | { type: "SET_TYPE"; value: string }
  | { type: "SET_SEARCHING"; value: boolean }
  | { type: "SET_MAKING"; value: boolean }
  | { type: "SET_RESULT"; result: PractitionerData | null }
  | { type: "SET_NOT_FOUND"; value: boolean }
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "RESET" }
  | { type: "RESET_PHONE" };

const initialState: QuickCallState = {
  phone: "",
  type: "chiropractor",
  searching: false,
  making: false,
  result: null,
  notFound: false,
  practiceName: "",
  contactName: "",
  email: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
};

function quickCallReducer(state: QuickCallState, action: QuickCallAction): QuickCallState {
  switch (action.type) {
    case "SET_PHONE":
      return {
        ...state,
        phone: action.phone,
        result: null,
        notFound: false,
        practiceName: "",
        contactName: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postalCode: "",
      };
    case "SET_TYPE":
      return { ...state, type: action.value };
    case "SET_SEARCHING":
      return { ...state, searching: action.value };
    case "SET_MAKING":
      return { ...state, making: action.value };
    case "SET_RESULT":
      return { ...state, result: action.result, notFound: false };
    case "SET_NOT_FOUND":
      return { ...state, notFound: action.value, result: null };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return { ...initialState };
    case "RESET_PHONE":
      return { ...state, phone: "", result: null, notFound: false };
    default:
      return state;
  }
}

// Props from parent
interface QuickCallTabProps {
  onCallStarted: (practitioner: { id: string; name: string; phone: string; practitioner_type: string; address: string; city: string; province: string }, callId: string) => void;
  onManualCallStarted: (practitioner: { id: string; name: string; phone: string; practitioner_type: string; address: string; city: string; province: string }, callId: string) => void;
  onViewPractitioner: (practitioner: PractitionerData) => void;
  onCallSuccess: (name: string) => void;
  onCallFailed: (name: string, message?: string) => void;
  loadCallRecords: () => void;
  loadPractitioners: (page: number) => void;
}

const pathwayLabels: Record<string, string> = {
  chiropractor: "Chiropractor",
  massage: "Massage Therapist",
  naturopath: "Naturopath",
  integrative: "Integrative Medicine",
  functional: "Functional Medicine",
  acupuncturist: "Acupuncturist",
};

const typeMapping: Record<string, string> = {
  Chiropractor: "chiropractor",
  Chiropractors: "chiropractor",
  "Massage Therapist": "massage",
  "Massage Therapists": "massage",
  "Registered Massage Therapist": "massage",
  Naturopath: "naturopath",
  Naturopaths: "naturopath",
  "Naturopathic Doctor": "naturopath",
  "Integrative Medicine": "integrative",
  "Integrative Medicine Practitioner": "integrative",
  "Functional Medicine": "functional",
  "Functional Medicine Practitioner": "functional",
  Acupuncturist: "acupuncturist",
  Acupuncturists: "acupuncturist",
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function QuickCallTab({
  onCallStarted,
  onManualCallStarted,
  onViewPractitioner,
  onCallSuccess,
  onCallFailed,
  loadCallRecords,
  loadPractitioners,
}: QuickCallTabProps) {
  const [state, dispatch] = useReducer(quickCallReducer, initialState);

  // Search for practitioner by phone
  const handleSearch = useCallback(async () => {
    if (!state.phone.trim()) return;

    dispatch({ type: "SET_SEARCHING", value: true });
    dispatch({ type: "SET_RESULT", result: null });

    try {
      const response = await fetch(`/api/practitioners?phone=${encodeURIComponent(state.phone.trim())}`);
      const data = await response.json();

      if (data.practitioners && data.practitioners.length > 0) {
        const practitioner = data.practitioners[0];
        dispatch({ type: "SET_RESULT", result: practitioner });

        // Auto-select pathway
        const matchedType = Object.entries(typeMapping).find(([key]) =>
          practitioner.practitioner_type?.toLowerCase().includes(key.toLowerCase())
        );
        if (matchedType) {
          dispatch({ type: "SET_TYPE", value: matchedType[1] });
        }
      } else {
        dispatch({ type: "SET_NOT_FOUND", value: true });
      }
    } catch (error) {
      console.error("Quick call search failed:", error);
      dispatch({ type: "SET_NOT_FOUND", value: true });
    }

    dispatch({ type: "SET_SEARCHING", value: false });
  }, [state.phone]);

  // Call found practitioner with selected pathway
  const handleCallWithPathway = useCallback(async () => {
    if (!state.result || !state.result.phone) return;

    dispatch({ type: "SET_MAKING", value: true });

    try {
      const formattedPhone = formatPhone(state.result.phone);
      const pathways = PATHWAY_IDS_SHORT;

      const requestData = {
        practice_name: state.result.name || "your practice",
        practice_address: state.result.address || "",
        practice_city: state.result.city || "",
        practice_province: state.result.province || "",
        google_rating: state.result.rating?.toString() || "",
        review_count: state.result.review_count?.toString() || "",
        website: state.result.website || "",
        practitioner_type: state.result.practitioner_type || "",
        greeting_name: state.result.name || "there",
      };

      const memoryId = process.env.NEXT_PUBLIC_BLAND_MEMORY_ID;
      const callPayload: Record<string, unknown> = {
        phone_number: formattedPhone,
        pathway_id: pathways[state.type] || pathways.chiropractor,
        knowledge_base: KB_ID,
        voice: VOICE_ID,
        wait_for_greeting: true,
        record: true,
        max_duration: 15,
        webhook:
          process.env.NEXT_PUBLIC_BLAND_WEBHOOK_URL ||
          "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor",
        request_data: requestData,
        metadata: {
          campaign: "quick_call",
          source: "quick_call_with_context",
          practitioner_id: state.result.id,
          practice_name: state.result.name,
          practitioner_type: state.result.practitioner_type,
          selected_pathway: state.type,
          address: state.result.address || "",
          city: state.result.city || "",
          province: state.result.province || "",
        },
      };
      if (memoryId) callPayload.memory_id = memoryId.trim();

      const response = await fetch("/api/bland/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callPayload),
      });

      const result = await response.json();

      if (result.status === "success") {
        onCallStarted(
          {
            id: state.result.id,
            name: state.result.name,
            practitioner_type: state.result.practitioner_type,
            phone: state.result.phone,
            address: state.result.address,
            city: state.result.city,
            province: state.result.province,
          },
          result.call_id
        );
        onCallSuccess(state.result.name);
        dispatch({ type: "RESET_PHONE" });
      } else {
        onCallFailed(state.result.name);
      }
    } catch (error) {
      console.error("Quick call failed:", error);
      onCallFailed("Unknown", "Failed to initiate call");
    }

    dispatch({ type: "SET_MAKING", value: false });
  }, [state.result, state.type, onCallStarted, onCallSuccess, onCallFailed]);

  // Make manual call
  const handleManualCall = useCallback(async () => {
    if (!state.phone.trim()) return;

    dispatch({ type: "SET_MAKING", value: true });

    try {
      const formattedPhone = formatPhone(state.phone);
      const pathways = PATHWAY_IDS_SHORT;

      const fullAddress = [state.address, state.city, state.province, state.postalCode]
        .filter(Boolean)
        .join(", ");

      const requestData = {
        practice_name: state.practiceName || "your practice",
        contact_name: state.contactName || "",
        practitioner_type: pathwayLabels[state.type] || state.type,
        practice_email: state.email || "",
        practice_phone: formattedPhone,
        practice_address: state.address || "",
        practice_city: state.city || "",
        practice_province: state.province || "",
        practice_postal_code: state.postalCode || "",
        full_address: fullAddress || "",
        greeting_name: state.contactName || state.practiceName || "there",
      };

      const memoryId = process.env.NEXT_PUBLIC_BLAND_MEMORY_ID;
      const callPayload: Record<string, unknown> = {
        phone_number: formattedPhone,
        pathway_id: pathways[state.type] || pathways.chiropractor,
        knowledge_base: KB_ID,
        voice: VOICE_ID,
        wait_for_greeting: true,
        record: true,
        max_duration: 15,
        webhook:
          process.env.NEXT_PUBLIC_BLAND_WEBHOOK_URL ||
          "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor",
        request_data: requestData,
        metadata: {
          campaign: "quick_call",
          source: "manual_dial",
          selected_pathway: state.type,
          practice_name: state.practiceName || undefined,
          contact_name: state.contactName || undefined,
          practitioner_type: pathwayLabels[state.type] || state.type,
          clinic_email: state.email || undefined,
          address: state.address || undefined,
          city: state.city || undefined,
          province: state.province || undefined,
          postal_code: state.postalCode || undefined,
        },
      };
      if (memoryId) callPayload.memory_id = memoryId.trim();

      const response = await fetch("/api/bland/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callPayload),
      });

      const result = await response.json();

      if (result.status === "success") {
        const callTarget = state.practiceName || formattedPhone;

        // Save practitioner to DB
        let practitionerId: string | null = null;
        try {
          const practitionerData = {
            name: state.practiceName || `Unknown (${formattedPhone})`,
            phone: formattedPhone,
            practitioner_type: pathwayLabels[state.type] || "Unknown",
            address: state.address || null,
            city: state.city || null,
            province: state.province || null,
            country: state.province
              ? [
                  "ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE", "NT", "YT", "NU",
                  "Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", "Saskatchewan",
                  "Nova Scotia", "New Brunswick", "Newfoundland", "Prince Edward Island",
                ].some((p) => state.province?.toLowerCase().includes(p.toLowerCase()))
                ? "Canada"
                : "United States"
              : null,
            notes: state.contactName ? `Contact: ${state.contactName}` : null,
          };

          const saveResponse = await fetch("/api/practitioners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(practitionerData),
          });
          const saveResult = await saveResponse.json();
          if (saveResult.practitioner) {
            practitionerId = saveResult.practitioner.id;
          }
        } catch (saveError) {
          console.error("Failed to save practitioner:", saveError);
        }

        const callRecordId = practitionerId || result.call_id || `manual-${Date.now()}`;
        onManualCallStarted(
          {
            id: callRecordId,
            name: state.practiceName || `Unknown (${formattedPhone})`,
            practitioner_type: pathwayLabels[state.type] || "Unknown",
            phone: formattedPhone,
            address: state.address || "",
            city: state.city || "",
            province: state.province || "",
          },
          result.call_id
        );

        onCallSuccess(callTarget);
        dispatch({ type: "RESET" });
        loadCallRecords();
        loadPractitioners(1);
      } else {
        onCallFailed(state.practiceName || "Unknown", result.message);
      }
    } catch (error) {
      console.error("Quick call failed:", error);
      toast.error("Failed to initiate call");
    }

    dispatch({ type: "SET_MAKING", value: false });
  }, [state, onManualCallStarted, onCallSuccess, onCallFailed, loadCallRecords, loadPractitioners]);

  return (
    <ErrorBoundary section="Quick Call">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Quick Call
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter a phone number to search for a practitioner in our database.
              If found, you can call with full context. If not, make a manual call.
            </p>

            <div className="space-y-4">
              {/* Phone Number Input */}
              <div>
                <Label htmlFor="quick-phone">Phone Number</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="quick-phone"
                    placeholder="(555) 123-4567"
                    value={state.phone}
                    onChange={(e) => dispatch({ type: "SET_PHONE", phone: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!state.phone.trim() || state.searching}
                  >
                    {state.searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>
              </div>

              {/* Search Result: Practitioner Found */}
              {state.result && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-green-800">Practitioner Found!</p>
                          <p className="font-semibold mt-1">{state.result.name}</p>
                          <p className="text-sm text-muted-foreground">{state.result.practitioner_type}</p>
                          <p className="text-sm text-muted-foreground">{state.result.address}</p>
                          <p className="text-sm text-muted-foreground">
                            {state.result.city}, {state.result.province}
                          </p>
                          {state.result.rating && (
                            <p className="text-sm flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {state.result.rating} ({state.result.review_count} reviews)
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => state.result && onViewPractitioner(state.result)}
                        >
                          View Details
                        </Button>
                      </div>

                      {/* Pathway Selection */}
                      <div className="pt-3 border-t border-green-200">
                        <Label className="text-green-800">Conversational Pathway</Label>
                        <p className="text-xs text-green-700 mb-2">
                          Select the script/pathway to use for this call
                        </p>
                        <Select
                          value={state.type}
                          onValueChange={(v) => dispatch({ type: "SET_TYPE", value: v })}
                        >
                          <SelectTrigger className="mt-1 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chiropractor">Chiropractor</SelectItem>
                            <SelectItem value="massage">Massage Therapist</SelectItem>
                            <SelectItem value="naturopath">Naturopath</SelectItem>
                            <SelectItem value="integrative">Integrative Medicine</SelectItem>
                            <SelectItem value="functional">Functional Medicine</SelectItem>
                            <SelectItem value="acupuncturist">Acupuncturist</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleCallWithPathway}
                        disabled={state.making}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {state.making ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Phone className="w-4 h-4 mr-2" />
                        )}
                        Call with Selected Pathway
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search Result: Not Found */}
              {state.notFound && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-4">
                    <p className="font-medium text-yellow-800 mb-3">
                      No practitioner found with this phone number
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enter the practice details below. This info will be used by the AI during the call.
                    </p>

                    <div className="space-y-4">
                      {/* Practice & Contact Info */}
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-yellow-800 uppercase tracking-wide">
                          Practice Information
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="quick-practice-name">Practice Name *</Label>
                            <Input
                              id="quick-practice-name"
                              placeholder="ABC Wellness Clinic"
                              value={state.practiceName}
                              onChange={(e) =>
                                dispatch({ type: "SET_FIELD", field: "practiceName", value: e.target.value })
                              }
                              className="mt-1 bg-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="quick-contact-name">Contact / Dr. Name</Label>
                            <Input
                              id="quick-contact-name"
                              placeholder="Dr. Smith"
                              value={state.contactName}
                              onChange={(e) =>
                                dispatch({ type: "SET_FIELD", field: "contactName", value: e.target.value })
                              }
                              className="mt-1 bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="quick-email">Email Address</Label>
                          <Input
                            id="quick-email"
                            type="email"
                            placeholder="info@abcwellness.com"
                            value={state.email}
                            onChange={(e) =>
                              dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })
                            }
                            className="mt-1 bg-white"
                          />
                        </div>
                      </div>

                      {/* Address */}
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-yellow-800 uppercase tracking-wide">Location</p>
                        <div>
                          <Label htmlFor="quick-address">Street Address</Label>
                          <Input
                            id="quick-address"
                            placeholder="123 Main Street, Suite 200"
                            value={state.address}
                            onChange={(e) =>
                              dispatch({ type: "SET_FIELD", field: "address", value: e.target.value })
                            }
                            className="mt-1 bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="quick-city">City</Label>
                            <Input
                              id="quick-city"
                              placeholder="Toronto"
                              value={state.city}
                              onChange={(e) =>
                                dispatch({ type: "SET_FIELD", field: "city", value: e.target.value })
                              }
                              className="mt-1 bg-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="quick-province">Province</Label>
                            <Select
                              value={state.province}
                              onValueChange={(v) =>
                                dispatch({ type: "SET_FIELD", field: "province", value: v })
                              }
                            >
                              <SelectTrigger className="mt-1 bg-white">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Alberta">Alberta</SelectItem>
                                <SelectItem value="British Columbia">British Columbia</SelectItem>
                                <SelectItem value="Manitoba">Manitoba</SelectItem>
                                <SelectItem value="New Brunswick">New Brunswick</SelectItem>
                                <SelectItem value="Newfoundland and Labrador">Newfoundland</SelectItem>
                                <SelectItem value="Nova Scotia">Nova Scotia</SelectItem>
                                <SelectItem value="Ontario">Ontario</SelectItem>
                                <SelectItem value="Prince Edward Island">PEI</SelectItem>
                                <SelectItem value="Quebec">Quebec</SelectItem>
                                <SelectItem value="Saskatchewan">Saskatchewan</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="quick-postal">Postal Code</Label>
                            <Input
                              id="quick-postal"
                              placeholder="M5V 1A1"
                              value={state.postalCode}
                              onChange={(e) =>
                                dispatch({
                                  type: "SET_FIELD",
                                  field: "postalCode",
                                  value: e.target.value.toUpperCase(),
                                })
                              }
                              className="mt-1 bg-white"
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Pathway Selection */}
                      <div>
                        <Label>Conversational Pathway</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select the script/pathway to use for this call
                        </p>
                        <Select
                          value={state.type}
                          onValueChange={(v) => dispatch({ type: "SET_TYPE", value: v })}
                        >
                          <SelectTrigger className="mt-1 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chiropractor">Chiropractor</SelectItem>
                            <SelectItem value="massage">Massage Therapist</SelectItem>
                            <SelectItem value="naturopath">Naturopath</SelectItem>
                            <SelectItem value="integrative">Integrative Medicine</SelectItem>
                            <SelectItem value="functional">Functional Medicine</SelectItem>
                            <SelectItem value="acupuncturist">Acupuncturist</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleManualCall}
                        disabled={state.making || !state.practiceName.trim()}
                        className="w-full"
                      >
                        {state.making ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Phone className="w-4 h-4 mr-2" />
                        )}
                        Call {state.practiceName || "Practice"}
                      </Button>

                      {!state.practiceName.trim() && (
                        <p className="text-xs text-yellow-700 text-center">
                          Please enter a practice name to make the call
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Instructions */}
              {!state.result && !state.notFound && (
                <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
                  <p className="font-medium mb-2">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Enter a phone number and click Search</li>
                    <li>If we find a matching practitioner, you can call with full context</li>
                    <li>If not found, you can still make a manual call</li>
                    <li>All calls are logged and tracked in the Call Queue</li>
                  </ol>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
