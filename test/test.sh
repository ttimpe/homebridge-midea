#!/bin/bash
screen -d -m -S homebridge
sleep 10
if ! screen -list | grep -q 'homebridge'; then
	echo "Error"
	exit -1
else
	killall screen
	exit 0
fi