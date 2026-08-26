import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { PARSE_CV_SYSTEM_PROMPT, extractJsonFromModelText } from "../../../../lib/prompts";
import { checkRateLimit, clientKeyFromRequest } from "../../../../lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_CHARS = 20000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  if (!checkRateLimit(clientKeyFromRequest(request))) return NextResponse.json({ error: "Too many requests — please wait a minute and try again." }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY. Contact the site owner." }, { status: 500 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = form.get("text");
    let rawText = "";
    if (file && typeof file !== "string") {
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File is too large — please keep it under 5MB." }, { status: 400 });
      const name = (file.name || "").toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      if (name.endsWith(".pdf")) rawText = (await pdfParse(buffer)).text;
      else if (name.endsWith(".docx")) rawText = (await mammoth.extractRawText({ buffer })).value;
      else if (name.endsWith(".txt")) rawText = buffer.toString("utf-8");
      else return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOCX, or TXT file." }, { status: 400 });
    } else if (pastedText) rawText = String(pastedText);
    if (!rawText.trim()) return NextResponse.json({ error: "Couldn't find any readable text in that file." }, { status: 400 });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1800, system: PARSE_CV_SYSTEM_PROMPT, messages: [{ role: "user", content: rawText.slice(0, MAX_CHARS) }] });
    const block = msg.content.find((b) => b.type === "text");
    if (!block) throw new Error("No text response from model");
    const parsed = extractJsonFromModelText(block.text);
    parsed.roles = (parsed.roles || []).map((r, i) => ({ ...r, id: r.id || `role-${i}` }));
    return NextResponse.json({ profile: parsed });
  } catch (err) {
    console.error("parse-cv error:", err);
    return NextResponse.json({ error: "Something went wrong reading that CV. Try again or paste the text instead." }, { status: 500 });
  }
}
