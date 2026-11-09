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
      signal: AbortSignal.timeout(30000), // 30-second abort timeout
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[cron] Polling failed with HTTP ${res.status}:`, data);
      process.exit(1);
    }

    console.log(`[cron] Polling succeeded (HTTP ${res.status}):`, data);
  } catch (err) {
    console.error("[cron] Polling failed:", err.message || err);
    process.exit(1);
  }
}

main();
