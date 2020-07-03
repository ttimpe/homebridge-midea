#!/bin/bash
homebridge -D &
sleep 10
pgrep -x homebridge >> /dev/null && exit 0 || exit 1
if ! screen -list | grep -q 'homebridge'; then
	echo "Error"
	exit -1
else
	killall homebridge
	exit 0
fi