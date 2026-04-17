#!/bin/bash
cd "$(dirname "$0")"
clear
echo "========================================================"
echo "        M ONITOR KLONING TEMPLATE M A S S A L           "
echo "========================================================"
echo "Tekan Ctrl + C untuk keluar dari monitor ini."
echo ""

# Menampilkan jumlah total target dari log
TOTAL=$(cat Scraped_Templates/found_links.log | wc -l | tr -d ' ')
echo "Total Target Keseluruhan: $TOTAL Template"
echo "--------------------------------------------------------"

# Ekor output log secara real-time
tail -f mass_clone.log
