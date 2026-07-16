#!/bin/bash
set -e
git add -A
git commit -m "$(cat <<'EOF'
Complete nutrition foundation (Ingredient/Product)

Add nutritionBasis, salt, source metadata and manual-override protection; wire through nutrition calculations,
update Ingredient/Product UI and validators, add household isolation tests, and harden CI/typecheck config.
EOF
)"
git status --short --branch
git log -1 --oneline
