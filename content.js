// Tracked users and their status
const trackedUsers = {};

// Check for active status every 30 seconds
const checkInterval = 30000;

// Main checking function
function checkActiveStatus() {
    const now = new Date();

    try {
        const chatElements = document.querySelectorAll('div[role="row"]');

        chatElements.forEach(chat => {
            for (const username in trackedUsers) {
                if (chat.textContent.includes(username)) {
                    const isActiveNow = chat.textContent.includes("Active now") ||
                        chat.querySelector('svg[aria-label="Active now"]');

                    const userData = trackedUsers[username];

                    if (isActiveNow && !userData.isActive) {
                        // User became active
                        userData.isActive = true;
                        userData.activeSince = now;
                        logActivity(username, 'start', now);
                    } else if (!isActiveNow && userData.isActive) {
                        // User became inactive
                        userData.isActive = false;
                        const durationMs = now - userData.activeSince;
                        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
                        logActivity(username, 'end', now, durationHours);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Instagram Activity Tracker error:', error);
    }
}

// Log activity to storage
function logActivity(username, type, timestamp, durationHours = null) {
    const timeString = timestamp.toLocaleString();
    let logMessage;

    if (type === 'start') {
        logMessage = `${username} - start: "${timeString}"`;
    } else {
        logMessage = `${username} - start: "${new Date(trackedUsers[username].activeSince).toLocaleString()}" || close: "${timeString}" || total hours: ${durationHours}`;
    }

    // Save log to storage and send to popup
    chrome.storage.sync.get(['activityLogs'], function (data) {
        const activityLogs = data.activityLogs || [];
        activityLogs.push(logMessage);
        chrome.storage.sync.set({ activityLogs });

        // Send to popup if open
        chrome.runtime.sendMessage({
            action: 'newLog',
            log: logMessage
        });
    });
}

// Start tracking a user
function startTracking(username) {
    if (!trackedUsers[username]) {
        trackedUsers[username] = {
            isActive: false,
            activeSince: null
        };
        console.log(`Started tracking ${username}`);
    }
}

// Stop tracking a user
function stopTracking(username) {
    if (trackedUsers[username]) {
        // If user was active when stopped tracking, log the end time
        if (trackedUsers[username].isActive) {
            const now = new Date();
            const durationMs = now - trackedUsers[username].activeSince;
            const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
            logActivity(username, 'end', now, durationHours);
        }

        delete trackedUsers[username];
        console.log(`Stopped tracking ${username}`);
    }
}

// Initialize
chrome.storage.sync.get(['trackedUsers'], function (data) {
    if (data.trackedUsers) {
        data.trackedUsers.forEach(username => {
            startTracking(username);
        });
    }

    // Start the checking interval
    setInterval(checkActiveStatus, checkInterval);
    checkActiveStatus(); // Initial check
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'startTracking') {
        startTracking(request.username);
    } else if (request.action === 'stopTracking') {
        stopTracking(request.username);
    }
});