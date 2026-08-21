import asyncio
import json
import cv2
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tracking.hand_tracker import HandTracker
from tracking.gesture_recognizer import GestureRecognizer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #better put the real ports here instead of giving full access to all ports
    allow_credentials=True,
    allow_methods=["*"], #GET POST PUT DELETE PATCH OPTIONS
    allow_headers=["*"],
)

cap = None
tracker = HandTracker()
recognizer = GestureRecognizer()

latest_state = None
running = True

def camera_thread_func():
    global cap, latest_state, running #I want to use and modify the 
                                    #variables cap, latest_state, and running that
                                    #exist outside this function
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    while running and cap.isOpened():
        ret, frame = cap.read()
        #ret: A Boolean indicating whether the frame was successfully captured.
        if not ret:
            continue
            
        frame = cv2.flip(frame, 1) #to get mirror image 
        results = tracker.process_frame(frame)
        landmarks = tracker.extract_landmarks(results)
        state = recognizer.recognize(landmarks)
        latest_state = state

camera_thread = threading.Thread(target=camera_thread_func, daemon=True)

@app.on_event("startup")
async def startup_event():
    camera_thread.start()

@app.on_event("shutdown")
async def shutdown_event():
    global running, cap
    running = False
    if cap:
        cap.release()

@app.websocket("/ws/tracking")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            if latest_state:
                await websocket.send_text(json.dumps(latest_state))
            await asyncio.sleep(0.033) # ~30 FPS
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
