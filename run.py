#!/usr/bin/env python3
"""
IntelliShield Root Entrypoint
Launches the multi-tier Layer-7 ML ingress proxy, mock upstream service,
isolation forest threat intelligence worker, and real-time telemetry dashboard.

Usage:
    python run.py --start        # Start all micro-services
    python run.py --status       # Check health of running services
    python run.py --stop         # Stop all running services
    python run.py --demo         # Run automated 4-phase attack demo
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_SCRIPT = os.path.join(BASE_DIR, "Industrial Project", "run_intellishield.py")

if not os.path.exists(TARGET_SCRIPT):
    # Fallback if run directly inside Industrial Project
    TARGET_SCRIPT = os.path.join(BASE_DIR, "run_intellishield.py")

if not os.path.exists(TARGET_SCRIPT):
    sys.stderr.write(f"Error: Could not locate run_intellishield.py at {TARGET_SCRIPT}\n")
    sys.exit(1)

# Forward execution with preserved arguments and environment
if __name__ == "__main__":
    with open(TARGET_SCRIPT, "rb") as f:
        code = compile(f.read(), TARGET_SCRIPT, "exec")
        exec(code, {
            "__name__": "__main__",
            "__file__": TARGET_SCRIPT,
            "sys": sys,
            "os": os
        })
