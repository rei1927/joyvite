#!/bin/bash
expect -c '
set timeout 180
spawn ssh -o StrictHostKeyChecking=no root@192.168.0.102 "rm -rf /tmp/joyvite-update && git clone https://github.com/rei1927/joyvite.git /tmp/joyvite-update && cd /tmp/joyvite-update && docker compose -f docker-compose.yml build --no-cache joyvite-backend && docker compose -f docker-compose.yml up -d joyvite-backend && sleep 5 && curl -s https://budi-andini.joyvite.id/ > /dev/null && docker logs joyvite-backend --tail 50"
expect {
    "password:" { send "Alamatgue123\r"; exp_continue }
    eof { }
}
'
