// src/pages/PitchDeck.tsx
import React from 'react';

const PitchDeck: React.FC = () => {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* SLIDE 1: COVER */}
      <div className="slide bg-dark" style={{ position: 'relative', overflow: 'hidden', background: '#251D18' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '45%', height: '55%', background: '#E72350', clipPath: 'polygon(40% 0, 100% 0, 100% 100%, 0% 100%)' }}></div>
        <div style={{ position: 'absolute', bottom: '30px', left: '30px', width: '180px', height: '180px', background: '#3A2820', borderRadius: '50%' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px', position: 'relative', zIndex: 2, color: 'white' }}>
          <div style={{ display: 'flex', gap: '4px', fontSize: '20px', fontWeight: 'bold', marginBottom: '60px' }}>
            <span style={{ color: '#E72350' }}>EXPAT</span><span>EVENTS</span>
          </div>
          <div style={{ marginTop: '80px' }}>
            <h1 style={{ fontSize: '52px', lineHeight: '1.2' }}>Your club.</h1>
            <h1 style={{ fontSize: '52px', color: '#E72350' }}>More members.</h1>
            <h1 style={{ fontSize: '52px' }}>Zero hassle.</h1>
            <p style={{ fontSize: '16px', color: '#B8AFA9', margin: '24px 0 16px' }}>The expat community platform for Moscow clubs & groups</p>
            <div style={{ width: '80px', height: '2px', background: '#E72350', margin: '16px 0 40px' }}></div>
            <p style={{ fontSize: '12px', color: '#7E6F67' }}>expatevents.org  ·  hello@expatevents.org</p>
          </div>
        </div>
      </div>

      {/* SLIDE 2: PROBLEM */}
      <div className="slide bg-warm" style={{ position: 'relative', background: '#FCFAF8' }}>
        <div className="brand-bar" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: '#E72350' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px' }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#E72350' }}>THE PROBLEM</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>Running a club in Moscow<br />shouldn't be this hard.</h2>
          <div className="card-grid" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '32px' }}>
            <div className="card" style={{ background: 'white', borderRadius: '8px', flex: '1', minWidth: '220px', border: '1px solid #F0EBE7', overflow: 'hidden' }}>
              <div style={{ height: '5px', background: '#E72350' }}></div>
              <div className="card-content" style={{ padding: '20px 16px 24px' }}>
                <div className="card-title" style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '12px' }}>Scattered</div>
                <div className="card-text" style={{ fontSize: '14px', color: '#7E6F67', lineHeight: '1.5' }}>Members rely on WhatsApp groups, Telegram chats, and word of mouth. Events get lost in the noise.</div>
              </div>
            </div>
            <div className="card" style={{ background: 'white', borderRadius: '8px', flex: '1', minWidth: '220px', border: '1px solid #F0EBE7', overflow: 'hidden' }}>
              <div style={{ height: '5px', background: '#E72350' }}></div>
              <div className="card-content" style={{ padding: '20px 16px 24px' }}>
                <div className="card-title" style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '12px' }}>No single hub</div>
                <div className="card-text" style={{ fontSize: '14px', color: '#7E6F67', lineHeight: '1.5' }}>No dedicated place to list your events, manage RSVPs, or grow your membership.</div>
              </div>
            </div>
            <div className="card" style={{ background: 'white', borderRadius: '8px', flex: '1', minWidth: '220px', border: '1px solid #F0EBE7', overflow: 'hidden' }}>
              <div style={{ height: '5px', background: '#E72350' }}></div>
              <div className="card-content" style={{ padding: '20px 16px 24px' }}>
                <div className="card-title" style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '12px' }}>Missed reach</div>
                <div className="card-text" style={{ fontSize: '14px', color: '#7E6F67', lineHeight: '1.5' }}>Thousands of expats actively searching for exactly what your club offers — with no way to find you.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SLIDE 3: SOLUTION */}
      <div className="slide bg-dark" style={{ background: '#251D18', display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ background: '#E72350', padding: '60px 24px', textAlign: 'center', flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '40px' }}>THE SOLUTION</div>
          <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#F5A623' }}>1</div>
          <div style={{ fontWeight: 'bold', fontSize: '18px', marginTop: '8px' }}>platform</div>
          <div style={{ fontSize: '12px', color: '#FFBFC9' }}>for everything</div>
        </div>
        <div className="section-padding" style={{ padding: '40px 32px 60px', flex: '2', color: 'white' }}>
          <h3 style={{ fontSize: '28px', fontWeight: 'bold' }}>ExpatEvents</h3>
          <p style={{ fontSize: '16px', color: '#B8AFA9', marginBottom: '32px' }}>One home for your club online.</p>
          <div>
            {[
              { title: "Your group page", desc: "A branded profile for your club — banner, description, event listings, member directory." },
              { title: "Event management", desc: "Create one-off or recurring events. Sell tickets. Track attendance." },
              { title: "Direct reach", desc: "Notifications push your events to members whose interests match your category." },
              { title: "Picks of the Week", desc: "Curated editorial features drive additional discovery and new membership." },
              { title: "Private events", desc: "Members-only events that only your group can see — perfect for exclusive sessions." }
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-start' }}>
                <div style={{ background: '#E72350', color: 'white', width: '28px', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>{idx+1}</div>
                <div><h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{item.title}</h4><p style={{ fontSize: '13px', color: '#B8AFA9', lineHeight: '1.4' }}>{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLIDE 4: BENEFITS */}
      <div className="slide bg-warm" style={{ position: 'relative', background: '#FCFAF8' }}>
        <div className="brand-bar" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: '#E72350' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px' }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#E72350' }}>WHAT YOUR CLUB GETS</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>Everything you need to grow.</h2>
          <div className="benefit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '28px 40px', marginTop: '32px' }}>
            {[
              ["Group page", "Public-facing profile with banner, logo, description, event feed and member count."],
              ["Recurring events", "Set weekly, fortnightly or monthly events once — instances generate automatically."],
              ["Up to 5 moderators", "Delegate event creation and member management to trusted team members."],
              ["Private events", "Host exclusive sessions visible only to members — ideal for competitions or workshops."],
              ["Invite-only mode", "Keep membership curated. Owner approves every join request."],
              ["Telegram alerts", "Members with matching interests receive push notifications the moment you publish."],
              ["Ticket sales", "Built-in ticketing with custom pricing, quantity limits and per-order caps."],
              ["Curator features", "Eligible groups can be featured in weekly editorial picks — free promotion to the whole network."]
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', background: '#E72350', borderRadius: '50%', marginTop: '6px' }}></div>
                <div><h4 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>{title}</h4><p style={{ fontSize: '13px', color: '#7E6F67', lineHeight: '1.4' }}>{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLIDE 5: HOW IT WORKS */}
      <div className="slide bg-dark" style={{ position: 'relative', background: '#251D18' }}>
        <div className="brand-bar brand-bar-accent" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: '#F5A623' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px' }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#F5A623' }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>Up and running in minutes.</h2>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginTop: '40px' }}>
            {[
              ["01", "Sign up", "Create a free account at expatevents.org with Google or email."],
              ["02", "Upgrade", "Upgrade to Premium to unlock group creation — one group per membership."],
              ["03", "Create your group", "Set your name, slug, description, logo and membership type. Takes under 5 minutes."],
              ["04", "Add moderators", "Invite up to 5 trusted members to help manage events and membership."],
              ["05", "Publish events", "Create your first event — one-off or recurring. Set tickets, location, privacy."],
              ["06", "Grow", "Members find you through search, Picks of the Week, and Telegram notifications."]
            ].map(([num, title, desc]) => (
              <div key={num} className="step-card" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px 16px' }}>
                <div style={{ background: '#E72350', color: 'white', width: '36px', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '16px' }}>{num}</div>
                <div className="step-title" style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px', color: 'white' }}>{title}</div>
                <div className="step-desc" style={{ fontSize: '13px', color: '#B8AFA9', lineHeight: '1.4' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLIDE 6: TIERS */}
      <div className="slide bg-warm" style={{ position: 'relative', background: '#FCFAF8' }}>
        <div className="brand-bar" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: '#E72350' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px' }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#E72350' }}>MEMBERSHIP TIERS</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>A plan for every club.</h2>
          <div className="pricing-grid" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '40px' }}>
            {[
              { name: "Free", tag: "Get started", features: ["Browse and attend events", "Set interests & availability", "Telegram notifications", "Join public groups"], highlight: false },
              { name: "Premium", tag: "For active clubs", features: ["Everything in Free", "Create one group", "Recurring event scheduling", "Private events", "Up to 5 moderators", "Invite-only membership"], highlight: true },
              { name: "Curator", tag: "For established hosts", features: ["Everything in Premium", "Write Picks of the Week", "Editorial event features", "Priority in search results", "Direct admin support"], highlight: false }
            ].map((tier) => (
              <div key={tier.name} className={`pricing-card ${tier.highlight ? 'highlight' : ''}`} style={{ flex: '1', background: tier.highlight ? '#E72350' : 'white', borderRadius: '16px', padding: '24px 20px', border: tier.highlight ? 'none' : '1px solid #F0EBE7', transform: tier.highlight ? 'scale(1.02)' : 'none', boxShadow: tier.highlight ? '0 12px 24px rgba(0,0,0,0.1)' : 'none' }}>
                <div className="pricing-title" style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', color: tier.highlight ? 'white' : '#251D18' }}>{tier.name}</div>
                <div className="pricing-tag" style={{ fontSize: '12px', marginBottom: '16px', opacity: 0.8, color: tier.highlight ? '#FFBFC9' : '#7E6F67' }}>{tier.tag}</div>
                {tier.features.map((feat, idx) => (
                  <div key={idx} className="pricing-feature" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', fontSize: '13px', color: tier.highlight ? '#FFBFC9' : '#251D18' }}>
                    <div className="feature-dot" style={{ width: '6px', height: '6px', background: tier.highlight ? '#F5A623' : '#E72350', borderRadius: '50%' }}></div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLIDE 7: OPPORTUNITY */}
      <div className="slide bg-dark" style={{ position: 'relative', background: '#251D18' }}>
        <div className="brand-bar" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: '#E72350' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px' }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#E72350' }}>THE OPPORTUNITY</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>Moscow's expat community is large,<br />engaged, and underserved.</h2>
          <div className="stats-row" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '40px 0' }}>
            {[
              ["50,000+", "Registered expats living in Moscow", "#E72350"],
              ["42%", "Actively look for community events", "#E72350"],
              ["3x", "More likely to join a club found online", "#E72350"],
              ["Zero", "Dedicated expat event platforms", "#F5A623"]
            ].map(([num, label, color]) => (
              <div key={num} className="stat-card" style={{ flex: '1', background: '#1E1612', borderRadius: '12px', padding: '24px 12px', textAlign: 'center' }}>
                <div className="stat-number" style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color }}>{num}</div>
                <div className="stat-label" style={{ fontSize: '12px', color: '#B8AFA9' }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: '#7E6F67', marginTop: '40px' }}>"The first platform built specifically for expat community organising in Russia."</p>
        </div>
      </div>

      {/* SLIDE 8: CTA */}
      <div className="slide bg-red" style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', background: '#E72350' }}>
        <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '200px', height: '200px', background: '#CF1E46', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', top: '20%', left: '-60px', width: '150px', height: '150px', background: '#CF1E46', borderRadius: '50%' }}></div>
        <div className="section-padding" style={{ padding: '40px 32px 60px', position: 'relative', zIndex: 2 }}>
          <div className="section-label" style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#FFBFC9' }}>GET STARTED TODAY</div>
          <h2 style={{ fontSize: '44px', fontWeight: 'bold', color: 'white' }}>Ready to bring your<br />club online?</h2>
          <p style={{ color: '#FFBFC9', fontSize: '16px', margin: '24px 0' }}>Join ExpatEvents and give your community the home it deserves.</p>
          <a href="#" className="cta-button" style={{ background: 'white', color: '#E72350', padding: '12px 32px', borderRadius: '40px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginTop: '24px', fontSize: '16px' }}>expatevents.org/groups/create</a>
          <p style={{ marginTop: '32px', color: '#FFBFC9' }}>Questions? hello@expatevents.org</p>
          <div className="footer" style={{ textAlign: 'center', fontSize: '11px', color: '#CF1E46', marginTop: '60px' }}>ExpatEvents  ·  The community events platform for Moscow expats  ·  expatevents.org</div>
        </div>
      </div>
    </div>
  );
};

export default PitchDeck;
