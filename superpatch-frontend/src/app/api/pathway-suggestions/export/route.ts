import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs/promises";

// Types for pathway structure
interface PathwayNode {
  id: string;
  type: string;
  data: {
    name: string;
    prompt?: string;
    knowledge_base?: string;
    isStart?: boolean;
  };
}

interface PathwayEdge {
  id: string;
  source: string;
  target: string;
  data: {
    label: string;
  };
}

interface Pathway {
  name: string;
  description: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
}

interface PathwaySuggestion {
  id: string;
  suggestion_type: string;
  node_id: string | null;
  node_name: string | null;
  edge_id: string | null;
  current_content: string | null;
  suggested_content: string;
}

// Map practitioner type names to file names
const practitionerTypeToFile: Record<string, string> = {
  "Chiropractors": "Chiropractors_pathway.json",
  "Naturopaths": "Naturopaths_pathway.json",
  "Acupuncturists": "Acupuncturists_pathway.json",
  "Massage_Therapists": "Massage_Therapists_pathway.json",
  "Functional_Medicine": "Functional_Medicine_pathway.json",
  "Integrative_Medicine": "Integrative_Medicine_pathway.json",
};

// Normalize practitioner type to match expected file names
// Handles variations like "Massage Therapist" vs "Massage_Therapists"
function normalizePractitionerType(type: string): string {
  // Direct mapping for all known variations
  const mapping: Record<string, string> = {
    // Chiropractors variations
    "Chiropractor": "Chiropractors",
    "Chiropractors": "Chiropractors",
    "chiropractor": "Chiropractors",
    "chiropractors": "Chiropractors",
    
    // Naturopaths variations
    "Naturopath": "Naturopaths",
    "Naturopaths": "Naturopaths",
    "naturopath": "Naturopaths",
    "naturopaths": "Naturopaths",
    
    // Acupuncturists variations
    "Acupuncturist": "Acupuncturists",
    "Acupuncturists": "Acupuncturists",
    "acupuncturist": "Acupuncturists",
    "acupuncturists": "Acupuncturists",
    
    // Massage Therapists variations (space and underscore)
    "Massage Therapist": "Massage_Therapists",
    "Massage Therapists": "Massage_Therapists",
    "Massage_Therapist": "Massage_Therapists",
    "Massage_Therapists": "Massage_Therapists",
    "massage therapist": "Massage_Therapists",
    "massage therapists": "Massage_Therapists",
    
    // Functional Medicine variations
    "Functional Medicine": "Functional_Medicine",
    "Functional_Medicine": "Functional_Medicine",
    "functional medicine": "Functional_Medicine",
    "functional_medicine": "Functional_Medicine",
    
    // Integrative Medicine variations
    "Integrative Medicine": "Integrative_Medicine",
    "Integrative_Medicine": "Integrative_Medicine",
    "integrative medicine": "Integrative_Medicine",
    "integrative_medicine": "Integrative_Medicine",
  };
  
  // Try direct lookup first
  if (mapping[type]) {
    return mapping[type];
  }
  
  // Fallback: normalize and try again
  const normalized = type
    .trim()
    .replace(/\s+/g, "_"); // Replace spaces with underscores
  
  return mapping[normalized] || type;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { practitioner_type } = body;

    if (!practitioner_type) {
      return NextResponse.json(
        { error: "practitioner_type is required" },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch approved suggestions for this practitioner type
    const { data: suggestions, error: fetchError } = await supabase
      .from("pathway_suggestions")
      .select("*")
      .eq("practitioner_type", practitioner_type)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching suggestions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch suggestions" },
        { status: 500 }
      );
    }

    if (!suggestions || suggestions.length === 0) {
      return NextResponse.json(
        { error: "No approved suggestions found for this practitioner type" },
        { status: 404 }
      );
    }

    // Read the current pathway JSON file
    // Normalize the practitioner type to handle variations (spaces vs underscores, singular vs plural)
    const normalizedType = normalizePractitionerType(practitioner_type);
    const fileName = practitionerTypeToFile[normalizedType];
    if (!fileName) {
      return NextResponse.json(
        { error: `Unknown practitioner type: ${practitioner_type} (normalized: ${normalizedType})` },
        { status: 400 }
      );
    }

    // Construct path to the pathway file
    // The pathway files are in b2b_sales_enablement/bland_ai_pathways/
    // We need to go up from the Next.js project to the parent directory
    const pathwayDir = path.join(
      process.cwd(),
      "..",
      "b2b_sales_enablement",
      "bland_ai_pathways"
    );
    const filePath = path.join(pathwayDir, fileName);

    let pathway: Pathway;
    try {
      const fileContent = await fs.readFile(filePath, "utf-8");
      pathway = JSON.parse(fileContent);
    } catch (fileError) {
      console.error("Error reading pathway file:", fileError);
      return NextResponse.json(
        { error: `Could not read pathway file: ${fileName}` },
        { status: 500 }
      );
    }

    // Apply suggestions to the pathway
    const appliedChanges: string[] = [];

    for (const suggestion of suggestions as PathwaySuggestion[]) {
      try {
        switch (suggestion.suggestion_type) {
          case "node_prompt": {
            // Find the node and update its prompt
            const node = pathway.nodes.find(
              (n) => n.id === suggestion.node_id || n.data.name === suggestion.node_name
            );
            if (node && node.data.prompt) {
              // Append the suggestion with a comment marker
              node.data.prompt = `${node.data.prompt}\n\n/* === LLM SUGGESTION (${suggestion.id.slice(0, 8)}) === */\n${suggestion.suggested_content}`;
              appliedChanges.push(`Updated node prompt: ${node.data.name}`);
            }
            break;
          }

          case "edge_label": {
            // Find the edge and update its label
            const edge = pathway.edges.find((e) => e.id === suggestion.edge_id);
            if (edge) {
              const oldLabel = edge.data.label;
              edge.data.label = suggestion.suggested_content;
              appliedChanges.push(`Updated edge label: "${oldLabel}" -> "${suggestion.suggested_content}"`);
            }
            break;
          }

          case "missing_edge": {
            // Parse the suggested content to extract source, target, and label
            // Expected format: "source_node -> target_node: label text"
            const edgeMatch = suggestion.suggested_content.match(
              /(\d+|[a-zA-Z_]+)\s*->\s*(\d+|[a-zA-Z_]+):\s*(.+)/
            );
            if (edgeMatch) {
              const [, source, target, label] = edgeMatch;
              const newEdge: PathwayEdge = {
                id: `e_llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                source,
                target,
                data: { label: label.trim() },
              };
              pathway.edges.push(newEdge);
              appliedChanges.push(`Added edge: ${source} -> ${target}`);
            } else {
              // If not in expected format, add as a comment in a default node
              appliedChanges.push(`Skipped missing_edge (manual review needed): ${suggestion.suggested_content.slice(0, 50)}...`);
            }
            break;
          }

          case "missing_node": {
            // Add a new node placeholder
            // Parse expected format or create a generic structure
            const newNodeId = `${pathway.nodes.length + 1}`;
            const newNode: PathwayNode = {
              id: newNodeId,
              type: "Default",
              data: {
                name: suggestion.node_name || `LLM Suggested Node ${newNodeId}`,
                prompt: `/* LLM SUGGESTED NODE */\n${suggestion.suggested_content}`,
              },
            };
            pathway.nodes.push(newNode);
            appliedChanges.push(`Added new node: ${newNode.data.name}`);
            break;
          }

          case "knowledge_base_gap": {
            // Find the Knowledge Base node and append content
            const kbNode = pathway.nodes.find((n) => n.type === "Knowledge Base");
            if (kbNode && kbNode.data.knowledge_base) {
              kbNode.data.knowledge_base = `${kbNode.data.knowledge_base}\n\n/* === LLM ADDITION (${suggestion.id.slice(0, 8)}) === */\n${suggestion.suggested_content}`;
              appliedChanges.push(`Updated Knowledge Base with new content`);
            }
            break;
          }

          default:
            appliedChanges.push(`Skipped unknown type: ${suggestion.suggestion_type}`);
        }
      } catch (applyError) {
        console.error(`Error applying suggestion ${suggestion.id}:`, applyError);
        appliedChanges.push(`Error applying suggestion ${suggestion.id}`);
      }
    }

    // Add metadata about the export
    const metadata = {
      exported_at: new Date().toISOString(),
      practitioner_type: normalizedType,
      original_type: practitioner_type,
      suggestions_applied: suggestions.length,
      changes: appliedChanges,
    };

    // Add metadata as a comment in the pathway description
    pathway.description = `${pathway.description}\n\n/* EXPORT METADATA: ${JSON.stringify(metadata)} */`;

    // Return the updated pathway as JSON file
    const jsonContent = JSON.stringify(pathway, null, 2);

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${normalizedType}_pathway_updated.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export pathway" },
      { status: 500 }
    );
  }
}

// GET endpoint to check available practitioner types
export async function GET() {
  return NextResponse.json({
    available_types: Object.keys(practitionerTypeToFile),
    description: "POST with { practitioner_type: 'Chiropractors' } to export updated pathway JSON",
  });
}
