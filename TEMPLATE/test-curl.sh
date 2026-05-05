#!/bin/bash
expect -c '
set timeout 10
spawn ssh -o StrictHostKeyChecking=no root@192.168.0.102 "curl -s http://localhost:3000/invitation/budi-andini | head -20"
expect {
    "password:" { send "Alamatgue123\r"; exp_continue }
    eof { }
}
'
