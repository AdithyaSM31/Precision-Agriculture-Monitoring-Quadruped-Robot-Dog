"""Open RViz on the running simulation: robot model, TF tree and live IMU.

Run this in a second terminal while gazebo.launch.py is up:
    ros2 launch spotmicro_ag_sim rviz.launch.py
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    pkg = get_package_share_directory('spotmicro_ag_sim')
    cfg = os.path.join(pkg, 'config', 'view.rviz')

    return LaunchDescription([
        Node(package='rviz2', executable='rviz2', output='screen',
             arguments=['-d', cfg],
             parameters=[{'use_sim_time': True}]),
    ])
