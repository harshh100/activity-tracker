// Instagram Activity Logger - Optimized with Custom Log Format
let monitoringState = {
    isMonitoring: false,
    targetUsername: '',
    currentStatus: null,
    checkInterval: null
};

let statusPeriod = {
    current: null,      // 'active' or 'inactive'
    startTime: null,    // When current status started
    endTime: null       // When current status ended
};

let previousPeriod = null;

let activeAGO = null;

// Initialize connection
if (window.location.hostname.includes('instagram.com')) {
    setupMessageListener();
    checkExistingSession();
}

function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'startMonitoring':
                if (!monitoringState.isMonitoring) {
                    startMonitoring(request.username);
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, message: 'Already monitoring' });
                }
                return true;

            case 'stopMonitoring':
                stopMonitoring();
                sendResponse({ success: true });
                return true;

            case 'getStatus':
                sendResponse({
                    ...monitoringState,
                    statusStartTime: statusPeriod.startTime?.toISOString()
                });
                return true;

            default:
                return false;
        }
    });
}

function checkExistingSession() {
    chrome.storage.sync.get(['isMonitoring', 'monitoringUsername'], (data) => {
        if (data.isMonitoring && data.monitoringUsername) {
            startMonitoring(data.monitoringUsername);
        }
    });
}

function startMonitoring(username) {
    // Initialize all state
    monitoringState = {
        isMonitoring: true,
        targetUsername: username.toLowerCase(),
        currentStatus: null,
        checkInterval: null
    };

    // Store monitoring state
    chrome.storage.sync.set({
        isMonitoring: true,
        monitoringUsername: username,
        activityLogs: [] // Clear previous logs
    });

    // Initialize status period tracking
    statusPeriod = {
        current: null,
        startTime: null,
        endTime: null
    };
    previousPeriod = null;

    // Start checking immediately and every 5 seconds
    monitoringState.checkInterval = setInterval(() => {
        try {
            checkActiveStatus();
        } catch (error) {
            console.error('Monitoring error:', error);
        }
    }, 5000);

    // Initial check
    checkActiveStatus();

    console.log(`Started monitoring ${monitoringState.targetUsername}`);
    const now = new Date();
    const formattedDate = now.toString().replace(/GMT[+-]\d{4} /, '');

    let lastActiveText = '';
    if (activeAGO && activeAGO.includes('ago')) {
        const agoMatch = activeAGO.match(/(\d+)\s*(m|s|h|d)\s*ago/i);
        if (agoMatch) {
            const value = parseInt(agoMatch[1]);
            const unit = agoMatch[2].toLowerCase();
            let millisecondsAgo = 0;

            switch (unit) {
                case 's': millisecondsAgo = value * 1000; break;
                case 'm': millisecondsAgo = value * 60 * 1000; break;
                case 'h': millisecondsAgo = value * 60 * 60 * 1000; break;
                case 'd': millisecondsAgo = value * 24 * 60 * 60 * 1000; break;
            }

            const lastActiveTime = new Date(now - millisecondsAgo);
            // Format time in 12-hour format without seconds
            const hours = lastActiveTime.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hours12 = hours % 12 || 12;
            const minutes = lastActiveTime.getMinutes().toString().padStart(2, '0');
            lastActiveText = ` ||\tlast active : ${hours12}:${minutes} ${ampm}`;
        }
    }
    addToLogs(`Started monitoring : ${formattedDate} ${lastActiveText} \n`);
    updatePopupStatus();
}

function stopMonitoring() {
    if (!monitoringState.isMonitoring) return;

    // Log final status before stopping
    if (statusPeriod.current !== null) {
        logStatusPeriod(true);
    }

    clearInterval(monitoringState.checkInterval);
    monitoringState.isMonitoring = false;
    chrome.storage.sync.set({ isMonitoring: false });
    console.log('Monitoring stopped');
    updatePopupStatus();
}

