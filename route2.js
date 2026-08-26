import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TAILOR_SYSTEM_PROMPT, extractJsonFromModelText } from "../../../lib/prompts";
import { checkRateLimit, clientKeyFromRequest } from "../../../lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_JD_CHARS = 8000;

export async function POST(request) {
  const key = clientKeyFromRequest(request);
  if (!checkRateLimit(key)) {
    return NextResponse.json(
      { error: "Too many requests — please wait a minute and try again." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Contact the site owner." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const jobDescription = (body.jobDescription || "").slice(0, MAX_JD_CHARS);
    const profile = body.profile;

    if (!jobDescription.trim()) {
      return NextResponse.json({ error: "Job description is empty." }, { status: 400 });
    }
    if (!profile || !Array.isArray(profile.roles) || profile.roles.length === 0) {
      return NextResponse.json(
        { error: "Profile is missing work experience — upload a CV or fill in the form first." },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: TAILOR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ job_description: jobDescription, candidate_profile: profile }),
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text response from model");

    const parsed = extractJsonFromModelText(textBlock.text);
    return NextResponse.json({ tailored: parsed });
  } catch (err) {
    console.error("tailor error:", err);
    return NextResponse.json(
      { error: "Something went wrong generating the tailored resume. Try again." },
      { status: 500 }
    );
  }
}
