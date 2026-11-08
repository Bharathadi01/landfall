async function main() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET || "";

  console.log(`[cron] Polling alerts from ${appUrl}/api/alerts/poll...`);
  try {
    const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/alerts/poll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    console.log(`[cron] Response (${res.status}):`, data);
  } catch (err) {
    console.error("[cron] Polling failed:", err);
    process.exit(1);
  }
}

main();

