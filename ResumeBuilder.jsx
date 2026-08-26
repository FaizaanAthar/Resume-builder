"use client";

import React, { useState, useMemo, useRef } from "react";

const EMPTY_PROFILE = {
  name: "",
  location: "",
  contact: "",
  technicalSkills: "",
  certifications: [],
  education: [],
  roles: [],
};

let roleCounter = 0;
function newRoleId() {
  roleCounter += 1;
  return "role-" + Date.now() + "-" + roleCounter;
}

function linesToList(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseEducationLine(line) {
  // "Degree, School (Dates)" — tolerant parsing, keeps the raw line if it doesn't match
  const match = line.match(/^(.*?),\s*(.*?)\s*\((.*?)\)\s*$/);
  if (match) return { degree: match[1].trim(), school: match[2].trim(), dates: match[3].trim() };
  return { degree: line, school: "", dates: "" };
}

function educationToLines(education) {
  return (education || [])
    .map((e) => {
      const parts = [e.degree, e.school].filter(Boolean).join(", ");
      return e.dates ? `${parts} (${e.dates})` : parts;
    })
    .join("\n");
}

function KeywordStrip({ matched, gap }) {
  if (!matched.length && !gap.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: 10 }}>
      {matched.map((k) => (
        <span
          key={"m-" + k}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.02em",
            padding: "3px 9px",
            borderRadius: 999,
            background: "#0B6E5C",
            color: "#F5F6F4",
          }}
        >
          {k}
        </span>
      ))}
      {gap.map((k) => (
        <span
          key={"g-" + k}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.02em",
            padding: "3px 9px",
            borderRadius: 999,
            background: "transparent",
            color: "#B45309",
            border: "1px solid #B45309",
          }}
        >
          {k}
        </span>
      ))}
    </div>
  );
}

