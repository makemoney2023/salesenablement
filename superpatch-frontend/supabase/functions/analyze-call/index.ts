// Supabase Edge Function for post-call LLM analysis using Gemini
// Analyzes transcripts for: structured extraction, lead scoring, pathway improvements, follow-up generation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// Types
interface AnalyzeCallRequest {
  call_record_id: string;
  transcript: string;
  practitioner_id?: string;
  practitioner_type?: string;
  current_lead_score?: number;
}

interface StructuredExtraction {
  objections_raised: string[];
  buying_signals: string[];
  pain_points: string[];
  products_discussed: string[];
  decision_maker_spoke: boolean;
  competitor_mentions: string[];
  next_steps_agreed: string | null;
  timeline_mentioned: string | null;
  budget_discussed: boolean;
  practice_size_mentioned: number | null;
  contact_name_extracted: string | null;
  contact_role_extracted: string | null;
  email_extracted: string | null;
}

interface LeadScoreResult {
  score: number;
  reasoning: string;
}

interface PathwaySuggestion {
  suggestion_type: "node_prompt" | "edge_label" | "missing_edge" | "missing_node" | "knowledge_base_gap";
  node_id?: string;
  node_name?: string;
  edge_id?: string;
  current_content?: string;
  suggested_content: string;
  reasoning: string;
  transcript_excerpt: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface PathwayAnalysisResult {
  node_prompt_improvements: PathwaySuggestion[];
  missing_edges: PathwaySuggestion[];
  edge_label_refinements: PathwaySuggestion[];
  knowledge_base_gaps: PathwaySuggestion[];
  missing_nodes: PathwaySuggestion[];
}

interface FollowUpContent {
  subject: string;
  content: string;
  context_data: {
    products_mentioned: string[];
    studies_to_reference: string[];
    objections_to_address: string[];
  };
}

// Pathway URLs mapped by practitioner type
// These are stored in the b2b_sales_enablement folder - we'll load them at build time
// For now, we'll use a simplified structure that the LLM can understand
const PATHWAY_SUMMARIES: Record<string, string> = {
  Chiropractors: `Pathway nodes: Introduction (1), Company Introduction (2), Discovery Questions (3), Product Presentation (4), Evidence Discussion (5), Objection Handler (6), Business Model Discussion (7), Close (8), Follow Up Setup (9), Schedule Callback (10), Soft No Handler (11), End Call (12), Knowledge Base (kb).
Key edges: intro->company intro (what is superpatch), intro->discovery (interested), intro->callback (busy), intro->soft no (not interested), discovery->presentation (ready), presentation->evidence (wants evidence), presentation->objections (has objection), presentation->business (interested in business), objections->presentation (handled), business->close (ready), close->end (success), close->followup (needs time).
Objection Handler covers: need research, patients won't believe, already have products, too expensive, need to try first.`,
  
  Naturopaths: `Pathway nodes: Introduction (1), Company Introduction (2), Discovery Questions (3), Product Presentation (4), Evidence Discussion (5), Objection Handler (6), Business Model Discussion (7), Close (8), Follow Up Setup (9), Schedule Callback (10), Soft No Handler (11), End Call (12), Knowledge Base (kb).
Similar structure to Chiropractors but tailored for naturopathic practices. Focus on natural, non-invasive solutions.`,
  
  "Acupuncturists": `Pathway nodes similar to other practitioners. Focus on complementary wellness approaches and energy-based healing alignment.`,
  
  "Massage Therapists": `Pathway nodes similar to other practitioners. Focus on pain relief between sessions and muscle recovery.`,
  
  "Functional Medicine": `Pathway nodes similar to other practitioners. Focus on root cause approaches and integrative wellness.`,
  
  "Integrative Medicine": `Pathway nodes similar to other practitioners. Focus on combining conventional and alternative approaches.`,
};

// Initialize Gemini
function getGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Structured Extraction Prompt
async function extractStructuredData(
  genAI: GoogleGenerativeAI,
  transcript: string
): Promise<StructuredExtraction> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const prompt = `Analyze this sales call transcript and extract structured information. Return ONLY valid JSON, no markdown.

TRANSCRIPT:
${transcript}

Extract and return this exact JSON structure:
{
  "objections_raised": ["array of specific concerns/objections the prospect raised"],
  "buying_signals": ["array of positive indicators showing interest"],
  "pain_points": ["array of problems/challenges they mentioned"],
  "products_discussed": ["array of SuperPatch products mentioned: Freedom, Liberty, REM, Victory, Focus, Ignite, Kick It, Defend, Joy, Lumi, Rocket, Peace, Boost"],
  "decision_maker_spoke": true/false,
  "competitor_mentions": ["array of any competitor products/solutions mentioned"],
  "next_steps_agreed": "string describing agreed next steps or null",
  "timeline_mentioned": "string describing any timeline mentioned or null",
  "budget_discussed": true/false,
  "practice_size_mentioned": number or null,
  "contact_name_extracted": "name if mentioned or null",
  "contact_role_extracted": "role (owner/manager/receptionist/practitioner) or null",
  "email_extracted": "email if mentioned or null"
}

Be precise. Only include items explicitly mentioned in the transcript.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Clean up response - remove markdown code blocks if present
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error in structured extraction:", error);
    return {
      objections_raised: [],
      buying_signals: [],
      pain_points: [],
      products_discussed: [],
      decision_maker_spoke: false,
      competitor_mentions: [],
      next_steps_agreed: null,
      timeline_mentioned: null,
      budget_discussed: false,
      practice_size_mentioned: null,
      contact_name_extracted: null,
      contact_role_extracted: null,
      email_extracted: null,
    };
  }
}

// Lead Scoring Prompt
async function calculateLLMLeadScore(
  genAI: GoogleGenerativeAI,
  transcript: string,
  extraction: StructuredExtraction,
  currentScore: number
): Promise<LeadScoreResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const prompt = `Score this sales call 0-100 based on conversion likelihood. Return ONLY valid JSON.

TRANSCRIPT:
${transcript}

EXTRACTED DATA:
- Objections: ${extraction.objections_raised.join(", ") || "None"}
- Buying Signals: ${extraction.buying_signals.join(", ") || "None"}
- Pain Points: ${extraction.pain_points.join(", ") || "None"}
- Decision Maker: ${extraction.decision_maker_spoke}
- Next Steps: ${extraction.next_steps_agreed || "None"}
- Current Rule-Based Score: ${currentScore}

SCORING CRITERIA:
- 90-100: Ready to buy, appointment set, or order placed
- 70-89: High interest, decision maker engaged, clear next steps
- 50-69: Moderate interest, some buying signals, needs follow-up
- 30-49: Low interest, many objections, uncertain timeline
- 10-29: Not interested but polite, may revisit later
- 0-9: Firm no, do not call, or call failed

Return this exact JSON:
{
  "score": <number 0-100>,
  "reasoning": "<2 sentence explanation>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error in lead scoring:", error);
    return { score: currentScore, reasoning: "LLM scoring failed, using rule-based score" };
  }
}

