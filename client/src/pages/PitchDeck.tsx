import React from "react";

// ── Inline styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    background: "#f0f2f5",
    color: "#1a1a2e",
    lineHeight: 1.55,
    fontSize: 14,
    padding: "32px 16px",
  },
  page: {
    maxWidth: 820,
    margin: "0 auto",
    background: "#fff",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  // ── Header
  header: {
    background: "linear-gradient(135deg, #1a1d3a 0%, #2c3161 100%)",
    color: "#fff",
    padding: "40px 48px 36px",
    display: "flex",
    gap: 32,
    alignItems: "flex-start",
  },
  headerText: { flex: 1 },
  h1: {
    fontSize: "2rem",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "#fff",
    margin: 0,
  },
  headerTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#f0a500",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    marginTop: 6,
    marginBottom: 18,
  },
  tagline: {
    fontSize: "0.9rem",
    color: "#c5cae9",
    maxWidth: 480,
    lineHeight: 1.6,
  },
  contactBar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 18,
    marginTop: 22,
  },
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: "0.83rem",
    color: "#e8eaf6",
  },
  // ── Body layout
  bodyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 260px",
  },
  main: {
    padding: "36px 40px",
    borderRight: "1px solid #e8eaf0",
  },
  sidebar: {
    padding: "36px 28px",
    background: "#f8f9fd",
  },
  // ── Section
  section: { marginBottom: 32 },
  sectionLabel: {
    fontSize: "0.7rem",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "2px",
    color: "#f0a500",
    borderBottom: "2px solid #f0a500",
    paddingBottom: 6,
    marginBottom: 18,
  },
  sectionLabelSm: {
    fontSize: "0.68rem",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "2px",
    color: "#f0a500",
    borderBottom: "2px solid #f0a500",
    paddingBottom: 6,
    marginBottom: 18,
  },
  // ── Highlight box
  highlight: {
    background: "linear-gradient(135deg, #fff8e1, #fff3cd)",
    borderLeft: "3px solid #f0a500",
    borderRadius: "0 6px 6px 0",
    padding: "12px 16px",
    marginBottom: 22,
    fontSize: "0.87rem",
    color: "#3d3d5c",
    lineHeight: 1.6,
  },
  // ── Entry
  entry: { marginBottom: 22 },
  entryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 3,
  },
  entryTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "#1a1d3a",
  },
  entryDate: {
    fontSize: "0.78rem",
    color: "#f0a500",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    background: "#fff8e1",
    padding: "2px 8px",
    borderRadius: 4,
  },
  entryCompany: {
    fontSize: "0.82rem",
    color: "#5c6bc0",
    fontWeight: 600,
    marginBottom: 7,
  },
  entryList: { paddingLeft: 16 },
  entryListItem: {
    fontSize: "0.87rem",
    color: "#3d3d5c",
    marginBottom: 4,
  },
  // ── Skill tags
  skillTag: {
    display: "inline-block",
    background: "#e8eaf6",
    color: "#3949ab",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 20,
    margin: "3px 3px 3px 0",
  },
  skillTagGold: {
    display: "inline-block",
    background: "#fff8e1",
    color: "#e65100",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 20,
    margin: "3px 3px 3px 0",
  },
  // ── Cert
  certItem: { display: "flex", flexDirection: "column" as const, marginBottom: 12 },
  certName: { fontWeight: 700, fontSize: "0.87rem", color: "#1a1d3a" },
  certOrg: { fontSize: "0.8rem", color: "#5c6bc0" },
  certYear: { fontSize: "0.75rem", color: "#9e9e9e", marginTop: 1 },
  // ── Stats
  statRow: { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" as const },
  stat: {
    background: "#1a1d3a",
    color: "#fff",
    borderRadius: 8,
    padding: "10px 14px",
    textAlign: "center" as const,
    flex: 1,
    minWidth: 70,
  },
  statNum: {
    fontSize: "1.3rem",
    fontWeight: 800,
    color: "#f0a500",
    display: "block",
  },
  statLbl: { fontSize: "0.7rem", color: "#c5cae9", marginTop: 2 },
  // ── Value prop
  valueProp: {
    background: "#1a1d3a",
    color: "#e8eaf6",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: "0.82rem",
    lineHeight: 1.6,
    marginBottom: 14,
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel = ({ small, children }: { small?: boolean; children: React.ReactNode }) => (
  <div style={small ? styles.sectionLabelSm : styles.sectionLabel}>{children}</div>
);

interface EntryProps {
  title: string;
  date: string;
  company: string;
  bullets: React.ReactNode[];
}
const Entry = ({ title, date, company, bullets }: EntryProps) => (
  <div style={styles.entry}>
    <div style={styles.entryHeader}>
      <div style={styles.entryTitle}>{title}</div>
      <div style={styles.entryDate}>{date}</div>
    </div>
    <div style={styles.entryCompany}>{company}</div>
    <ul style={styles.entryList}>
      {bullets.map((b, i) => (
        <li key={i} style={styles.entryListItem}>{b}</li>
      ))}
    </ul>
  </div>
);

interface CertProps { name: string; org: string; year: string; }
const Cert = ({ name, org, year }: CertProps) => (
  <div style={styles.certItem}>
    <span style={styles.certName}>{name}</span>
    <span style={styles.certOrg}>{org}</span>
    <span style={styles.certYear}>{year}</span>
  </div>
);

interface StatProps { num: string; label: string; }
const Stat = ({ num, label }: StatProps) => (
  <div style={styles.stat}>
    <span style={styles.statNum}>{num}</span>
    <span style={styles.statLbl}>{label}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const KeithCV: React.FC = () => {
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
    <div style={styles.body}>
      <div style={styles.page}>

        {/* ── HEADER ── */}
        <div style={styles.header}>
          <div style={styles.headerText}>
            <h1 style={styles.h1}>Keith Storey</h1>
            <div style={styles.headerTitle}>
              Corporate English Facilitator &amp; Experiential Trainer
            </div>
            <div style={styles.tagline}>
              Native English speaker (New Zealand) with 10+ years in Moscow delivering
              engaging, results-driven English programmes. Specialist in game-based and
              experiential learning for adult professionals — combining language fluency,
              soft skills development, and team dynamics in a single format.
            </div>
            <div style={styles.contactBar}>
              {[
                { icon: "📞", text: "+7 985 255-44-70" },
                { icon: "✉️", text: "storeykeith@gmail.com" },
                { icon: "📍", text: "Moscow (Akademicheskaya)" },
                { icon: "📱", text: "@keith_nz" },
              ].map(({ icon, text }) => (
                <div key={text} style={styles.contactItem}>
                  <span>{icon}</span> {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={styles.bodyGrid}>

          {/* ── MAIN COLUMN ── */}
          <div style={styles.main}>

            {/* What I Offer */}
            <div style={styles.section}>
              <SectionLabel>What I Offer</SectionLabel>
              <div style={styles.highlight}>
                I design and facilitate <strong>game-based English training sessions</strong> for
                corporate teams — using social deduction games, negotiation scenarios, and
                structured speaking formats to develop real communication skills. Every session
                includes a debrief that connects gameplay to workplace situations: negotiation,
                reading people, decision-making under pressure, and presenting ideas clearly. I
                deliver measurable soft skill outcomes alongside English fluency — with written
                progress reports for HR and L&D teams.
              </div>
            </div>

            {/* Experience */}
            <div style={styles.section}>
              <SectionLabel>Relevant Experience</SectionLabel>

              <Entry
                title="Adult English Speaking Club — Host & Facilitator"
                date="2015 — Present"
                company="Independent / Various venues, Moscow"
                bullets={[
                  <>Designed and hosted <strong>weekly topical speaking clubs</strong> for adult professionals (15–20 participants per session)</>,
                  <>Built structured discussion formats around specific vocabulary sets and real-world business scenarios — adapted from the Big Wig Language Centre model</>,
                  <>Strong <strong>return attendance rate</strong>: majority of participants were regulars, demonstrating sustained engagement</>,
                  <>Facilitated <strong>Mafia and Blood on the Clocktower</strong> events — social deduction games requiring active English use, persuasion, and reading body language</>,
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
                  <>Developed facilitation skills for high-energy, time-pressured group scenarios — directly applicable to corporate team building formats</>,
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
                company="Park Kultury Nursery / Sunschool / Luzhki Country Club / Win Win Kids / Discovery"
                bullets={[
                  <>10 years delivering structured English language programmes across multiple institutions</>,
                  <>Programme coordination at Luzhki — scheduling, curriculum design, staff communication</>,
                  <>Consistent use of game-based, activity-led learning to drive engagement and retention</>,
                ]}
              />
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div style={styles.sidebar}>

            {/* At a Glance */}
            <div style={styles.section}>
              <SectionLabel small>At a Glance</SectionLabel>
              <div style={styles.statRow}>
                <Stat num="10+" label="Years in Moscow" />
                <Stat num="15–20" label="Per event" />
              </div>
              <div style={styles.statRow}>
                <Stat num="Weekly" label="Event cadence" />
                <Stat num="Native" label="English (NZ)" />
              </div>
            </div>

            {/* Facilitation Skills */}
            <div style={styles.section}>
              <SectionLabel small>Facilitation Skills</SectionLabel>
              {facilitationSkills.map((s) => (
                <span key={s} style={styles.skillTagGold}>{s}</span>
              ))}
            </div>

            {/* English Training Skills */}
            <div style={styles.section}>
              <SectionLabel small>English Training</SectionLabel>
              {englishSkills.map((s) => (
                <span key={s} style={styles.skillTag}>{s}</span>
              ))}
            </div>

            {/* Education & Certs */}
            <div style={styles.section}>
              <SectionLabel small>Education &amp; Certifications</SectionLabel>
              <Cert
                name="Bachelor of Communications"
                org="Auckland University of Technology"
                year="New Zealand"
              />
              <Cert
                name="TESOL Certificate"
                org="International Open Academy"
                year="2018"
              />
              <Cert
                name="TKT Young Learners"
                org="Cambridge Assessment English"
                year="2016"
              />
            </div>

            {/* Why Me */}
            <div style={styles.section}>
              <SectionLabel small>Why Me</SectionLabel>
              <div style={styles.valueProp}>
                I don't just run games — I{" "}
                <strong style={{ color: "#f0a500" }}>
                  connect gameplay to real workplace outcomes
                </strong>
                . Every session I facilitate has a learning arc: warm-up, challenge,
                debrief, commitment. Your team leaves with better English{" "}
                <em>and</em> a concrete takeaway for their next negotiation or
                presentation.
              </div>
              <div style={styles.valueProp}>
                As a{" "}
                <strong style={{ color: "#f0a500" }}>
                  native New Zealander
                </strong>{" "}
                with a decade in Moscow, I understand both the cultural context of
                Russian corporate teams and the authentic English register that
                international business demands.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default KeithCV;
