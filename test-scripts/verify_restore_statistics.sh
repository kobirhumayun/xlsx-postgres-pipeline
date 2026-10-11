#!/bin/bash
# Run with bash verify_restore_statistics.sh /path/to/backup/restore.sh.
# Uses a fake psql executable; never connects to a database.
set -euo pipefail
RESTORE_SCRIPT=$(realpath "$1")
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir "$TEST_DIR/bin"
printf 'SELECT 1;\n' | gzip > "$TEST_DIR/fixture.sql.gz"
cat > "$TEST_DIR/bin/psql" <<'STUB'
#!/bin/bash
set -eu
printf '%s | %s\n' "$*" "${PGOPTIONS:-}" >> "$TRACE_FILE"
if [[ "$*" == *"ANALYZE;"* ]]; then
    if [[ "$TEST_MODE" == analyze-failure ]]; then exit 1; fi
else
    cat >/dev/null
    if [[ "$TEST_MODE" == restore-failure ]]; then exit 1; fi
fi
STUB
chmod +x "$TEST_DIR/bin/psql"
export PATH="$TEST_DIR/bin:$PATH"
export DATABASE_URL='postgresql://test.invalid/test?schema=public'
export TRACE_FILE="$TEST_DIR/trace"
export TEST_MODE=success
bash "$RESTORE_SCRIPT" "$TEST_DIR/fixture.sql.gz" > "$TEST_DIR/output" 2>&1
grep -q -- '-X -v ON_ERROR_STOP=1 postgresql://test.invalid/test' "$TRACE_FILE"
grep -q 'ANALYZE;' "$TRACE_FILE"
grep -q 'statement_timeout=60000 -c lock_timeout=5000' "$TRACE_FILE"
grep -q 'statistics refresh finished' "$TEST_DIR/output"

: > "$TRACE_FILE"
export TEST_MODE=restore-failure
if bash "$RESTORE_SCRIPT" "$TEST_DIR/fixture.sql.gz" > "$TEST_DIR/output" 2>&1; then
    echo 'Failed restore unexpectedly succeeded' >&2
    exit 1
fi
if grep -q 'ANALYZE;' "$TRACE_FILE"; then
    echo 'Statistics refreshed after a failed restore' >&2
    exit 1
fi

: > "$TRACE_FILE"
export TEST_MODE=analyze-failure
bash "$RESTORE_SCRIPT" "$TEST_DIR/fixture.sql.gz" > "$TEST_DIR/output" 2>&1
grep -q 'Data restore completed, but statistics refresh failed' "$TEST_DIR/output"
echo 'Restore statistics checks passed: success, restore failure, maintenance failure.'