// Pathway Improvement Analysis
async function analyzePathwayImprovements(
  genAI: GoogleGenerativeAI,
  transcript: string,
  practitionerType: string
): Promise<PathwayAnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const pathwaySummary = PATHWAY_SUMMARIES[practitionerType] || PATHWAY_SUMMARIES["Chiropractors"];
  
  const prompt = `You are analyzing a sales call made by an AI voice agent to identify improvements for the conversational pathway. Return ONLY valid JSON.

PATHWAY STRUCTURE FOR ${practitionerType}:
${pathwaySummary}

TRANSCRIPT:
${transcript}

Analyze the transcript to find where the AI pathway could be improved. Look for:
1. Moments where the AI gave an inadequate response
2. Transitions that should have happened but didn't
3. New objections or scenarios not covered
4. Questions the AI couldn't answer from the knowledge base

Return this exact JSON structure (use empty arrays if no issues found for a category):
{
  "node_prompt_improvements": [
    {
      "suggestion_type": "node_prompt",
      "node_id": "6",
      "node_name": "Objection Handler",
      "current_content": "current prompt excerpt that failed",
      "suggested_content": "specific text to add or change",
      "reasoning": "why this would help",
      "transcript_excerpt": "the exact exchange showing the issue",
      "severity": "low|medium|high|critical"
    }
  ],
  "missing_edges": [
    {
      "suggestion_type": "missing_edge",
      "node_id": "source node id",
      "node_name": "source node name",
      "suggested_content": "suggested_target_node -> trigger: 'suggested label'",
      "reasoning": "why this edge is needed",
      "transcript_excerpt": "moment this should have triggered",
      "severity": "low|medium|high|critical"
    }
  ],
  "edge_label_refinements": [
    {
      "suggestion_type": "edge_label",
      "edge_id": "edge id if known",
      "current_content": "current label",
      "suggested_content": "better label",
      "reasoning": "why current label missed",
      "transcript_excerpt": "the exchange",
      "severity": "low|medium|high|critical"
    }
  ],
  "knowledge_base_gaps": [
    {
      "suggestion_type": "knowledge_base_gap",
      "suggested_content": "information to add to KB",
      "reasoning": "what question couldn't be answered",
      "transcript_excerpt": "the unanswered question exchange",
      "severity": "low|medium|high|critical"
    }
  ],
  "missing_nodes": [
    {
      "suggestion_type": "missing_node",
      "node_name": "suggested node name",
      "suggested_content": "full suggested prompt for new node",
      "reasoning": "scenario this would handle",
      "transcript_excerpt": "evidence from call",
      "severity": "low|medium|high|critical"
    }
  ]
}

IMPORTANT: Only suggest improvements for clear issues. Don't suggest changes for calls that went well. Be specific and actionable.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error in pathway analysis:", error);
    return {
      node_prompt_improvements: [],
      missing_edges: [],
      edge_label_refinements: [],
      knowledge_base_gaps: [],
      missing_nodes: [],
    };
  }
}

// Follow-Up Content Generation
async function generateFollowUpContent(
  genAI: GoogleGenerativeAI,
  transcript: string,
  extraction: StructuredExtraction,
  practitionerType: string
): Promise<FollowUpContent | null> {
  // Only generate follow-up if there was some interest
  if (extraction.buying_signals.length === 0 && extraction.pain_points.length === 0) {
    return null;
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const prompt = `Generate a personalized follow-up email for this sales call. Return ONLY valid JSON.

