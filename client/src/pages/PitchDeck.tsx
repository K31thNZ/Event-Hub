import React, { useEffect, useState } from "react";

// ── Responsive hook ───────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface EntryProps {
  title: string;
  date: string;
  company: string;
  bullets: React.ReactNode[];
}
interface CertProps { name: string; org: string; year: string; }
interface StatProps { num: string; label: string; }

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel = ({ small, children }: { small?: boolean; children: React.ReactNode }) => (
  <div style={{
    fontSize: small ? "0.68rem" : "0.7rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "2px",
    color: "#f0a500",
    borderBottom: "2px solid #f0a500",
    paddingBottom: 6,
    marginBottom: 18,
  }}>
    {children}
  </div>
);

const Entry = ({ title, date, company, bullets }: EntryProps) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 6,
      marginBottom: 3,
    }}>
      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a1d3a", flex: 1, minWidth: 0 }}>
        {title}
      </div>
      <div style={{
        fontSize: "0.78rem",
        color: "#f0a500",
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: "#fff8e1",
        padding: "2px 8px",
        borderRadius: 4,
      }}>
        {date}
      </div>
    </div>
    <div style={{ fontSize: "0.82rem", color: "#5c6bc0", fontWeight: 600, marginBottom: 7 }}>
      {company}
    </div>
    <ul style={{ paddingLeft: 16 }}>
      {bullets.map((b, i) => (
        <li key={i} style={{ fontSize: "0.87rem", color: "#3d3d5c", marginBottom: 4 }}>{b}</li>
      ))}
    </ul>
  </div>
);

const Cert = ({ name, org, year }: CertProps) => (
  <div style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
    <span style={{ fontWeight: 700, fontSize: "0.87rem", color: "#1a1d3a" }}>{name}</span>
    <span style={{ fontSize: "0.8rem", color: "#5c6bc0" }}>{org}</span>
    <span style={{ fontSize: "0.75rem", color: "#9e9e9e", marginTop: 1 }}>{year}</span>
  </div>
);

const Stat = ({ num, label }: StatProps) => (
  <div style={{
    background: "#1a1d3a",
    color: "#fff",
    borderRadius: 8,
    padding: "10px 14px",
    textAlign: "center",
    flex: 1,
    minWidth: 70,
  }}>
    <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f0a500", display: "block" }}>{num}</span>
    <span style={{ fontSize: "0.7rem", color: "#c5cae9", marginTop: 2, display: "block" }}>{label}</span>
  </div>
);

const SkillTag = ({ gold, children }: { gold?: boolean; children: string }) => (
  <span style={{
    display: "inline-block",
    background: gold ? "#fff8e1" : "#e8eaf6",
    color: gold ? "#e65100" : "#3949ab",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 20,
    margin: "3px 3px 3px 0",
  }}>
    {children}
  </span>
);

