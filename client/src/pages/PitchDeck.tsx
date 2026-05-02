// client/src/pages/PitchDeck.tsx
import React from "react";

const s = {
  slide:       { fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" } as React.CSSProperties,
  brandBar:    { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "6px", background: "#E72350" },
  accentBar:   { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "6px", background: "#F5A623" },
  pad:         { padding: "40px 32px 60px" } as React.CSSProperties,
  label:       (color = "#E72350") => ({ fontSize: "12px", fontWeight: "bold" as const, letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "16px", color }),
};

const PitchDeck: React.FC = () => (
  <div style={s.slide}>

    {/* SLIDE 1: COVER */}
    <div style={{ position: "relative", overflow: "hidden", background: "#251D18" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: "45%", height: "55%", background: "#E72350", clipPath: "polygon(40% 0, 100% 0, 100% 100%, 0% 100%)" }} />
      <div style={{ position: "absolute", bottom: "30px", left: "30px", width: "180px", height: "180px", background: "#3A2820", borderRadius: "50%" }} />
      <div style={{ ...s.pad, position: "relative", zIndex: 2, color: "white" }}>
        <div style={{ display: "flex", gap: "4px", fontSize: "20px", fontWeight: "bold", marginBottom: "60px" }}>
          <span style={{ color: "#E72350" }}>EXPAT</span><span>EVENTS</span>
        </div>
        <div style={{ marginTop: "80px" }}>
          <h1 style={{ fontSize: "52px", lineHeight: "1.2", margin: 0 }}>Your club.</h1>
          <h1 style={{ fontSize: "52px", color: "#E72350", margin: 0 }}>More members.</h1>
          <h1 style={{ fontSize: "52px", margin: 0 }}>Zero hassle.</h1>
          <p style={{ fontSize: "16px", color: "#B8AFA9", margin: "24px 0 16px" }}>The expat community platform for clubs & groups worldwide</p>
          <div style={{ width: "80px", height: "2px", background: "#E72350", margin: "16px 0 40px" }} />
          <p style={{ fontSize: "12px", color: "#7E6F67" }}>expatevents.org · hello@expatevents.org</p>
        </div>
      </div>
    </div>

    {/* SLIDE 2: PROBLEM */}
    <div style={{ position: "relative", background: "#FCFAF8" }}>
      <div style={s.brandBar} />
      <div style={s.pad}>
        <div style={s.label()}>THE PROBLEM</div>
        <h2 style={{ fontSize: "32px", fontWeight: "bold" }}>Running a club shouldn't be this hard.</h2>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" as const, marginTop: "32px" }}>
          {[
            ["Scattered", "Members rely on WhatsApp groups, Telegram chats, and word of mouth. Events get lost in the noise."],
            ["No single hub", "No dedicated place to list your events, manage RSVPs, or grow your membership."],
            ["Missed reach", "Thousands of expats actively searching for exactly what your club offers — with no way to find you."],
          ].map(([title, desc]) => (
            <div key={title} style={{ background: "white", borderRadius: "8px", flex: "1", minWidth: "220px", border: "1px solid #F0EBE7", overflow: "hidden" }}>
              <div style={{ height: "5px", background: "#E72350" }} />
              <div style={{ padding: "20px 16px 24px" }}>
                <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "12px" }}>{title}</div>
                <div style={{ fontSize: "14px", color: "#7E6F67", lineHeight: "1.5" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* SLIDE 3: SOLUTION */}
    <div style={{ background: "#251D18", display: "flex", flexWrap: "wrap" as const }}>
      <div style={{ background: "#E72350", padding: "60px 24px", textAlign: "center" as const, flex: "1", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
        <div style={{ fontSize: "72px", fontWeight: "bold", color: "#F5A623" }}>1</div>
        <div style={{ fontWeight: "bold", fontSize: "18px", marginTop: "8px", color: "white" }}>platform</div>
        <div style={{ fontSize: "12px", color: "#FFBFC9" }}>for everything</div>
      </div>
      <div style={{ ...s.pad, flex: "2", color: "white" }}>
        <h3 style={{ fontSize: "28px", fontWeight: "bold" }}>ExpatEvents</h3>
        <p style={{ fontSize: "16px", color: "#B8AFA9", marginBottom: "32px" }}>One home for your club online.</p>
        {[
          ["Your group page", "A branded profile — banner, description, event listings, member directory."],
          ["Event management", "Create one-off or recurring events. Sell tickets. Track attendance."],
          ["Direct reach", "Notifications push your events to members whose interests match your category."],
          ["Picks of the Week", "Curated editorial features drive additional discovery and new membership."],
          ["Private events", "Members-only events that only your group can see."],
        ].map(([title, desc], idx) => (
          <div key={title} style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "flex-start" }}>
            <div style={{ background: "#E72350", color: "white", width: "28px", height: "28px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", flexShrink: 0 }}>{idx + 1}</div>
            <div>
              <h4 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}>{title}</h4>
              <p style={{ fontSize: "13px", color: "#B8AFA9", lineHeight: "1.4", margin: 0 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* SLIDE 4: BENEFITS */}
    <div style={{ position: "relative", background: "#FCFAF8" }}>
      <div style={s.brandBar} />
      <div style={s.pad}>
        <div style={s.label()}>WHAT YOUR CLUB GETS</div>
        <h2 style={{ fontSize: "32px", fontWeight: "bold" }}>Everything you need to grow.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "28px 40px", marginTop: "32px" }}>
          {[
            ["Group page", "Public profile with banner, logo, description, event feed and member count."],
            ["Recurring events", "Set weekly, fortnightly or monthly events once — instances generate automatically."],
            ["Up to 5 moderators", "Delegate event creation and member management to trusted team members."],
            ["Private events", "Host exclusive sessions visible only to members."],
            ["Invite-only mode", "Keep membership curated. Owner approves every join request."],
            ["Telegram alerts", "Members with matching interests get push notifications when you publish."],
            ["Ticket sales", "Built-in ticketing with custom pricing, quantity limits and per-order caps."],
            ["Curator features", "Eligible groups can be featured in weekly editorial picks."],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: "flex", gap: "12px" }}>
              <div style={{ width: "8px", height: "8px", background: "#E72350", borderRadius: "50%", marginTop: "6px", flexShrink: 0 }} />
              <div>
                <h4 style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "6px" }}>{title}</h4>
                <p style={{ fontSize: "13px", color: "#7E6F67", lineHeight: "1.4", margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* SLIDE 5: HOW IT WORKS */}
    <div style={{ position: "relative", background: "#251D18" }}>
      <div style={s.accentBar} />
      <div style={s.pad}>
        <div style={s.label("#F5A623")}>HOW IT WORKS</div>
        <h2 style={{ fontSize: "32px", fontWeight: "bold", color: "white" }}>Up and running in minutes.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px", marginTop: "40px" }}>
          {[
            ["01", "Sign up", "Create a free account at expatevents.org with Google or email."],
            ["02", "Upgrade", "Upgrade to Premium to unlock group creation."],
            ["03", "Create your group", "Set your name, slug, description, logo and membership type."],
            ["04", "Add moderators", "Invite up to 5 trusted members to help manage events."],
            ["05", "Publish events", "Create your first event — one-off or recurring."],
            ["06", "Grow", "Members find you through search, Picks, and Telegram notifications."],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px 16px" }}>
              <div style={{ background: "#E72350", color: "white", width: "36px", height: "28px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", marginBottom: "16px" }}>{num}</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px", color: "white" }}>{title}</div>
              <div style={{ fontSize: "13px", color: "#B8AFA9", lineHeight: "1.4" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* SLIDE 6: TIERS */}
    <div style={{ position: "relative", background: "#FCFAF8" }}>
      <div style={s.brandBar} />
      <div style={s.pad}>
        <div style={s.label()}>MEMBERSHIP TIERS</div>
        <h2 style={{ fontSize: "32px", fontWeight: "bold" }}>A plan for every club.</h2>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" as const, marginTop: "40px" }}>
          {[
            { name: "Free", tag: "Get started", highlight: false, features: ["Browse and attend events", "Set interests & availability", "Telegram notifications", "Join public groups"] },
            { name: "Premium", tag: "For active clubs", highlight: true, features: ["Everything in Free", "Create one group", "Recurring event scheduling", "Private events", "Up to 5 moderators", "Invite-only membership"] },
            { name: "Curator", tag: "For established hosts", highlight: false, features: ["Everything in Premium", "Write Picks of the Week", "Editorial event features", "Priority in search results", "Direct admin support"] },
          ].map(tier => (
            <div key={tier.name} style={{ flex: "1", background: tier.highlight ? "#E72350" : "white", borderRadius: "16px", padding: "24px 20px", border: tier.highlight ? "none" : "1px solid #F0EBE7", transform: tier.highlight ? "scale(1.02)" : "none", boxShadow: tier.highlight ? "0 12px 24px rgba(0,0,0,0.1)" : "none" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "4px", color: tier.highlight ? "white" : "#251D18" }}>{tier.name}</div>
              <div style={{ fontSize: "12px", marginBottom: "16px", opacity: 0.8, color: tier.highlight ? "#FFBFC9" : "#7E6F67" }}>{tier.tag}</div>
              {tier.features.map((feat, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", fontSize: "13px", color: tier.highlight ? "#FFBFC9" : "#251D18" }}>
                  <div style={{ width: "6px", height: "6px", background: tier.highlight ? "#F5A623" : "#E72350", borderRadius: "50%", flexShrink: 0 }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* SLIDE 7: OPPORTUNITY */}
    <div style={{ position: "relative", background: "#251D18" }}>
      <div style={s.brandBar} />
      <div style={s.pad}>
        <div style={s.label()}>THE OPPORTUNITY</div>
        <h2 style={{ fontSize: "32px", fontWeight: "bold", color: "white" }}>The expat community is large, engaged, and underserved.</h2>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" as const, margin: "40px 0" }}>
          {[
            ["50,000+", "Registered expats in top markets", "#E72350"],
            ["42%", "Actively look for community events", "#E72350"],
            ["3x", "More likely to join a club found online", "#E72350"],
            ["Zero", "Dedicated expat event platforms", "#F5A623"],
          ].map(([num, label, color]) => (
            <div key={num} style={{ flex: "1", background: "#1E1612", borderRadius: "12px", padding: "24px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px", color }}>{num}</div>
              <div style={{ fontSize: "12px", color: "#B8AFA9" }}>{label}</div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center" as const, fontStyle: "italic", color: "#7E6F67", marginTop: "40px" }}>
          "The first platform built specifically for expat community organising."
        </p>
      </div>
    </div>

    {/* SLIDE 8: CTA */}
    <div style={{ position: "relative", overflow: "hidden", textAlign: "center" as const, background: "#E72350" }}>
      <div style={{ position: "absolute", bottom: "-40px", right: "-40px", width: "200px", height: "200px", background: "#CF1E46", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: "20%", left: "-60px", width: "150px", height: "150px", background: "#CF1E46", borderRadius: "50%" }} />
      <div style={{ ...s.pad, position: "relative", zIndex: 2 }}>
        <div style={s.label("#FFBFC9")}>GET STARTED TODAY</div>
        <h2 style={{ fontSize: "44px", fontWeight: "bold", color: "white" }}>Ready to bring your club online?</h2>
        <p style={{ color: "#FFBFC9", fontSize: "16px", margin: "24px 0" }}>Join ExpatEvents and give your community the home it deserves.</p>
        <a href="/groups/create" style={{ background: "white", color: "#E72350", padding: "12px 32px", borderRadius: "40px", fontWeight: "bold", textDecoration: "none", display: "inline-block", marginTop: "24px", fontSize: "16px" }}>
          expatevents.org/groups/create
        </a>
        <p style={{ marginTop: "32px", color: "#FFBFC9" }}>Questions? hello@expatevents.org</p>
        <div style={{ textAlign: "center" as const, fontSize: "11px", color: "#CF1E46", marginTop: "60px" }}>
          ExpatEvents · The community events platform for expats · expatevents.org
        </div>
      </div>
    </div>
  </div>
);

export default PitchDeck;
