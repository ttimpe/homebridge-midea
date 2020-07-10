#!/bin/bash
homebridge -D &
sleep 5
which pgrep
pgrep homebridge
if pgrep 'homebridge' >/dev/null
then
	echo "Homebrige is still running, success"
	pkill homebridge
	exit 0
else
	echo "Homebrige must have crashed or something"
	exit 1
fi