const ValueProp = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: "#1a1d3a",
    color: "#e8eaf6",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: "0.82rem",
    lineHeight: 1.6,
    marginBottom: 14,
  }}>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const KeithCV: React.FC = () => {
  const isMobile = useIsMobile();

  const facilitationSkills = [
    "Social deduction games", "Negotiation scenarios", "Structured debriefs",
    "Speaking club design", "Mafia / Werewolf", "Blood on the Clocktower",
    "Quest events", "Group dynamics",
  ];
  const englishSkills = [
    "Business English", "Interview coaching", "Presentation skills",
    "Vocabulary frameworks", "Fluency development", "TESOL methodology",
    "Adult learners", "Corporate clients",
  ];

  return (
    <div style={{
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      background: "#f0f2f5",
      color: "#1a1a2e",
      lineHeight: 1.55,
      fontSize: 14,
      padding: isMobile ? "0" : "32px 16px",
      minHeight: "100vh",
      WebkitTextSizeAdjust: "100%",
    }}>
      <div style={{
        maxWidth: 820,
        margin: "0 auto",
        background: "#fff",
        boxShadow: isMobile ? "none" : "0 4px 32px rgba(0,0,0,0.12)",
        borderRadius: isMobile ? 0 : 4,
        overflow: "hidden",
        width: "100%",
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "linear-gradient(135deg, #1a1d3a 0%, #2c3161 100%)",
          color: "#fff",
          padding: isMobile ? "28px 20px 24px" : "40px 48px 36px",
        }}>
          <h1 style={{
            fontSize: isMobile ? "1.6rem" : "2rem",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            color: "#fff",
            margin: 0,
          }}>
            Keith Storey
          </h1>
          <div style={{
            fontSize: isMobile ? "0.8rem" : "0.95rem",
            fontWeight: 600,
            color: "#f0a500",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            marginTop: 6,
            marginBottom: 14,
          }}>
            Corporate English Facilitator &amp; Experiential Trainer
          </div>
          <div style={{
            fontSize: isMobile ? "0.85rem" : "0.9rem",
            color: "#c5cae9",
            lineHeight: 1.6,
            marginBottom: 18,
          }}>
            Native English speaker (New Zealand) with 10+ years in Moscow delivering
            engaging, results-driven English programmes. Specialist in game-based and
            experiential learning for adult professionals. I combinine language fluency,
            soft skills development, and team dynamics in a single format.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 10 : 18 }}>
            {[
              { icon: "📞", text: "+7 985 255-44-70" },
              { icon: "✉️", text: "storeykeith@gmail.com" },
              { icon: "📍", text: "Moscow (Akademicheskaya)" },
              { icon: "📱", text: "Telegram @keith_nz" },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: isMobile ? "0.78rem" : "0.83rem",
                color: "#e8eaf6",
              }}>
                <span>{icon}</span> {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY — stacks on mobile, side-by-side on desktop ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 260px",
        }}>

          {/* ── MAIN COLUMN ── */}
          <div style={{
            padding: isMobile ? "24px 20px" : "36px 40px",
            borderRight: isMobile ? "none" : "1px solid #e8eaf0",
            borderBottom: isMobile ? "1px solid #e8eaf0" : "none",
          }}>

            {/* What I Offer */}
            <div style={{ marginBottom: 32 }}>
              <SectionLabel>What I Offer</SectionLabel>
              <div style={{
                background: "linear-gradient(135deg, #fff8e1, #fff3cd)",
                borderLeft: "3px solid #f0a500",
                borderRadius: "0 6px 6px 0",
                padding: "12px 16px",
                fontSize: "0.87rem",
                color: "#3d3d5c",
                lineHeight: 1.6,
              }}>
                I design and facilitate <strong>game-based English training sessions</strong> for
                corporate teams, using social deduction games, negotiation scenarios, and
                structured speaking formats to develop real communication skills. Every session
                includes a debrief that connects gameplay to workplace situations: negotiation,
                reading people, decision-making under pressure, and presenting ideas clearly. I
                deliver measurable soft skill outcomes alongside English fluency, with written
                progress reports for HR and L&D teams.
              </div>
            </div>

            {/* Experience */}
            <div style={{ marginBottom: 0 }}>
              <SectionLabel>Relevant Experience</SectionLabel>

              <Entry
                title="Adult English Speaking Club — Host & Facilitator"
                date="2015 — Present"
                company="Independent / Various venues, Moscow"
                bullets={[
                  <>Designed and hosted <strong>weekly topical speaking clubs</strong> for adult professionals (15–20 participants per session)</>,
                  <>Built structured discussion formats around specific vocabulary sets and real-world business scenarios, adapted from proven conversational models</>,
                  <>Strong <strong>return attendance rate</strong>: majority of participants were regulars, demonstrating sustained engagement</>,
                  <>Facilitated <strong>Mafia and Blood on the Clocktower</strong> events, social deduction games requiring active English use, persuasion, and reading body language</>,
                  <>Managed group dynamics, kept sessions in English, and ran post-game debriefs connecting gameplay to communication skills</>,
                ]}
              />

              <Entry
                title="Business English Tutor — Adult Professionals"
                date="2015 — Present"
                company="Private Practice, Moscow"
                bullets={[
                  <>Delivered <strong>1-on-1 Business English</strong> to professionals in corporate, tech, and finance sectors</>,
                  <>Specialised in preparing clients for <strong>international job interviews</strong>, cross-border negotiations, and English-language presentations</>,
                  <>Coached on professional vocabulary, confident communication, and cultural context for international business settings</>,
                ]}
              />

              <Entry
                title="English Quest Event Organiser"
                date="Ongoing"
                company="Mir Kvestov (mir-kvestov.ru) & independent events"
                bullets={[
                  <>Organised and led <strong>English-language immersive quest events</strong> for adult groups</>,
                  <>Managed logistics, participant briefings, and post-event debriefs entirely in English</>,
                  <>Developed facilitation skills for high-energy, time-pressured group scenarios, directly applicable to corporate team building formats</>,
                ]}
              />

              <Entry
                title="Group Moderator — Speaking Clubs & Games"
                date="2015"
                company="Big Wig Language Centre, Moscow"
                bullets={[
                  <>Moderated structured English speaking clubs using topical vocabulary frameworks and timed discussion formats</>,
                  <>Ran Mafia and board game sessions as communicative language practice tools</>,
                  <>Adopted and adapted this format independently for other clubs post-tenure</>,
                ]}
              />

              <Entry
                title="English Teacher & Programme Coordinator"
                date="2016 — 2024"
                company="Park Kultury Nursery / Sunschool / Luzhki / Win Win Kids / Discovery"
                bullets={[
                  <>10 years delivering structured English language programmes across multiple institutions</>,
                  <>Programme coordination at Luzhki, scheduling, curriculum design, staff communication</>,
                  <>Consistent use of game-based, activity-led learning to drive engagement and retention</>,
                ]}
              />
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div style={{
            padding: isMobile ? "24px 20px" : "36px 28px",
            background: "#f8f9fd",
          }}>

            {/* At a Glance */}
            <div style={{ marginBottom: 28 }}>
              <SectionLabel small>At a Glance</SectionLabel>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <Stat num="10+" label="Years in Moscow" />
                <Stat num="15–20" label="Per event" />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Stat num="Weekly" label="Event cadence" />
                <Stat num="Native" label="English (NZ)" />
              </div>
            </div>

            {/* Facilitation Skills */}
            <div style={{ marginBottom: 28 }}>
              <SectionLabel small>Facilitation Skills</SectionLabel>
              {facilitationSkills.map((s) => <SkillTag key={s} gold>{s}</SkillTag>)}
            </div>

            {/* English Training */}
            <div style={{ marginBottom: 28 }}>
              <SectionLabel small>English Training</SectionLabel>
              {englishSkills.map((s) => <SkillTag key={s}>{s}</SkillTag>)}
            </div>

            {/* Education & Certs */}
            <div style={{ marginBottom: 28 }}>
              <SectionLabel small>Education &amp; Certifications</SectionLabel>
              <Cert name="Bachelor of Communications" org="Auckland University of Technology" year="New Zealand" />
              <Cert name="TESOL Certificate" org="International Open Academy" year="2018" />
              <Cert name="TKT Young Learners" org="Cambridge Assessment English" year="2016" />
            </div>

            {/* Why Me */}
            <div style={{ marginBottom: 0 }}>
              <SectionLabel small>Why Me</SectionLabel>
              <ValueProp>
                I don't just run games — I{" "}
                <strong style={{ color: "#f0a500" }}>connect gameplay to real workplace outcomes</strong>.
                Every session has a learning arc: warm-up, challenge, debrief, commitment. Your team
                leaves with better English <em>and</em> a concrete takeaway for their next negotiation.
              </ValueProp>
              <ValueProp>
                As a <strong style={{ color: "#f0a500" }}>native New Zealander</strong> with a decade
                in Moscow, I understand both the cultural context of Russian corporate teams and the
                authentic English register that international business demands.
              </ValueProp>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Keith;
