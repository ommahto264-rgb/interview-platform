import { Link } from 'react-router'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="landing-logo" aria-label="Interview Platform home">
          INTERVIEW<span> PLATFORM</span>
        </Link>

        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-visual">
            <div className="hero-glow" aria-hidden="true" />

            <figure className="code-preview">
              <figcaption className="code-preview-header">
                <span>Example interview challenge</span>
                <span>JavaScript</span>
              </figcaption>

              <div className="code-preview-body">
                <p className="code-preview-label">Add two numbers</p>

                <pre>
                  <code>
                    <span className="code-keyword">function</span>
                    {' solve(a, b) {\n'}
                    {'  '}
                    <span className="code-keyword">return</span>
                    {' a + b;\n'}
                    {'}'}
                  </code>
                </pre>
              </div>

              <div className="code-preview-result">
                <span>Example test</span>
                <code>solve(2, 3)</code>
                <span className="code-result-value">5</span>
              </div>

              <p className="code-preview-caption">
                A simple example. Your next challenge goes further.
              </p>
            </figure>

            <p className="hero-visual-note">
              THE CHALLENGE. THE CODE. THE CONVERSATION.
            </p>
          </div>

          <div className="hero-content">
            <p className="landing-eyebrow">
              A workspace for technical interviews
            </p>

            <h1 id="hero-title" className="hero-title">
              <span>INTERVIEW</span>
              <span>DIFFERENTLY.</span>
            </h1>

            <p className="hero-description">
              Give candidates room to solve. Give interviewers the evidence
              to evaluate. Bring challenges, code submissions and feedback
              into one place.
            </p>

            <div className="hero-actions">
              <Link to="/register" className="landing-button">
                Create an account
                <span aria-hidden="true">↗</span>
              </Link>

              <a href="#how-it-works" className="landing-text-link">
                Explore the workflow
              </a>
            </div>

            <p className="hero-footnote">
              For hiring teams and the people they interview.
            </p>
          </div>
        </section>

        <section
          id="features"
          className="landing-section"
          aria-labelledby="features-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">The essentials, connected</p>
            <h2 id="features-title">From challenge to decision.</h2>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="feature-number" aria-hidden="true">01</span>
              <h3>Purposeful challenges</h3>
              <p>
                Define the problem, provide starter code and build test cases.
                Assign a specific challenge version to each interview.
              </p>
            </article>

            <article className="landing-feature">
              <span className="feature-number" aria-hidden="true">02</span>
              <h3>Code with evidence</h3>
              <p>
                Evaluate submitted solutions against test cases and review
                the results alongside the candidate’s code.
              </p>
            </article>

            <article className="landing-feature">
              <span className="feature-number" aria-hidden="true">03</span>
              <h3>Structured feedback</h3>
              <p>
                Record problem-solving, code-quality and communication scores
                with written feedback and a recommendation.
              </p>
            </article>
          </div>
        </section>

        <section
          id="how-it-works"
          className="landing-section landing-workflow"
          aria-labelledby="workflow-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">How it works</p>
            <h2 id="workflow-title">One interview. A clear process.</h2>
          </div>

          <ol className="workflow-steps">
            <li>
              <h3>Prepare</h3>
              <p>Choose a challenge, assign an interviewer and schedule a time.</p>
            </li>

            <li>
              <h3>Interview</h3>
              <p>Invite the candidate, start the session and collect their solution.</p>
            </li>

            <li>
              <h3>Evaluate</h3>
              <p>Review the submitted code, test results and interviewer feedback.</p>
            </li>
          </ol>

          <Link to="/register" className="landing-button">
            Get started
            <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Interview Platform</p>
        <p>Make every technical conversation count.</p>
        <Link to="/login">Sign in</Link>
      </footer>
    </div>
  )
}