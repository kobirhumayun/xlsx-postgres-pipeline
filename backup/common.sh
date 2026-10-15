#!/bin/bash

# Remove only Prisma's schema parameter; libpq needs SSL and other connection
# options. node-postgres's no-verify spelling maps to libpq's TLS require mode.
configure_connection() {
    local connection="$1" base query item result="" separator=""
    if [[ ! "$connection" =~ ^postgres(ql)?:// ]] || [[ "$connection" == *'#'* ]]; then
        echo 'A valid PostgreSQL connection URI is required.' >&2
        return 1
    fi
    base="${connection%%\?*}"
    if [[ "$connection" == *'?'* ]]; then
        query="${connection#*\?}"
        local -a parameters
        IFS='&' read -ra parameters <<< "$query"
        for item in "${parameters[@]}"; do
            [[ -z "$item" || "${item%%=*}" == schema ]] && continue
            if [[ "$item" == 'sslmode=no-verify' ]]; then
                item='sslmode=require'
            fi
            result+="$separator$item"
            separator='&'
        done
    fi
    export PGDATABASE="$base${result:+?$result}"
    export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"
}

pg_psql() {
    # libpq does not expand a URI supplied only as the PGDATABASE default.
    # Explicit dbname enables URI parsing; never echo the connection string.
    "$PSQL_BIN" "$@" --dbname="$PGDATABASE"
}

# Resolve explicit versioned paths, never a distro wrapper's default version.
# PG_CLIENT_ROOT supports other installations: <root>/<major>/bin/<tool>.
client_binary() {
    local tool="$1" major="$2" candidate
    local -a candidates
    if [[ -n "${PG_CLIENT_ROOT:-}" ]]; then
        candidates=("$PG_CLIENT_ROOT/$major/bin/$tool")
    else
        candidates=("/usr/libexec/postgresql$major/$tool" "/usr/lib/postgresql/$major/bin/$tool")
        candidate=$(command -v "$tool" || true)
        [[ -z "$candidate" ]] || candidates+=("$candidate")
    fi
    for candidate in "${candidates[@]}"; do
        if [[ -x "$candidate" ]] && [[ "$(client_major "$candidate")" == "$major" ]]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

require_client() {
    local binary
    if binary=$(client_binary "$1" "$2"); then
        printf '%s\n' "$binary"
    else
        echo "Required PostgreSQL $2 $1 client is missing or has the wrong version. Install the matching client or rebuild both Docker images." >&2
        return 1
    fi
}

select_probe_client() {
    local major
    for major in 18 17 16; do
        if PSQL_BIN=$(client_binary psql "$major"); then return 0; fi
    done
    echo 'No supported psql client found. Install PostgreSQL 16, 17, or 18 clients.' >&2
    return 1
}

require_supported_major() {
    case "$1" in
        16|17|18) ;;
        *) echo "Unsupported $2 PostgreSQL major $1. Supported majors: 16, 17, 18." >&2; return 1 ;;
    esac
}

server_major() {
    local version
    version=$(pg_psql -X -A -t -v ON_ERROR_STOP=1 -c 'SHOW server_version_num;')
    [[ "$version" =~ ^[0-9]+$ ]] || { echo 'Could not determine PostgreSQL server version.' >&2; return 1; }
    echo "$((version / 10000))"
}

client_major() {
    "$1" --version | sed -nE 's/.*\) ([0-9]+).*/\1/p'
}
