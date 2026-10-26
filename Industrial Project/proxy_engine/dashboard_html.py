# -*- coding: utf-8 -*-
"""
IntelliShield Web Telemetry & Threat Mitigation Dashboard
Serves the modern multi-page console from Industrial Project/dashboard/
"""

import os

DASHBOARD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dashboard")
INDEX_PATH = os.path.join(DASHBOARD_DIR, "index.html")

def get_dashboard_html() -> str:
    """Read the latest dashboard index.html markup"""
    if os.path.exists(INDEX_PATH):
        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass
    return "<html><head><title>IntelliShield</title></head><body><h1>IntelliShield Console Loading...</h1></body></html>"

# Backward-compatible global export
DASHBOARD_HTML = get_dashboard_html()
