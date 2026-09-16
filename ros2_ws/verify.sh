#!/bin/bash
export ROS_LOCALHOST_ONLY=1
rm -f /dev/shm/fastrtps_* /dev/shm/sem.fastrtps_* 2>/dev/null
pkill -9 -f gzserver; pkill -9 -f gzclient; pkill -9 -f gait_controller; sleep 2
source /opt/ros/humble/setup.bash
cd "/mnt/c/Users/adith/Downloads/Final Year Proj New/ros2_ws"
colcon build --symlink-install 2>&1 | grep -E 'Finished|Failed'
source install/setup.bash
ros2 daemon stop >/dev/null 2>&1; sleep 1
ros2 launch spotmicro_ag_sim gazebo.launch.py gui:=false gait:="${1:-crawl}" > /tmp/sim.log 2>&1 &
LP=$!
sleep 18
echo "===== body pose, 4 s apart (x y z roll pitch yaw) ====="
for i in 1 2 3 4 5 6; do
  printf "%2ds  " $((18+i*4))
  gz model -w crop_field -m spotmicro_ag -p 2>&1 | tail -1
  sleep 4
done
echo "===== topics ====="
timeout 10 ros2 topic list 2>/dev/null | grep -E 'imu|joint_states|leg_position'
echo "===== IMU orientation ====="
timeout 10 ros2 topic echo /imu/data --once 2>/dev/null | sed -n '/^orientation:/,/^  w:/p'
echo "===== errors ====="
grep -iE '\[ERROR\]' /tmp/sim.log | grep -viE 'ALSA|OpenAL' | head -5
kill $LP 2>/dev/null; sleep 2; pkill -9 -f gzserver
