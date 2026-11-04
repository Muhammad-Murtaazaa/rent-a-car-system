import os
import sys
import time
import webbrowser
import threading
import subprocess
import uvicorn

def build_frontend():
    """Offline app serves frontend/dist — rebuild so JSX edits actually ship."""
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
    if not os.path.isdir(frontend_dir):
        return
    print("Building frontend assets...")
    try:
        subprocess.run(
            ["npm", "run", "build"],
            cwd=frontend_dir,
            check=True,
            shell=True,
        )
        print("Frontend build complete.")
    except Exception as e:
        print(f"Frontend build skipped/failed ({e}). Using existing dist if present.")

def start_backend():
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8080, log_level="info")

def run_backup():
    try:
        from backend.main import run_db_backup
        run_db_backup()
        print("SQLite backup completed.")
    except Exception as e:
        print(f"Backup skipped ({e}).")

if __name__ == "__main__":
    print("==============================================================")
    print("           RENT A CAR MANAGEMENT SYSTEM (OFFLINE)            ")
    print("==============================================================")
    print("Initializing local SQLite schemas and starting engine...")
    print("Demo auth ON (local). For internet deploy set ALLOW_DEMO_AUTH=0")

    build_frontend()
    
    # Start the backend in a daemon thread
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # Allow 2 seconds for server bootup
    time.sleep(2)
    
    # Open app in local web browser
    app_url = "http://127.0.0.1:8080"
    print(f"Launching web view at: {app_url}")
    webbrowser.open(app_url)
    
    print("\n[Running Status] Active. Press Ctrl+C in this console to terminate.")
    
    # Sleep main loop to keep active
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nHalting server processes. Backing up SQLite file...")
        run_backup()
        print("Shut down completed successfully.")
