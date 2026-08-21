# Capstone Project Proposal: Gesture-Controlled 3D CAD Application

## 1. Project Title
Gesture-Controlled 3D CAD Application Using Computer Vision

## 2. Project Objective
To develop a hardware-free, intuitive 3D Computer-Aided Design (CAD) environment where users can manipulate the 3D workspace, rotate planes, and draw geometry using natural hand gestures captured via a standard webcam.

## 3. Project and Task Description

### (a) System Overview
The system utilizes a Python-based computer vision backend (OpenCV and MediaPipe) to track hand landmarks and recognize gestures in real-time. This state data is streamed via WebSockets to a React-based frontend utilizing Three.js (React Three Fiber). The frontend receives this data, uses Raycasting to project the user's hand movements into the 3D space, and renders lines and rotated planes accordingly. Future phases include integrating a Spring Boot backend for saving projects to a database.

### (b) Team Member Roles & Responsibilities
*Note: Adjust names and roles based on your actual team composition.*

*   **Team Member 1 [Name]: Computer Vision & Backend Lead**
    *   *Role:* Responsible for processing the webcam feed and extracting hand data.
    *   *Tasks:* Implement MediaPipe tracking, develop gesture recognition algorithms (calculating thresholds for pinches and fists), implement coordinate smoothing, and manage the FastAPI WebSocket server.
*   **Team Member 2 [Name]: 3D Graphics & Frontend Lead**
    *   *Role:* Responsible for the visual interface and 3D rendering.
    *   *Tasks:* Build the React Three Fiber environment, manage the Zustand state store, implement 3D raycasting logic to map 2D coordinates to 3D space, and build the UI overlays.
*   **Team Member 3 [Name]: Full-Stack Integration & Database Lead**
    *   *Role:* Responsible for the persistent storage architecture and system bridging.
    *   *Tasks:* Manage the WebSocket hook integration, develop the future Spring Boot REST APIs, design the PostgreSQL database schema for saving CAD line arrays, and handle user authentication.

### (c) Task Distribution & Execution Plan
*   **Phase 1: Foundation (All Members)** - Repository setup, tech stack familiarization, and architectural planning.
*   **Phase 2: Core Vision Engine (Member 1)** - Accurate landmark extraction and streaming.
*   **Phase 3: Core 3D Engine (Member 2)** - Rendering the environment and consuming the WebSocket stream.
*   **Phase 4: Interaction Layer (Member 1 & 2)** - Translating gestures into drawing actions via Raycasting.
*   **Phase 5: Persistence & Polish (Member 3)** - Developing the Spring Boot application, connecting the database, and integrating saving/loading functionalities with the frontend.

## 4. Expected Deliverables
1.  A functional real-time gesture tracking backend.
2.  An interactive web-based 3D workspace.
3.  Integration for drawing lines and rotating planes via gestures.
4.  Comprehensive project documentation and presentation.
