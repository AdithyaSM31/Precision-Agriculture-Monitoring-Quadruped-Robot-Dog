cmake_minimum_required(VERSION 3.8)
project(spotmicro_ag_sim)
find_package(ament_cmake REQUIRED)

install(DIRECTORY urdf config launch worlds
        DESTINATION share/${PROJECT_NAME})
install(PROGRAMS scripts/gait_controller.py
        DESTINATION lib/${PROJECT_NAME})

ament_package()
