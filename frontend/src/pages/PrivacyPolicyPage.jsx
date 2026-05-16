export default function PrivacyPolicyPage() {
  return (
    <div className="policy-page">
      <h2>Privacy Policy</h2>
      <p className="policy-updated">Last updated: May 16, 2026</p>

      <div className="card">
        <h3>1. Introduction</h3>
        <p>
          Lattice ("we", "our", or "the Platform") is a programme-first relationship orchestration platform
          designed for startup ecosystems. This Privacy Policy describes how we collect, use, store, and protect
          your personal information when you interact with the Lattice platform.
        </p>

        <h3>2. Information We Collect</h3>
        <p>We may collect the following categories of information:</p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, organisation name, and role within the ecosystem (e.g. Admin, Startup, Contributor).</li>
          <li><strong>Profile Data:</strong> Industry sector, company stage, team size, problem statements, product descriptions, traction summaries, support needs, and current challenges.</li>
          <li><strong>Programme Data:</strong> Applications, admissions, contributor pool assignments, and programme-scoped relationships.</li>
          <li><strong>AI-Generated Data:</strong> Match scores, fit assessments, readiness ratings, recommendation explanations, auto-tags, and risk flags produced by our AI models.</li>
          <li><strong>Feedback &amp; Outcomes:</strong> Star ratings, qualitative feedback from startups and contributors, admin evaluations, and AI-derived learning lessons.</li>
          <li><strong>Usage Data:</strong> Pages visited, actions taken, timestamps, and browser/device metadata collected automatically for analytics and platform improvement.</li>
        </ul>

        <h3>3. How We Use Your Information</h3>
        <p>Your information is used to:</p>
        <ul>
          <li>Operate and maintain the Lattice platform and its programme orchestration workflows.</li>
          <li>Generate AI-powered recommendations, including programme fit scores, mentor matching, and readiness assessments.</li>
          <li>Facilitate structured feedback and outcome tracking to improve future matching quality.</li>
          <li>Provide ecosystem administrators with aggregated insights and demand signals.</li>
          <li>Communicate platform updates, programme notifications, and operational alerts.</li>
          <li>Comply with legal obligations and enforce our terms of service.</li>
        </ul>

        <h3>4. AI Processing &amp; Automated Decisions</h3>
        <p>
          Lattice uses Google Gemini AI and Firebase services to generate recommendations and assessments.
          AI-generated outputs (such as match scores and risk flags) are advisory in nature and are always
          subject to human review by ecosystem administrators before any formal action is taken. No fully
          automated decisions with legal or similarly significant effects are made without human oversight.
        </p>

        <h3>5. Data Sharing &amp; Third Parties</h3>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li><strong>Google Cloud / Firebase:</strong> For hosting, authentication, database storage, and AI model inference.</li>
          <li><strong>Ecosystem Administrators:</strong> Authorised programme managers who review recommendations and manage relationships within their ecosystem context.</li>
          <li><strong>Legal Authorities:</strong> When required by law, regulation, or valid legal process.</li>
        </ul>

        <h3>6. Data Retention</h3>
        <p>
          We retain your data for as long as your account is active or as needed to provide platform services.
          Programme-scoped data (applications, recommendations, relationships, and outcomes) is retained to
          support the AI learning loop and improve future matching quality. You may request deletion of your
          personal data at any time by contacting us.
        </p>

        <h3>7. Security</h3>
        <p>
          We implement industry-standard security measures including encrypted data transmission (TLS),
          Firebase Authentication with role-based access controls, and secure cloud infrastructure.
          However, no method of electronic transmission or storage is 100% secure.
        </p>

        <h3>8. Your Rights</h3>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal data.</li>
          <li>Object to or restrict certain processing activities.</li>
          <li>Request a portable copy of your data.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>To exercise these rights, contact us at <strong>privacy@lattice-platform.io</strong>.</p>

        <h3>9. Cookies &amp; Analytics</h3>
        <p>
          The platform may use essential cookies and local storage for authentication state and user preferences.
          We do not use third-party advertising trackers. Analytics data is collected in aggregate to improve
          platform performance and user experience.
        </p>

        <h3>10. Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated through
          the platform interface. Continued use of the platform after changes constitutes acceptance of the
          updated policy.
        </p>

        <h3>11. Contact Us</h3>
        <p>
          If you have questions about this Privacy Policy or our data practices, please contact us at:
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Lattice Ecosystem Platform</strong><br />
          Email: <a href="mailto:privacy@lattice-platform.io" style={{ color: '#004ac6' }}>privacy@lattice-platform.io</a>
        </p>
      </div>
    </div>
  );
}