export default function ResumeBuilder() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [jd, setJd] = useState("");
  const [tailored, setTailored] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [cvPasteText, setCvPasteText] = useState("");
  const [parsingCv, setParsingCv] = useState(false);
  const [cvError, setCvError] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvLoaded, setCvLoaded] = useState(false);
  const fileInputRef = useRef(null);

  const hasProfile = profile.roles && profile.roles.length > 0;

  const matchScore = useMemo(() => {
    if (!tailored) return null;
    const total = tailored.matched_keywords.length + tailored.gap_keywords.length;
    if (!total) return null;
    return Math.round((tailored.matched_keywords.length / total) * 100);
  }, [tailored]);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCvError("");
    setCvFileName(file.name);
    setParsingCv(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that file.");
      applyParsedProfile(data.profile);
    } catch (err) {
      setCvError(err.message || "Couldn't read that file.");
    } finally {
      setParsingCv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function parseFromPastedText() {
    if (!cvPasteText.trim()) return;
    setParsingCv(true);
    setCvError("");
    try {
      const formData = new FormData();
      formData.append("text", cvPasteText);
      const res = await fetch("/api/parse-cv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that text.");
      applyParsedProfile(data.profile);
      setShowPasteBox(false);
      setCvPasteText("");
    } catch (err) {
      setCvError(err.message || "Couldn't read that text.");
    } finally {
      setParsingCv(false);
    }
  }

  function applyParsedProfile(parsed) {
    setProfile((prev) => ({
      ...prev,
      ...parsed,
      roles: (parsed.roles || []).map((r) => ({ ...r, id: r.id || newRoleId() })),
    }));
    setCvLoaded(true);
    setEditOpen(true);
  }

  async function generate() {
    if (!jd.trim()) {
      setError("Paste a job description first.");
      return;
    }
    if (!hasProfile) {
      setError("Upload your CV or add at least one role in the profile panel first.");
      return;
    }
    setLoading(true);
    setError("");
    setTailored(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate a tailored resume.");
      setTailored(data.tailored);
    } catch (e) {
      setError(e.message || "Couldn't generate a tailored resume. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateRolePoints(roleId, text) {
    setProfile((p) => ({
      ...p,
      roles: p.roles.map((r) => (r.id === roleId ? { ...r, points: linesToList(text) } : r)),
    }));
  }

  function updateRoleField(roleId, field, value) {
    setProfile((p) => ({
      ...p,
      roles: p.roles.map((r) => (r.id === roleId ? { ...r, [field]: value } : r)),
    }));
  }

  function addRole() {
    setProfile((p) => ({
      ...p,
      roles: [...p.roles, { id: newRoleId(), title: "", company: "", dates: "", points: [] }],
    }));
  }

  function removeRole(roleId) {
    setProfile((p) => ({ ...p, roles: p.roles.filter((r) => r.id !== roleId) }));
  }

  function copyResumeText() {
    if (!tailored) return;
    const lines = [];
    lines.push(profile.name || "Your Name");
    lines.push(tailored.headline);
    lines.push([profile.location, profile.contact].filter(Boolean).join("  ·  "));
    lines.push("");
    lines.push("PROFESSIONAL SUMMARY");
    lines.push(tailored.summary);
    lines.push("");
    lines.push("CORE SKILLS");
    lines.push(tailored.ordered_skills);
    lines.push("");
    lines.push("EXPERIENCE");
    profile.roles.forEach((role) => {
      const t = tailored.roles.find((r) => r.id === role.id);
      lines.push(`${role.title} — ${role.company} (${role.dates})`);
      (t ? t.bullets : role.points).forEach((b) => lines.push("• " + b));
      lines.push("");
    });
    if (profile.certifications.length) {
      lines.push("CERTIFICATIONS");
      profile.certifications.forEach((c) => lines.push("• " + c));
      lines.push("");
    }
    if (profile.education.length) {
      lines.push("EDUCATION");
      profile.education.forEach((e) =>
        lines.push([e.degree, e.school].filter(Boolean).join(", ") + (e.dates ? ` (${e.dates})` : ""))
      );
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "28px 20px 60px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "#0B6E5C",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Clinical Research Resume Concordance
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: "clamp(26px, 4vw, 36px)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Upload your CV. Paste a JD. Get a resume built to match it.
          </h1>
          <p style={{ maxWidth: 680, color: "#44534C", marginTop: 8, fontSize: 14.5, lineHeight: 1.5 }}>
            Built for pharmacovigilance, clinical data management, and clinical SAS/CDM
            applicants. Every line comes from your own CV — nothing is invented, and
            requirements the JD asks for that you don't clearly have are flagged, not hidden.
          </p>
          <p style={{ maxWidth: 680, color: "#8B968F", marginTop: 8, fontSize: 12.5 }}>
            Your CV and job description are sent to Claude to generate your resume and are not
            stored on our server.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)", gap: 20 }} className="rb-grid">
          {/* LEFT: input rail */}
          <div>
            <div style={cardStyle}>
              <label style={labelStyle}>Job description</label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={12}
                style={{ ...taStyle, marginTop: 8, fontSize: 13.5 }}
              />
              <button onClick={generate} disabled={loading} style={{ ...primaryBtn, marginTop: 12, width: "100%", padding: "11px 16px", background: loading ? "#7FA79A" : "#0B6E5C" }}>
                {loading ? "Matching your profile to the JD…" : "Generate tailored resume"}
              </button>
              {error && <div style={{ marginTop: 10, fontSize: 13, color: "#B45309" }}>{error}</div>}
            </div>

            <div style={{ ...cardStyle, marginTop: 16 }}>
              <label style={labelStyle}>Upload your CV</label>
              <p style={{ fontSize: 12.5, color: "#8B968F", margin: "6px 0 10px", lineHeight: 1.5 }}>
                PDF, DOCX, or TXT — we'll read it and fill in the profile fields below for you to
                review. Nothing is invented; only what's actually in your CV gets extracted.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={parsingCv}
                  style={{ ...primaryBtn, background: "#FFFFFF", color: "#0B6E5C", border: "1px solid #0B6E5C" }}
                >
                  {parsingCv ? "Reading CV…" : "Choose file (PDF / DOCX / TXT)"}
                </button>
                <button
                  onClick={() => setShowPasteBox((v) => !v)}
                  disabled={parsingCv}
                  style={{ ...primaryBtn, background: "transparent", color: "#44534C", border: "1px solid #D8DED9" }}
                >
                  {showPasteBox ? "Hide paste box" : "Paste text instead"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              {cvFileName && !cvError && (
                <div style={{ fontSize: 12, color: "#44534C", marginTop: 8 }}>
                  {cvLoaded ? "Loaded from " : "Reading "}
                  <strong>{cvFileName}</strong>
                  {cvLoaded ? " — review the fields below." : "…"}
                </div>
              )}
              {cvError && <div style={{ fontSize: 12.5, color: "#B45309", marginTop: 8 }}>{cvError}</div>}
              {showPasteBox && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={cvPasteText}
                    onChange={(e) => setCvPasteText(e.target.value)}
                    placeholder="Paste your resume text here…"
                    rows={6}
                    style={taStyle}
                  />
                  <button
                    onClick={parseFromPastedText}
                    disabled={parsingCv || !cvPasteText.trim()}
                    style={{ ...primaryBtn, marginTop: 8, width: "100%" }}
                  >
                    {parsingCv ? "Reading CV…" : "Extract profile from pasted text"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ ...cardStyle, marginTop: 16 }}>
              <button onClick={() => setEditOpen((v) => !v)} style={toggleBtn}>
                {editOpen ? "▾" : "▸"} Your profile facts ({hasProfile ? "edit" : "add manually"})
              </button>
              {editOpen && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <SmallInput value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
                  </div>
                  <div>
                    <FieldLabel>Location</FieldLabel>
                    <SmallInput value={profile.location} onChange={(v) => setProfile((p) => ({ ...p, location: v }))} />
                  </div>
                  <div>
                    <FieldLabel>Contact line</FieldLabel>
                    <SmallInput value={profile.contact} onChange={(v) => setProfile((p) => ({ ...p, contact: v }))} />
                  </div>
                  <div>
                    <FieldLabel>Technical skills (comma-separated)</FieldLabel>
                    <textarea
                      value={profile.technicalSkills}
                      onChange={(e) => setProfile((p) => ({ ...p, technicalSkills: e.target.value }))}
                      rows={2}
                      style={taStyle}
                    />
                  </div>
                  <div>
                    <FieldLabel>Certifications (one per line)</FieldLabel>
                    <textarea
                      value={profile.certifications.join("\n")}
                      onChange={(e) => setProfile((p) => ({ ...p, certifications: linesToList(e.target.value) }))}
                      rows={3}
                      style={taStyle}
                    />
                  </div>
                  <div>
                    <FieldLabel>Education — one per line: "Degree, School (Dates)"</FieldLabel>
                    <textarea
                      value={educationToLines(profile.education)}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          education: linesToList(e.target.value).map(parseEducationLine),
                        }))
                      }
                      rows={2}
                      style={taStyle}
                    />
                  </div>

                  {profile.roles.map((role) => (
                    <div key={role.id} style={{ border: "1px solid #EBEEEA", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <SmallInput
                          value={role.title}
                          onChange={(v) => updateRoleField(role.id, "title", v)}
                        />
                        <SmallInput
                          value={role.company}
                          onChange={(v) => updateRoleField(role.id, "company", v)}
                        />
                      </div>
                      <SmallInput value={role.dates} onChange={(v) => updateRoleField(role.id, "dates", v)} />
                      <FieldLabel>Bullets (one per line)</FieldLabel>
                      <textarea
                        value={role.points.join("\n")}
                        onChange={(e) => updateRolePoints(role.id, e.target.value)}
                        rows={Math.min(6, Math.max(2, role.points.length + 1))}
                        style={{ ...taStyle, marginTop: 4 }}
                      />
                      <button
                        onClick={() => removeRole(role.id)}
                        style={{ ...toggleBtn, color: "#B45309", marginTop: 6 }}
                      >
                        Remove this role
                      </button>
                    </div>
                  ))}
                  <button onClick={addRole} style={{ ...primaryBtn, background: "transparent", color: "#0B6E5C", border: "1px solid #0B6E5C" }}>
                    + Add role
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: resume preview */}
          <div>
            {!tailored && !loading && (
              <div style={placeholderStyle}>
                Your tailored resume preview will appear here once you generate it.
              </div>
            )}
            {loading && (
              <div style={{ ...placeholderStyle, border: "1px solid #D8DED9" }}>
                Reading the JD and matching it against your CV…
              </div>
            )}
            {tailored && (
              <div style={{ ...cardStyle, padding: "26px 28px" }}>
                {matchScore !== null && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={labelStyle}>JD concordance</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#0B6E5C", fontWeight: 500 }}>
                        {matchScore}% matched
                      </span>
                    </div>
                    <div style={{ height: 4, background: "#EBEEEA", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ width: matchScore + "%", height: "100%", background: "#0B6E5C" }} />
                    </div>
                    <KeywordStrip matched={tailored.matched_keywords} gap={tailored.gap_keywords} />
                    {tailored.gap_keywords.length > 0 && (
                      <p style={{ fontSize: 12, color: "#8B968F", marginTop: 8, marginBottom: 0 }}>
                        Amber = the JD asks for this and your CV doesn't clearly support it — nothing
                        was invented to cover the gap.
                      </p>
                    )}
                  </div>
                )}

                <div style={{ height: 1, background: "#D8DED9", margin: "18px 0" }} />

                <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, margin: 0 }}>
                  {profile.name || "Your Name"}
                </h2>
                <div style={{ fontSize: 14, color: "#0B6E5C", fontWeight: 600, marginTop: 3 }}>
                  {tailored.headline}
                </div>
                <div style={{ fontSize: 12.5, color: "#44534C", marginTop: 4 }}>
                  {[profile.location, profile.contact].filter(Boolean).join(" · ")}
                </div>

                <SectionLabel>Professional Summary</SectionLabel>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0" }}>{tailored.summary}</p>

                <SectionLabel>Core Skills</SectionLabel>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0" }}>{tailored.ordered_skills}</p>

                <SectionLabel>Experience</SectionLabel>
                {profile.roles.map((role) => {
                  const t = tailored.roles.find((r) => r.id === role.id);
                  const bullets = t ? t.bullets : role.points;
                  return (
                    <div key={role.id} style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
                        <span>{role.title} — {role.company}</span>
                        <span style={{ fontWeight: 400, color: "#44534C", fontSize: 12.5 }}>{role.dates}</span>
                      </div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {bullets.map((b, i) => (
                          <li key={i} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 2 }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {profile.certifications.length > 0 && (
                  <>
                    <SectionLabel>Certifications</SectionLabel>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {profile.certifications.map((c, i) => (
                        <li key={i} style={{ fontSize: 13, lineHeight: 1.55 }}>{c}</li>
                      ))}
                    </ul>
                  </>
                )}

                {profile.education.length > 0 && (
                  <>
                    <SectionLabel>Education</SectionLabel>
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>
                      {profile.education.map((e) => [e.degree, e.school].filter(Boolean).join(", ") + (e.dates ? ` (${e.dates})` : "")).join("  ·  ")}
                    </p>
                  </>
                )}

                <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
                  <button onClick={copyResumeText} style={primaryBtn}>
                    {copied ? "Copied ✓" : "Copy resume text"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11.5, color: "#8B968F", marginBottom: 4, fontWeight: 500 }}>{children}</div>;
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.1em",
        color: "#0B6E5C",
        textTransform: "uppercase",
        marginTop: 20,
        paddingBottom: 4,
        borderBottom: "1px solid #EBEEEA",
      }}
    >
      {children}
    </div>
  );
}

function SmallInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D8DED9", fontSize: 13 }}
    />
  );
}

const cardStyle = { background: "#FFFFFF", border: "1px solid #D8DED9", borderRadius: 10, padding: 18 };
const labelStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "#44534C",
  textTransform: "uppercase",
};
const toggleBtn = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "#44534C",
  textTransform: "uppercase",
};
const placeholderStyle = {
  height: "100%",
  minHeight: 340,
  border: "1px dashed #D8DED9",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#8B968F",
  fontSize: 13.5,
  textAlign: "center",
  padding: 24,
};
const taStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D8DED9", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" };
const primaryBtn = { padding: "9px 16px", borderRadius: 7, border: "1px solid #0B6E5C", background: "#0B6E5C", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" };
