import os
import sys
import time
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dashboard'))
OUT_DIR = os.path.join(DASHBOARD_DIR, 'screenshots', 'webpage')
os.makedirs(OUT_DIR, exist_ok=True)
PORT = 8088

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)

    def log_message(self, format, *args):
        pass # Silence access logs

def start_server():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), CustomHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server

def run():
    print(f"Starting dashboard HTTP server on http://127.0.0.1:{PORT} serving {DASHBOARD_DIR}")
    server = start_server()
    time.sleep(0.8)

    routes = [
        ("01_overview", "#/", "Overview Dashboard"),
        ("02_live_console", "#/console", "Live Telemetry & Attack Console"),
        ("03_architecture", "#/architecture", "Microservice Topology & Rust Engine"),
        ("04_global_view", "#/globe", "Global Threat Radar & Autonomous Interception"),
        ("05_benchmarks", "#/benchmarks", "Empirical Benchmarks & Latency Evaluation"),
        ("06_documentation", "#/docs", "Technical Engineering Documentation"),
        ("07_research", "#/research", "Academic Research Monograph & Prior Art Matrix")
    ]

    with sync_playwright() as p:
        print("Launching Chromium browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=2
        )
        page = context.new_page()

        for filename_prefix, route, title in routes:
            url = f"http://127.0.0.1:{PORT}/{route}"
            print(f"Capturing: {title} ({url}) ...")
            page.goto(url, wait_until="networkidle")
            time.sleep(2.0) # Allow Chart.js, canvas, and layout to settle

            screenshot_path = os.path.join(OUT_DIR, f"{filename_prefix}_fullpage.png")
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"  -> Saved full-page: {screenshot_path}")

            # Special detail captures for verification
            if filename_prefix == "01_overview":
                # Hover over "Launch Live Console" button to verify contrast
                btn = page.query_selector("a[href='#/console'].btn-primary") or page.query_selector(".btn-primary")
                if btn:
                    btn.hover()
                    time.sleep(0.4)
                    hover_path = os.path.join(OUT_DIR, "01b_overview_launch_btn_hover.png")
                    page.screenshot(path=hover_path, full_page=False)
                    print(f"  -> Saved button hover capture: {hover_path}")

            if filename_prefix == "03_architecture":
                # Click on first blueprint card to test zoom and pan modal
                blueprint_card = page.query_selector(".blueprint-card-trigger")
                if blueprint_card:
                    blueprint_card.click()
                    time.sleep(0.8)
                    # Click modal image to zoom in at coordinates (x: 400, y: 300)
                    modal_img = page.query_selector("#blueprintModalImg")
                    if modal_img:
                        box = modal_img.bounding_box()
                        if box:
                            # Click at 65% width, 45% height
                            page.mouse.click(box["x"] + box["width"] * 0.65, box["y"] + box["height"] * 0.45)
                            time.sleep(0.6)
                    modal_path = os.path.join(OUT_DIR, "03b_architecture_blueprint_zoom_modal.png")
                    page.screenshot(path=modal_path, full_page=False)
                    print(f"  -> Saved blueprint modal zoom capture: {modal_path}")
                    # Close modal
                    close_btn = page.query_selector("#blueprintModalClose")
                    if close_btn:
                        close_btn.click()
                        time.sleep(0.3)

        browser.close()

    print("\nAll webpage screenshots successfully generated!")
    server.shutdown()

if __name__ == '__main__':
    run()
