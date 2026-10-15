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
    psql "$@" --dbname="$PGDATABASE"
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
