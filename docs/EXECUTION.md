# Submission execution

This update connects the existing interview submission API to a durable queue,
a worker, Docker execution, trusted grading, and authorized result retrieval.
It supports JavaScript solutions that define `function solve(...args)` and return
a JSON-compatible value. Async functions are supported. No npm packages are installed
for candidates. Numeric values follow JavaScript number semantics.

## Apply to your existing project

Stop the API and any old demo worker first. Download `interview-execution-update.zip`
to Windows `D:\DOWNLOADS`. In WSL:

```bash
cd ~/projects/interview-platform
unzip /mnt/d/DOWNLOADS/interview-execution-update.zip -d /tmp/interview-execution-update
python3 /tmp/interview-execution-update/apply-update.py "$PWD"
npm ci
npm run typecheck
npm test
npm run db:migrate
npm run runner:build
npm run test:docker
```

The installer checks the files against the uploaded source before overwriting them.
It stops if a target file has changed, and backs up overwritten files under
`/tmp/interview-execution-backup-*`. It never edits `.env` or `.git`, runs migrations,
or starts processes. No existing migration is edited. Migration 011 adds the queue
and an optional submission request key. Do not fake this migration.

The runner uses defaults, so existing `.env` values can remain. Optional settings
are documented in `.env.example`. Keep the same `WORKER_NAMESPACE` for workers using
the same database on one Docker daemon. Use different namespaces for different databases.

Start in separate WSL terminals, from the project root:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

Keep Docker Desktop running. The worker does not use watch mode: restarting it for
unrelated edits would interrupt active candidate executions. Ctrl+C shuts it down
and releases the current job for retry when possible.

## Try the real feature

Use a new or currently active interview with an accepted candidate and test cases.
Your previously completed interview cannot accept new submissions. Sign in as its
candidate using the existing login endpoint and save the cookie jar. Then:

```bash
# Replace this with your ACTIVE interview ID.
INTERVIEW_ID="your-active-interview-uuid"
# Use the cookie file from candidate login in this SAME terminal.
# CANDIDATE_COOKIE_FILE=/path/to/your/candidate-cookie-file
REQUEST_KEY=$(node -p 'require("crypto").randomUUID()')
RESPONSE_HEADERS=$(mktemp)
curl -sS -D "$RESPONSE_HEADERS" \
  -b "${CANDIDATE_COOKIE_FILE:?Log in as the candidate first}" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $REQUEST_KEY" \
  "http://127.0.0.1:3000/api/candidate/interviews/$INTERVIEW_ID/submissions" \
  -d '{"sourceCode":"function solve(a, b) { return a + b; }"}'
RESULT_PATH=$(awk 'tolower($1)=="location:" {gsub("\r", "", $2); print $2}' "$RESPONSE_HEADERS")
rm "$RESPONSE_HEADERS"
curl -sS -b "$CANDIDATE_COOKIE_FILE" \
  "http://127.0.0.1:3000${RESULT_PATH:?Submission failed; read the response above}"
```

Repeat the final GET after a few seconds. Do not resubmit just to check status.
The POST keeps a message-only JSON response and returns HTTP 201 because a submission
resource was created. Its `Location` header points to the result. The optional UUID
`Idempotency-Key` prevents duplicate work when retrying the same HTTP request.
Use a new key for a new solution; reusing a key with different code returns 409.

Example result (IDs and timestamps omitted here):

```json
{
  "execution": {
    "status": "COMPLETED",
    "verdict": "ACCEPTED",
    "passed_tests": 3,
    "total_tests": 3,
    "results": [
      {"position": 1, "is_hidden": false, "verdict": "ACCEPTED", "duration_ms": 210}
    ]
  }
}
```

A candidate can read only their own execution, including after the interview ends.
Hidden cases contribute to totals but are omitted from the candidate's case list.
Assigned interviewers and organization admins can read all per-case verdicts using:

`GET /api/organizations/:organizationId/interviews/:interviewId/submissions/:submissionId/execution`

Neither endpoint returns expected answers, hidden inputs, stdout, stderr, source
snapshots, lease tokens, or database details. Staff continue to view submitted code
through the existing submission-list endpoint.

Historical submissions are preserved but not automatically queued. A historical
submission with no execution returns 404 on the new execution endpoint.

## How it works

1. Authentication identifies the candidate. The API locks the interview row and
   checks assignment, status and schedule. This coordinates with completion/start.
2. The API saves the submission and execution job in one PostgreSQL transaction.
   It snapshots the assigned version's tests and the submitted source. Later edits
   cannot change a queued job. At most three queued/running submissions are allowed
   per interview, with a two-second submission cooldown.
