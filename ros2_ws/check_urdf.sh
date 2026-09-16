#!/bin/bash
source /opt/ros/humble/setup.bash
cd "/mnt/c/Users/adith/Downloads/Final Year Proj New/ros2_ws"
source install/setup.bash
xacro src/spotmicro_ag_sim/urdf/spotmicro.urdf.xacro > /tmp/r.urdf 2>/tmp/xerr.txt
if [ $? -ne 0 ]; then echo "XACRO FAILED:"; head -5 /tmp/xerr.txt; exit 1; fi
check_urdf /tmp/r.urdf 2>&1 | head -4
echo "imu plugin:        $(grep -c libgazebo_ros_imu_sensor /tmp/r.urdf)"
echo "position cmd ifcs: $(grep -c 'command_interface name="position"' /tmp/r.urdf)"
echo "links:             $(grep -c '<link name=' /tmp/r.urdf)"
