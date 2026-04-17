#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

TARGET_DIR="$(cd "$(dirname "$0")" && pwd)/Scraped_Templates"
TIMEOUT=20
MAX_RETRIES=3

FAILED_TEMPLATES=(
  "tema-15-tanpa-foto"
  "tema-24-tanpa-foto"
  "tema-adat-aceh"
  "tema-adat-bali-tanpa-foto"
  "tema-adat-bugis-tanpa-foto"
  "tema-adat-bugis"
  "tema-adat-toraja-tanpa-foto"
  "tema-chinese-foto"
  "tema-chinese-tanpa-foto"
  "tema-natal-merah"
  "tema-natal-putih"
  "ultah-balon-biru"
  "ultah-black-and-gold-theme"
  "ultah-frozen-theme"
  "ultah-red-and-black-theme"
  "ultah-tema-hello-kitty"
  "ultah-tema-kastil-pink"
  "ultah-tema-laut"
  "wedding-tema-one-piece"
  "wedding-tema-tionghoa-foto"
  "wedding-tema-tionghoa"
  "wisuda-1"
  "wisuda-2"
  "wisuda-3"
  "wisuda-4"
)

echo "========================================"
echo " RETRY 25 TEMPLATE via WGET"
echo " Timeout: ${TIMEOUT}s | Max Retry: ${MAX_RETRIES}x"
echo "========================================"

STILL_FAILED=()
TOTAL=${#FAILED_TEMPLATES[@]}

for i in "${!FAILED_TEMPLATES[@]}"; do
  SLUG="${FAILED_TEMPLATES[$i]}"
  NUM=$((i + 1))
  URL="https://menujuacara.id/${SLUG}/"
  DEST="${TARGET_DIR}/${SLUG}"

  echo ""
  echo "[${NUM}/${TOTAL}] >>> ${SLUG}"

  # Hapus folder korup jika ada
  if [ -d "$DEST" ]; then
    rm -rf "$DEST"
  fi

  SUCCESS=false
  for ATTEMPT in $(seq 1 $MAX_RETRIES); do
    echo "  Percobaan ke-${ATTEMPT}..."

    # wget: -p = page-requisites (CSS/JS/images), -k = convert links, -E = extensions
    # --restrict-file-names=windows menghindari karakter ilegal
    # --no-host-directories & --cut-dirs=0 menjaga struktur folder bersih
    wget --quiet \
      --timeout=${TIMEOUT} \
      --tries=1 \
      --page-requisites \
      --convert-links \
      --adjust-extension \
      --restrict-file-names=windows \
      --no-host-directories \
      --directory-prefix="${DEST}" \
      --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
      --reject="*.lazcdn.com/*" \
      --exclude-domains="lazcdn.com,g.lazcdn.com,lazada.co.id,googletagmanager.com,facebook.com,instagram.com,whatsapp.com,whatsapp.net,static.cdninstagram.com,static.whatsapp.net,api.whatsapp.com" \
      "${URL}" 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "  ✅ Berhasil: ${SLUG}"
      SUCCESS=true
      break
    else
      echo "  ❌ Gagal, membersihkan..."
      rm -rf "$DEST"
      if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        echo "  Jeda 3 detik..."
        sleep 3
      fi
    fi
  done

  if [ "$SUCCESS" = false ]; then
    STILL_FAILED+=("$SLUG")
  fi
done

echo ""
echo "========================================"
echo " LAPORAN AKHIR"
echo "========================================"
RESCUED=$((TOTAL - ${#STILL_FAILED[@]}))
echo "Berhasil: ${RESCUED}/${TOTAL}"

if [ ${#STILL_FAILED[@]} -gt 0 ]; then
  echo "Masih gagal (${#STILL_FAILED[@]}):"
  for F in "${STILL_FAILED[@]}"; do
    echo "  - ${F}"
  done
else
  echo "SEMPURNA! Semua 25 template berhasil dikloning! 🎉"
fi