TRANSCRIPT:
${transcript}

EXTRACTED DATA:
- Practitioner Type: ${practitionerType}
- Pain Points: ${extraction.pain_points.join(", ") || "None mentioned"}
- Products Discussed: ${extraction.products_discussed.join(", ") || "General discussion"}
- Objections: ${extraction.objections_raised.join(", ") || "None"}
- Next Steps: ${extraction.next_steps_agreed || "None agreed"}
- Contact Name: ${extraction.contact_name_extracted || "Unknown"}

AVAILABLE STUDIES TO REFERENCE:
- RESTORE Study (Freedom patch) - Pain reduction, peer-reviewed RCT, NCT06505005
- HARMONI Study (REM patch) - Sleep improvement, 80% stopped sleep meds
- Balance Study (Liberty patch) - 31% improvement in balance scores

Generate a professional, warm follow-up email. Address their specific concerns and pain points. Reference relevant studies if applicable.

Return this exact JSON:
{
  "subject": "email subject line",
  "content": "full email body with proper formatting",
  "context_data": {
    "products_mentioned": ["array of products to highlight"],
    "studies_to_reference": ["RESTORE", "HARMONI", or "Balance" as applicable],
    "objections_to_address": ["key objections to overcome"]
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating follow-up:", error);
    return null;
  }
}

