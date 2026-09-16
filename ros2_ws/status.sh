#!/bin/bash
export ROS_LOCALHOST_ONLY=1
source /opt/ros/humble/setup.bash
cd "/mnt/c/Users/adith/Downloads/Final Year Proj New/ros2_ws"
source install/setup.bash
echo "=== processes ==="
echo "gzserver=$(pgrep -c gzserver)  gzclient=$(pgrep -c gzclient)  gait=$(pgrep -cf gait_controller)"
echo "=== body pose over 20 s (x y z roll pitch yaw) ==="
for i in 1 2 3 4 5; do
  printf "%2ds  " $((i*4))
  gz model -w crop_field -m spotmicro_ag -p 2>&1 | tail -1
  sleep 4
done
echo "=== live ROS topics ==="
timeout 10 ros2 topic list 2>/dev/null | grep -E 'imu|joint_states|leg_position' 
echo "=== IMU sample ==="
timeout 10 ros2 topic echo /imu/data --once 2>/dev/null | sed -n '/orientation:/,/w:/p' | head -6
