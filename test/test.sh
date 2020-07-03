#!/bin/bash
homebridge -D &
sleep 10
which pgrep
ps aux | grep homebridge
if pgrep 'homebridge' >/dev/null
then
	echo "Homebrige is still running, success"
	pkill homebridge
	exit 0
else
	echo "Homebrige must have crashed or something"
	exit 1
fi