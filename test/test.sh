#!/bin/bash
homebridge -D &
sleep 10
pgrep -x homebridge >> /dev/null && pkill homebridge && exit 0 || exit 1