// Save pathway suggestions with deduplication
async function savePathwaySuggestions(
  supabase: ReturnType<typeof createClient>,
  callRecordId: string,
  practitionerType: string,
  analysis: PathwayAnalysisResult
): Promise<number> {
  let savedCount = 0;
  
  const allSuggestions: PathwaySuggestion[] = [
    ...analysis.node_prompt_improvements,
    ...analysis.missing_edges,
    ...analysis.edge_label_refinements,
    ...analysis.knowledge_base_gaps,
    ...analysis.missing_nodes,
  ];
  
  for (const suggestion of allSuggestions) {
    // Check for similar existing suggestion
    const { data: existing } = await supabase
      .from("pathway_suggestions")
      .select("id, frequency_count, similar_call_ids")
      .eq("practitioner_type", practitionerType)
      .eq("suggestion_type", suggestion.suggestion_type)
      .eq("node_id", suggestion.node_id || "")
      .eq("status", "new")
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      // Increment frequency and add call ID
      const similarIds = existing.similar_call_ids || [];
      if (!similarIds.includes(callRecordId)) {
        similarIds.push(callRecordId);
      }
      
      await supabase
        .from("pathway_suggestions")
        .update({
          frequency_count: existing.frequency_count + 1,
          similar_call_ids: similarIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new suggestion
      const { error } = await supabase
        .from("pathway_suggestions")
        .insert({
          call_record_id: callRecordId,
          practitioner_type: practitionerType,
          suggestion_type: suggestion.suggestion_type,
          node_id: suggestion.node_id || null,
          node_name: suggestion.node_name || null,
          edge_id: suggestion.edge_id || null,
          current_content: suggestion.current_content || null,
          suggested_content: suggestion.suggested_content,
          reasoning: suggestion.reasoning,
          transcript_excerpt: suggestion.transcript_excerpt,
          severity: suggestion.severity,
          similar_call_ids: [callRecordId],
        });
      
      if (!error) savedCount++;
    }
  }
  
  return savedCount;
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("🔬 ANALYZE-CALL: Starting LLM analysis...");

  try {
    const body: AnalyzeCallRequest = await req.json();
    
    if (!body.call_record_id || !body.transcript) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: call_record_id, transcript" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize clients
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const genAI = getGeminiClient();
    
    const practitionerType = body.practitioner_type || "Chiropractors";
    const currentScore = body.current_lead_score || 0;

    // Mark as processing
    await supabase
      .from("call_records")
      .update({ analysis_status: "processing" })
      .eq("id", body.call_record_id);

    console.log(`📝 Analyzing call ${body.call_record_id} for ${practitionerType}`);

    // Run all analyses in parallel for speed
    const [extraction, pathwayAnalysis] = await Promise.all([
      extractStructuredData(genAI, body.transcript),
      analyzePathwayImprovements(genAI, body.transcript, practitionerType),
    ]);

    console.log("✅ Extraction complete:", {
      objections: extraction.objections_raised.length,
      buyingSignals: extraction.buying_signals.length,
      painPoints: extraction.pain_points.length,
    });

    // Run scoring and follow-up (depend on extraction)
    const [leadScoreResult, followUp] = await Promise.all([
      calculateLLMLeadScore(genAI, body.transcript, extraction, currentScore),
      generateFollowUpContent(genAI, body.transcript, extraction, practitionerType),
    ]);

    console.log("✅ Scoring complete:", leadScoreResult.score);

    // Save pathway suggestions
    const suggestionCount = await savePathwaySuggestions(
      supabase,
      body.call_record_id,
      practitionerType,
      pathwayAnalysis
    );
    console.log(`📊 Saved ${suggestionCount} pathway suggestions`);

    // Save follow-up content if generated
    if (followUp) {
      const { error: followUpError } = await supabase
        .from("follow_up_queue")
        .insert({
          call_record_id: body.call_record_id,
          practitioner_id: body.practitioner_id || null,
          type: "email",
          subject: followUp.subject,
          content: followUp.content,
          context_data: followUp.context_data,
          status: "draft",
        });
      
      if (followUpError) {
        console.error("Error saving follow-up:", followUpError);
      } else {
        console.log("📧 Follow-up email draft saved");
      }
    }

    // Update call record with analysis results
    const { error: updateError } = await supabase
      .from("call_records")
      .update({
        llm_analysis: extraction,
        llm_lead_score: leadScoreResult.score,
        llm_analyzed_at: new Date().toISOString(),
        analysis_status: "completed",
      })
      .eq("id", body.call_record_id);

    if (updateError) {
      console.error("Error updating call record:", updateError);
      throw updateError;
    }

    // Update practitioner with extracted contact info if available
    if (body.practitioner_id && (extraction.contact_name_extracted || extraction.email_extracted)) {
      const practitionerUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      
      if (extraction.contact_name_extracted) {
        practitionerUpdate.contact_name = extraction.contact_name_extracted;
      }
      if (extraction.contact_role_extracted) {
        practitionerUpdate.contact_role = extraction.contact_role_extracted;
      }
      if (extraction.email_extracted) {
        practitionerUpdate.contact_email = extraction.email_extracted;
      }
      if (extraction.practice_size_mentioned) {
        practitionerUpdate.practice_size = extraction.practice_size_mentioned;
      }
      if (extraction.pain_points.length > 0) {
        practitionerUpdate.pain_points = extraction.pain_points.join("; ");
      }
      if (extraction.objections_raised.length > 0) {
        practitionerUpdate.objections = extraction.objections_raised.join("; ");
      }
      
      await supabase
        .from("practitioners")
        .update(practitionerUpdate)
        .eq("id", body.practitioner_id);
      
      console.log("👤 Practitioner record updated with extracted data");
    }

    console.log("✅ ANALYZE-CALL: Complete");

    return new Response(
      JSON.stringify({
        success: true,
        call_record_id: body.call_record_id,
        llm_lead_score: leadScoreResult.score,
        scoring_reasoning: leadScoreResult.reasoning,
        extraction_summary: {
          objections: extraction.objections_raised.length,
          buying_signals: extraction.buying_signals.length,
          pain_points: extraction.pain_points.length,
          products_discussed: extraction.products_discussed,
        },
        pathway_suggestions_saved: suggestionCount,
        follow_up_generated: !!followUp,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("❌ ANALYZE-CALL error:", error);
    
    // Try to mark as failed
    try {
      const body = await req.clone().json();
      if (body.call_record_id) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("call_records")
          .update({ analysis_status: "failed" })
          .eq("id", body.call_record_id);
      }
    } catch {
      // Ignore
    }
    
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
