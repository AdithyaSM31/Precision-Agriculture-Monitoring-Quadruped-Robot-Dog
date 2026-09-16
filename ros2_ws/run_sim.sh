#!/bin/bash
# Launch the Gazebo simulation with the GUI.
#   ./run_sim.sh            -> crawl gait
#   ./run_sim.sh stand      -> hold a stance
#   ./run_sim.sh trot
GAIT="${1:-crawl}"
# SM_TETHERED=0 ./run_sim.sh  -> free-standing (falls over; see README)
export SM_TETHERED="${SM_TETHERED:-1}"

# WSL: Fast-DDS shared memory cannot lock files here, which breaks discovery.
export ROS_LOCALHOST_ONLY=1
rm -f /dev/shm/fastrtps_* /dev/shm/sem.fastrtps_* 2>/dev/null
[ -z "$DISPLAY" ] && export DISPLAY=:0

bash "/mnt/c/Users/adith/Downloads/Final Year Proj New/ros2_ws/hardkill.sh"
source /opt/ros/humble/setup.bash
cd "/mnt/c/Users/adith/Downloads/Final Year Proj New/ros2_ws"
source install/setup.bash
echo "DISPLAY=$DISPLAY  gait=$GAIT"
exec ros2 launch spotmicro_ag_sim gazebo.launch.py gui:=true gait:="$GAIT" 2>&1 | tee /tmp/gui_sim.log
