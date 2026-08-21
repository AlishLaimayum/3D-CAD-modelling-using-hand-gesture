# Project Report: Gesture-Controlled 3D CAD Application

## 1. Problem Identification
Traditional Computer-Aided Design (CAD) software relies heavily on 2D input devices (mice, trackpads, and keyboards) to manipulate 3D environments. This creates several challenges:
*   **Steep Learning Curve**: Users must learn complex shortcuts and camera controls to navigate 3D space effectively.
*   **Lack of Intuitive Interaction**: Humans naturally interact with 3D objects using their hands. Translating 3D intent through a 2D mouse lacks natural spatial mapping.
*   **Hardware Dependency**: Specialized hardware (like 3D mice or drawing tablets) is often required for high-end modeling, limiting accessibility.

## 2. Solution to the Problem
This project proposes an innovative, hardware-free solution: a **Gesture-Controlled 3D CAD Application**. 
By utilizing standard webcams and advanced computer vision, the application allows users to manipulate a 3D workspace using natural hand gestures. 
*   **Intuitive Mapping**: Real-world hand movements directly correspond to 3D workspace actions (e.g., an Open Palm to swipe and rotate the canvas, a Fist to lock the drawing plane, and a Pinch to draw 3D lines).
*   **Hardware Independence**: It requires only a standard webcam and browser, eliminating the need for expensive peripherals.
*   **Real-time Performance**: Utilizing lightweight WebSocket communication ensures that gesture tracking is rendered in the 3D space with minimal latency.

## 3. Tools and Techniques to be Used
The project is built on a modern, decoupled architecture:
*   **Computer Vision & Backend (Python)**:
    *   **OpenCV (`cv2`)**: For capturing webcam video streams.
    *   **Google MediaPipe**: For real-time, highly accurate hand landmark tracking.
    *   **FastAPI**: To host a high-performance WebSocket server for streaming coordinate data.
*   **3D Rendering & Frontend (JavaScript/React)**:
    *   **React & Vite**: For a fast, responsive user interface.
    *   **Three.js & React Three Fiber**: For rendering the 3D grid, drawing planes, and user-generated geometry.
    *   **Zustand**: For lightweight state management (tracking gesture states and 3D cursor coordinates).
    *   **Raycasting**: A mathematical technique used to project the 2D webcam hand coordinates onto a 3D plane in the virtual environment.
*   **Future Persistence Layer**:
    *   **Spring Boot (Java)**: To build RESTful APIs for user authentication and saving/loading project files.
    *   **PostgreSQL/MySQL**: Relational database to store user CAD data.

## 4. Timeline of the Project
*(Note: Adjust the specific dates/months according to your academic calendar)*

*   **Phase 1 (Weeks 1-2): Research & Environment Setup**
    *   Literature review on hand tracking.
    *   Setup Python backend and React frontend repositories.
*   **Phase 2 (Weeks 3-5): Vision Engine Development**
    *   Implement MediaPipe hand tracking.
    *   Develop the gesture recognition algorithm (Pinch, Fist, Open Palm calculations).
*   **Phase 3 (Weeks 6-8): 3D Environment & Integration**
    *   Build the React Three Fiber 3D viewport.
    *   Establish WebSocket connection.
    *   Implement Raycasting to translate 2D pinch coordinates into 3D lines.
*   **Phase 4 (Weeks 9-10): Spring Boot Integration (Future Scope)**
    *   Develop Spring Boot backend for user authentication.
    *   Create database schemas for saving 3D line arrays.
*   **Phase 5 (Weeks 11-12): Testing & Documentation**
    *   System testing for latency and accuracy.
    *   Finalize project report and presentation.
