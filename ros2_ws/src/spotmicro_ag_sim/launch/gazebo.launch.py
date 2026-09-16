"""Bring up Gazebo, spawn the quadruped, start ros2_control, then walk it."""
import os
from ament_index_python.packages import (get_package_share_directory,
                                         get_package_prefix)
from launch import LaunchDescription
from launch.actions import (DeclareLaunchArgument, ExecuteProcess,
                            RegisterEventHandler)
from launch.conditions import IfCondition
from launch.event_handlers import OnProcessExit
from launch.substitutions import LaunchConfiguration, Command
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

def generate_launch_description():
    pkg = get_package_share_directory('spotmicro_ag_sim')
    # tethered: base pinned to the world so the legs run the gait with the feet
    # clear of the ground -- the same 'robot on a stand' step used during real
    # hardware bring-up. Set tethered:=false to let it stand on its own.
    tethered = os.environ.get('SM_TETHERED', '1') != '0'
    urdf_name = 'spotmicro_tethered.urdf.xacro' if tethered else 'spotmicro.urdf.xacro'
    xacro_file = os.path.join(pkg, 'urdf', urdf_name)
    # Tethered: pin at the 150 mm stance height so the feet actually reach the
    # ground and step on it, rather than cycling in mid-air. The base is held,
    # so the robot walks in place -- a treadmill, not free locomotion.
    spawn_z = '0.158' if tethered else '0.245'
    world = os.path.join(pkg, 'worlds', 'crop_field.world')

    gait = LaunchConfiguration('gait')
    gui = LaunchConfiguration('gui')

    # Quote the path: workspace directories containing spaces otherwise get split
    # into several arguments and xacro rejects them.
    # ParameterValue(..., value_type=str) is required: without it launch tries to
    # parse the generated URDF as YAML and fails on the first colon it meets.
    robot_description = {'robot_description': ParameterValue(
        Command(['xacro ', '"', xacro_file, '"']), value_type=str)}

    # gzserver is started directly rather than via gazebo_ros/gazebo.launch.py,
    # which does not forward the factory flag. The plugin paths are absolute
    # because GAZEBO_PLUGIN_PATH is not always populated by sourcing the ROS
    # setup, and gzserver then silently fails to find them -- no /spawn_entity.
    gz_lib = os.path.join(get_package_prefix('gazebo_ros'), 'lib')
    gzserver = ExecuteProcess(
        cmd=['gzserver', '--verbose', world,
             '-s', os.path.join(gz_lib, 'libgazebo_ros_init.so'),
             '-s', os.path.join(gz_lib, 'libgazebo_ros_factory.so')],
        output='screen')
    gzclient = ExecuteProcess(cmd=['gzclient'], output='screen',
                              condition=IfCondition(gui))

    rsp = Node(package='robot_state_publisher', executable='robot_state_publisher',
               output='screen',
               parameters=[robot_description, {'use_sim_time': True}])

    # Spawned at the 150 mm stance height (joint angles come from
    # <param name="initial_value"> in the URDF's ros2_control block). With a
    # position interface the joints hold their commanded angle from the first
    # physics step, so there is no limp window to fall through. -J cannot be used
    # instead: argparse reads the negative knee angle as a flag.
    spawn = Node(package='gazebo_ros', executable='spawn_entity.py', output='screen',
                 arguments=['-topic', 'robot_description',
                            '-entity', 'spotmicro_ag', '-z', spawn_z,
                            # single dash: spawn_entity uses -timeout, not --timeout.
                            # Default 30 s can be outrun while
                            # gzserver is still loading the crop models
                            '-timeout', '120'])

    # Both spawners start immediately and retry until the controller_manager
    # appears, rather than being chained behind spawn_entity. Chaining them cost
    # ~10 s, and the robot is limp until the servo controller is active -- long
    # enough to topple. In parallel the window is a couple of seconds.
    jsb = Node(package='controller_manager', executable='spawner', output='screen',
               arguments=['joint_state_broadcaster',
                          '--controller-manager', '/controller_manager',
                          '--controller-manager-timeout', '60'])
    legs = Node(package='controller_manager', executable='spawner', output='screen',
                arguments=['leg_effort_controller',
                           '--controller-manager', '/controller_manager',
                           '--controller-manager-timeout', '60'])

    gait_node = Node(package='spotmicro_ag_sim', executable='gait_controller.py',
                     output='screen',
                     parameters=[{'use_sim_time': True, 'gait': gait}])

    return LaunchDescription([
        DeclareLaunchArgument('gait', default_value='crawl',
                              description='crawl | trot | stand'),
        DeclareLaunchArgument('gui', default_value='true',
                              description='set false to run Gazebo headless'),
        gzserver, gzclient, rsp, spawn, jsb, legs,
        RegisterEventHandler(OnProcessExit(target_action=legs, on_exit=[gait_node])),
    ])
