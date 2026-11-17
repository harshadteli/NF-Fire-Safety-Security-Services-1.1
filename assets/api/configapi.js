/**
 * configapi.js
 * NF Fire Safety Security Services
 * ─────────────────────────────────
 * Central configuration for the Google Apps Script (GAS) Web App backend.
 *
 * HOW TO SET UP:
 * 1. Open gas/Code.gs in Google Apps Script editor.
 * 2. Deploy it as a Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 3. Copy the deployment URL and replace the placeholder below.
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbwiW3krp3ctQQrZoZWP5NYJUoZRFcagPwqyxPeI8GA-7kWFCsDJ2R0wPvP_pDLFXAgy0Q/exec";

// App-level constants
const APP_CONFIG = {
  appName: "NF Fire Safety Security Services",
  version: "1.1",
  notificationLeadDays: 4,       // Days before due date to trigger notification
  srNoFormat: "MM/YYYY-SEQ",     // SR No resets every month
  dateLocale: "en-IN",
  currency: "INR",
};