3. The worker claims a job with `FOR UPDATE SKIP LOCKED`. Multiple workers cannot
   claim the same live job. Each process executes one job at a time.
4. Every test gets a fresh container. Only source and that test's input go in.
   The host compares the returned JSON value to the expected answer. Objects are
   compared structurally; array order and JSON types matter.
5. Completion saves verdicts and counts only if the worker still holds the lease.
   Results never trust a candidate-supplied score or pass/fail claim.

PostgreSQL is the queue here because it lets submission creation and enqueueing
commit together without introducing another service. Redis caching can be added
for a measured need later; execution correctness does not depend on a cache.

### Job states

`QUEUED → RUNNING → COMPLETED` is the normal path. `COMPLETED` means grading
finished, not necessarily that the answer was correct. The verdict is one of:

- `ACCEPTED`
- `WRONG_ANSWER`
- `TIME_LIMIT_EXCEEDED`
- `OUTPUT_LIMIT_EXCEEDED`
- `RUNTIME_ERROR` (includes memory exhaustion and invalid return values)

Infrastructure errors requeue after ten seconds, up to three attempts. Exhausted
jobs become `FAILED` with no candidate verdict. A new valid submission is needed
after terminal failure; this increment does not add an admin requeue interface.

A lease lasts 60 seconds and is renewed every ten seconds. Crashed jobs can be
claimed after expiry. Stale workers cannot overwrite results from a new attempt.
Containers left by an interrupted worker are cleaned on restart and during periodic
sweeps. If all workers are stopped, cleanup waits until a worker starts again.

### Execution limits

- 128 MiB container memory, no additional swap; Node heap capped at 64 MiB.
- 0.5 CPU, 32 processes, read-only root filesystem, dropped capabilities,
  no-new-privileges, non-root user, no network, no host mounts or credentials.
- Five-second wall limit per case, including `docker start` overhead. It is a
  practical local limit, not a precise CPU benchmark.
- 64 KiB combined stdout/stderr; output is discarded after grading.
- Source up to 10 KiB, 1–100 tests, bounded total snapshot size.
- No Docker logs retained for candidate containers. Explicit forced cleanup runs
  after each case, including timeout and cancellation.
- The image tag is resolved to its image ID at worker startup and recorded with
  completed results. Rebuild and restart the worker when changing the runner.

## Verification

```bash
npm run typecheck
npm test
npm run runner:build
npm run test:docker
```

`test:docker` runs real container checks: correct values, Unicode, infinite loops,
output floods, runtime errors, read-only filesystem, missing secrets, network
namespace and cleanup. It does not connect to Neon.

For integration tests, use a **separate** PostgreSQL database whose name ends in
`_test`. The tests create and remove a temporary schema; they refuse other names.
Never point them at the existing `neondb` project database.

```bash
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@HOST/interview_platform_test'
npm run test:integration
# Also execute API → queue → actual Docker worker:
RUN_DOCKER_E2E=1 npm run test:integration
unset TEST_DATABASE_URL
```

The included GitHub Actions workflow uses temporary PostgreSQL and runs typecheck,
unit tests, Docker tests and the complete pipeline. It requires no Neon credentials.
Commit and push to your own repository to run it; this update has not been pushed.

Verified while preparing this update: TypeScript, 7 judge/runner-protocol tests and 10 integration
tests on temporary PostgreSQL 18.6. Test runtime was Node 24.22.1; CI targets Node 22.
All 11 migrations applied with node-pg-migrate; a second run had no pending migrations.
Docker is unavailable in the build workspace, so the container tests and actual
Docker pipeline remain to be verified on WSL or CI. They are not claimed as passed.

## Deployment boundary

This is a working execution feature for local development and a controlled portfolio
demo, pending the Docker checks above. Standard Docker isolation shares a kernel;
it is not a sufficient claim of hardened public execution for arbitrary strangers.
Before public launch, use a dedicated execution host with a stronger installed
runtime (for example gVisor via `RUNNER_RUNTIME=runsc`), restricted database roles,
operational monitoring, dependency/image updates, and an end-to-end security review.
The Docker-capable worker must remain separate from the public API. Never mount the
Docker socket or the project directory into candidate containers.

Existing auth still needs its own launch review (email delivery/verification,
CSRF policy, rate limits and session controls). This update does not claim to finish
those unrelated areas, the frontend, or the rest of the interview platform.

References:
- https://www.postgresql.org/docs/current/sql-select.html (queue row locking)
- https://docs.docker.com/engine/containers/run/ (resource and security options)
- https://docs.docker.com/engine/security/ (container security boundaries)
