const axios = require("axios");
require("dotenv").config();

const API_URL = "http://localhost:5000/api";

async function testEndShift() {
  try {
    // Login first
    console.log("Logging in...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: "admin",
      password: "admin123"
    });

    if (!loginRes.data.success) {
      console.error("Login failed:", loginRes.data);
      return;
    }

    const token = loginRes.data.data.token;
    console.log("Login successful");

    // Get active shift
    console.log("\nFetching active shift...");
    const shiftRes = await axios.get(`${API_URL}/shifts/active`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!shiftRes.data.success || !shiftRes.data.data) {
      console.log("No active shift found or error:", shiftRes.data);
      return;
    }

    const shift = shiftRes.data.data;
    console.log("Active shift:", shift.uuid);

    // Try to end shift
    console.log("\nEnding shift...");
    const endRes = await axios.post(
      `${API_URL}/shifts/${shift.uuid}/end`,
      {
        closingNotes: "Test end shift from script"
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log("End shift response:", JSON.stringify(endRes.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error("API Error:", error.response.status, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
  }
}

testEndShift();
