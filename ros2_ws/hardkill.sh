#!/bin/bash
pkill -9 -f gzserver; pkill -9 -f gzclient; pkill -9 -f gait_controller
pkill -9 -f spawn_entity; pkill -9 -f robot_state_publisher; pkill -9 -f 'ros2 launch'
sleep 3
# wait for Gazebo's master port to actually release
for i in $(seq 1 15); do
  if ! (exec 3<>/dev/tcp/127.0.0.1/11345) 2>/dev/null; then echo "port 11345 free"; break; fi
  exec 3<&- 2>/dev/null; sleep 1
done
echo "gzserver=$(pgrep -c gzserver) gzclient=$(pgrep -c gzclient) gait=$(pgrep -cf gait_controller)"