function checkActiveStatus() {
    if (!monitoringState.isMonitoring) return;

    const chatItems = document.querySelectorAll('[role="list"] [role="button"]');
    let foundUser = null;

    // Find target user
    for (const item of chatItems) {
        const usernameElement = item.querySelector('span[dir="auto"] span');
        if (usernameElement) {
            const currentUsername = getUsernameText(usernameElement);
            if (currentUsername === monitoringState.targetUsername) {
                foundUser = item;
                break;
            }
        }
    }

    if (!foundUser) {
        console.log(`User ${monitoringState.targetUsername} not found`);
        return;
    }

    // Check active status
    const activeStatusElement = Array.from(foundUser.querySelectorAll('span[dir="auto"]'))
        .find(el => el.textContent.includes('Active'));
    const activeText = activeStatusElement?.textContent?.toLowerCase() || '';
    activeAGO = activeText;
    const textActive = activeText.includes('active now');

    const profilePhotoContainer = foundUser.querySelector('[style*="height: 56px"][style*="width: 56px"]');
    const greenDot = profilePhotoContainer?.querySelector('.x1wyv8x2, [class*="active"], .x13fuv20');
    const dotActive = !!greenDot;

    const isActive = textActive || dotActive;

    // Handle status changes
    if (monitoringState.currentStatus !== isActive) {
        monitoringState.currentStatus = isActive;

        // If we had a previous status period, log it
        if (statusPeriod.current !== null) {
            statusPeriod.endTime = new Date();
            logStatusPeriod();
            previousPeriod = { ...statusPeriod };
        }

        // Start new status period
        statusPeriod.current = isActive ? 'active' : 'inactive';
        statusPeriod.startTime = new Date();
        statusPeriod.endTime = null;
    }
}

function logStatusPeriod(stopMonitoring = false) {
    const now = new Date();
    const endTime = stopMonitoring ? now : (statusPeriod.endTime || now);
    const duration = (endTime - statusPeriod.startTime) / 1000;
    const status = statusPeriod.current === 'active' ? '🟢ACTIVE' : '🔴INACTIVE';
    const durationText = statusPeriod.current === 'active' ? 'active' : 'inactive';

    // Calculate last active time if available
    let lastActiveText = '';
    if (activeAGO && activeAGO.includes('ago')) {
        const agoMatch = activeAGO.match(/(\d+)\s*(m|s|h|d)\s*ago/i);
        if (agoMatch) {
            const value = parseInt(agoMatch[1]);
            const unit = agoMatch[2].toLowerCase();
            let millisecondsAgo = 0;

            switch (unit) {
                case 's': millisecondsAgo = value * 1000; break;
                case 'm': millisecondsAgo = value * 60 * 1000; break;
                case 'h': millisecondsAgo = value * 60 * 60 * 1000; break;
                case 'd': millisecondsAgo = value * 24 * 60 * 60 * 1000; break;
            }

            const lastActiveTime = new Date(now - millisecondsAgo);
            // Format time in 12-hour format without seconds
            const hours = lastActiveTime.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hours12 = hours % 12 || 12;
            const minutes = lastActiveTime.getMinutes().toString().padStart(2, '0');
            lastActiveText = ` ||\tlast active : ${hours12}:${minutes} ${ampm}`;
        }
    }

    let message = `${monitoringState.targetUsername}: ${status}\t||\t[ ${formatDuration(duration)} ]\t|| START : ${formatTime(statusPeriod.startTime)} || `;

    if (stopMonitoring) {
        message += `Monitoring stopped : ${formatTime(endTime)}${lastActiveText}`;
    } else {
        message += `END : ${formatTime(endTime)}${lastActiveText}`;
    }

    addToLogs(message);
}

function addToLogs(message) {
    chrome.storage.sync.get(['activityLogs'], (data) => {
        const logs = data.activityLogs || [];
        logs.push(message);
        chrome.storage.sync.set({ activityLogs: logs });

        chrome.runtime.sendMessage({
            action: 'updateLogs',
            logs: logs
        }).catch(() => { });
    });

    console.log(message);
}

function updatePopupStatus() {
    chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: {
            isMonitoring: monitoringState.isMonitoring,
            targetUsername: monitoringState.targetUsername,
            currentStatus: monitoringState.currentStatus,
            statusStartTime: statusPeriod.startTime?.toISOString(),
            lastUpdate: new Date().toISOString()
        }
    }).catch(() => { });
}

function getUsernameText(usernameElement) {
    if (!usernameElement) return '';

    // If it's a simple text node
    if (usernameElement.textContent && !usernameElement.querySelector('img')) {
        return usernameElement.textContent.toLowerCase();
    }

    // If it contains emoji images
    let username = '';
    const nodes = usernameElement.childNodes;

    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            username += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
            username += node.getAttribute('alt') || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle nested spans that might contain more emojis
            username += getUsernameText(node);
        }
    }

    return username.toLowerCase().trim();
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [
        hours > 0 ? `${hours}h ` : '',
        minutes > 0 ? `${minutes}m ` : '',
        `${secs}s`
    ].join('').trim();
}