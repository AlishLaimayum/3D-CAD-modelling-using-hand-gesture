# Gesture-Controlled 3D CAD Application: Project Overview

This document provides a comprehensive explanation of your project, how it functions currently, a guide for creating architecture diagrams, thoughts on future Spring Boot integration, and an outline for your PowerPoint presentation.

---

## 1. How Everything is Working Right Now (Current Architecture)

Your project is split into a **Python Backend** (handling computer vision and gestures) and a **React Frontend** (rendering the 3D environment and UI). They communicate in real-time using a **WebSocket**.

### The Backend (Python + FastAPI)
*   **Camera Capture (`main.py`)**: Uses OpenCV (`cv2`) to capture frames from your webcam. This runs in a separate background thread to keep the application fast.
*   **Hand Tracking (`tracking/hand_tracker.py`)**: Processes each camera frame (likely using Google MediaPipe) to extract the 3D coordinates (landmarks) of your hand.
*   **Gesture Recognition (`tracking/gesture_recognizer.py`)**: Analyzes the hand landmarks to determine your current action:
    *   **OPEN_PALM**: Fingers extended. Used for swiping/rotating the drawing plane.
    *   **FIST**: Fingers curled. Used to lock/unlock the plane so you can draw on it stably.
    *   **PINCH**: Thumb and index finger close together. Used as a "pen down" action to draw 3D lines.
    *   **IDLE**: No specific gesture recognized.
*   **Real-time Streaming**: A FastAPI WebSocket server (`ws://localhost:8000/ws/tracking`) broadcasts the current gesture state, plane lock status, and 2D cursor position to the frontend at roughly 30 Frames Per Second (FPS).

### The Frontend (React + Three.js)
*   **State Management (`store/useCadStore.js`)**: Uses **Zustand** to hold the global state: current gesture, drawn lines, active line being drawn, 3D cursor position, and plane lock status.
*   **WebSocket Hook (`hooks/useGestureInteraction.js`)**: Connects to the Python backend. It receives the 2D cursor (from the pinch) and uses a **Three.js Raycaster** to project that 2D point onto the 3D Working Plane, converting it into a precise 3D coordinate.
*   **3D Rendering (`components/Viewport.jsx`, `GeometryRenderer.jsx`)**: Uses **React Three Fiber** (a React wrapper for Three.js). It renders the 3D space, the visible working plane, the cursor (red for pinch, green for idle), and the lines you have drawn.
*   **Plane Manager (`cad/PlaneManager.js`)**: Handles the math for rotating the drawing plane when you swipe with an open palm.

---

## 2. Guide for Drawing the System Diagram

You can draw a two-part System Architecture Diagram based on this structure:

**Block 1: Python Backend (The Vision Engine)**
*   **Webcam**: Draw a camera icon. Arrow pointing to ->
*   **OpenCV Frame Capture**: Arrow pointing to ->
*   **Hand Tracker (MediaPipe)**: Arrow pointing to ->
*   **Gesture Recognizer**: Outputting (State, Lock, X/Y Cursor). Arrow pointing to ->
*   **FastAPI WebSocket Server**: The exit point of the backend.

**Block 2: Communication (The Bridge)**
*   Draw a thick double-arrowed line labeled **"WebSocket Connection (JSON @ 30fps)"** connecting the Backend to the Frontend.

**Block 3: React Frontend (The 3D Engine)**
*   **WebSocket Hook**: Receives data. Arrow pointing to ->
*   **Zustand Store**: The central brain of the frontend holding state. Arrows pointing from the store to:
*   **Three.js Raycaster**: Converts 2D X/Y to 3D X/Y/Z on the plane.
*   **React Three Fiber (Canvas)**: Renders the lines, cursor, and plane on the screen.
*   **UI Overlay**: Displays the current status and controls to the user.

---

## 3. Future Spring Boot Integration

Right now, your app is a real-time visualization tool, but it doesn't save anything permanently. **Spring Boot** is perfect for turning this into a full-fledged cloud application.

**How to integrate Spring Boot in the future:**
1.  **Database & Persistence**: You will use Spring Boot (with Spring Data JPA) connected to a database (like PostgreSQL or MySQL) to save user projects. You would send the array of 3D lines (from the Zustand store) via a standard HTTP POST request to a Spring Boot REST API to save it as a "Project".
2.  **User Authentication**: Use Spring Security to allow users to log in, save their CAD models, and load them later.
3.  **Architecture Shift**: 
    *   Your **Python Backend** remains purely for the real-time heavy lifting (Webcam -> WebSocket -> Frontend).
    *   Your **React Frontend** talks to Python via WebSocket for *drawing*.
    *   Your **React Frontend** talks to **Spring Boot** via REST APIs for *saving, loading, and user management*.

---

## 4. PowerPoint Presentation Outline

Here is a structured outline for your PPT:

**Slide 1: Title Slide**
*   Project Name: Gesture-Controlled 3D CAD Application
*   Your Name/Team

**Slide 2: Problem Statement / Objective**
*   Traditional CAD software requires complex mouse/keyboard inputs.
*   *Objective:* Create an intuitive, hands-free 3D modeling environment using computer vision and hand gestures.

**Slide 3: Key Features**
*   Real-time hand tracking via webcam.
*   Gesture recognition (Open Palm to rotate, Fist to lock, Pinch to draw).
*   Dynamic 3D workspace with a rotatable working plane.
*   Responsive UI overlay for user feedback.

**Slide 4: System Architecture (Insert your diagram here)**
*   Show the Python backend (Vision processing) and React frontend (3D rendering).
*   Highlight the WebSocket connection bridging the two.

**Slide 5: How the Backend Works**
*   Mention OpenCV for frame capture.
*   Explain the `GestureRecognizer` logic (calculating distances between finger joints to detect pinches and fists).
*   Mention FastAPI hosting the WebSocket.

**Slide 6: How the Frontend Works**
*   Mention React, Vite, and Zustand for state management.
*   Highlight **React Three Fiber (Three.js)** for rendering the 3D space.
*   *Crucial point:* Explain **Raycasting** (how the 2D pinch location is projected onto the 3D plane to draw lines).

**Slide 7: Demonstration / Screenshots**
*   Include screenshots of the app working.
*   Show the UI overlay, the red/green cursor, and a drawn line.

**Slide 8: Future Scope (The Spring Boot Integration)**
*   Explain the current limitation (data isn't saved permanently).
*   Introduce Spring Boot as the future robust backend for REST APIs.
*   Mention adding User Accounts, Database storage (PostgreSQL/MySQL), and saving/loading CAD projects.

**Slide 9: Conclusion & Q&A**
*   Summary of what was achieved.
*   Open the floor for questions.
