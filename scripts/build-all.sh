#!/usr/bin/env bash
# Build every plugin into dist/<dir>.pbw for sideloading, the way publish.yml's build job does.
# Projects that need the Pebble SDK (watchapps with src/c, legacy apps) are skipped.
#
#   scripts/build-all.sh [--no-test] [dir...]
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
TEST=1
if [[ "${1:-}" == "--no-test" ]]; then TEST=0; shift; fi
USES_PERMISSIONS='.pebble | has("plugin") or has("usesPermissions")'

dirs=("$@")
if [[ ${#dirs[@]} -eq 0 ]]; then
  for d in */; do dirs+=("${d%/}"); done
fi

mkdir -p dist
built=() skipped=() failed=()
for dir in "${dirs[@]}"; do
  proj=$dir; [[ -f "$dir/pbw/package.json" ]] && proj=$dir/pbw
  [[ -f "$proj/package.json" ]] || continue
  [[ -n "$(jq -r '.pebble.uuid // empty' "$proj/package.json")" ]] || continue
  if [[ -d "$proj/src/c" ]] || ! jq -e "$USES_PERMISSIONS" "$proj/package.json" >/dev/null; then
    skipped+=("$dir"); continue
  fi
  echo "==> $dir"
  if (
    set -e
    case $dir in
      location-sharing) npm ci --silent --prefix chat/imessage
        cd "$dir"; npm ci --silent; node scripts/build-plugin.mjs
        [[ $TEST == 1 ]] && node --test plugin.test.cjs test/*.test.cjs ;;
      chat) cd "$dir"; npm ci --silent --prefix imessage; node scripts/build-plugin.mjs
        [[ $TEST == 1 ]] && node --test *.test.cjs ;;
      *) cd "$dir"
        if [[ -f package-lock.json ]]; then npm ci --silent; fi
        npm run build --if-present
        [[ $TEST == 1 ]] && npm test --if-present ;;
    esac
    true
  ) >"dist/$dir.log" 2>&1 && python3 scripts/pack-plugin-pbw.py "$proj" >>"dist/$dir.log" 2>&1; then
    cp "$proj/build/$(jq -r .name "$proj/package.json").pbw" "dist/$dir.pbw"
    built+=("$dir")
  else
    failed+=("$dir"); echo "    failed, see $ROOT/dist/$dir.log"
  fi
done

echo
echo "built:   ${built[*]:-none}"
echo "skipped: ${skipped[*]:-none} (need the Pebble SDK)"
echo "failed:  ${failed[*]:-none}"
[[ ${#failed[@]} -eq 0 ]]
