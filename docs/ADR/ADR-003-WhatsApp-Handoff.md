# ADR-003: WhatsApp Official Composer Handoff vs DOM Automation

## Context
Third-party tools frequently risk customer phone number bans by injecting DOM scripts, automating WhatsApp Web buttons, or simulating keystrokes via Playwright/Puppeteer. These break when WhatsApp updates its UI and violate Terms of Service.

## Decision
The system functions exclusively as a **Human-in-the-Loop Communication OS**:
1. We generate legitimate `wa.me/<number>?text=<encoded>` official deep links.
2. The user's action opens WhatsApp where the human reviews the message and manually clicks Send.
3. The platform records distinct lifecycle states: `PREPARED` → `OPENED` → `USER CONFIRMED SENT`.
4. The application strictly forbids DOM clicking, QR-session hijacking, simulated human delays for bot evasion, or unofficial reverse-engineered APIs.

## Status
Accepted.
