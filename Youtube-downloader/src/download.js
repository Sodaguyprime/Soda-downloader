const { ipcRenderer } = require('electron');

let currentQualities = [];
let downloads = new Map();
let downloadPath = './Downloads';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.send('ensure-downloads-directory');
    setupEventListeners();
});

function setupEventListeners() {
    // URL input listener for quality fetching
    const urlInput = document.getElementById('link');
    let fetchTimeout;
    urlInput.addEventListener('input', () => {
        clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(fetchQualities, 500);
    });

    // Format switch listener
    document.getElementById('formatSwitch').addEventListener('change', handleFormatSwitch);

    // Audio switch listener
    document.getElementById('audioSwitch').addEventListener('change', handleAudioSwitch);
}

async function fetchQualities() {
    const video_url = document.getElementById('link').value;
    if (!video_url || (!video_url.includes('youtube.com') && !video_url.includes('youtu.be'))) {
        return;
    }

    const qualitySelect = document.getElementById('qualitySelect');
    qualitySelect.innerHTML = '<option value="">FETCHING QUALITIES...</option>';
    qualitySelect.style.display = 'block';
    
    // Show loading state
    qualitySelect.classList.add('loading');
    
    ipcRenderer.send('fetch-qualities', video_url);
}

// Update the qualities response handler
ipcRenderer.on('qualities-fetched', (event, qualities) => {
    const qualitySelect = document.getElementById('qualitySelect');
    currentQualities = qualities;
    
    // Filter and sort qualities
    const filteredQualities = qualities.filter(q => 
        q.height && // Must have height
        q.vcodec !== 'none' && // Must have video codec
        q.acodec !== 'none' && // Must have audio codec
        q.ext === 'mp4' // Must be MP4
    ).sort((a, b) => b.height - a.height);
    
    // Generate options
    qualitySelect.innerHTML = [
        '<option value="">SELECT QUALITY</option>',
        ...filteredQualities.map(q => {
            const label = `${q.height}p${q.fps > 30 ? ` ${q.fps}fps` : ''} ${q.filesize ? `(${formatFileSize(q.filesize)})` : ''}`;
            return `<option value="${q.format_id}">${label}</option>`;
        })
    ].join('');
    
    qualitySelect.classList.remove('loading');
});

// Update format switch handler
function handleFormatSwitch(e) {
    const isAudio = e.target.checked;
    const qualitySelect = document.getElementById('qualitySelect');
    const audioSwitchContainer = document.getElementById('audioToggleContainer');
    
    if (isAudio) {
        qualitySelect.style.display = 'none';
        audioSwitchContainer.style.display = 'none';
    } else {
        qualitySelect.style.display = 'block';
        audioSwitchContainer.style.display = 'flex';
        fetchQualities();
    }
}
function handleAudioSwitch(e) {
    const withAudio = e.target.checked;
    // You might want to update quality options based on audio preference
    fetchQualities();
}

// Handle qualities response
ipcRenderer.on('qualities-fetched', (event, qualities) => {
    const qualitySelect = document.getElementById('qualitySelect');
    currentQualities = qualities;
    
    // Sort qualities by resolution
    qualities.sort((a, b) => (b.height || 0) - (a.height || 0));
    
    qualitySelect.innerHTML = qualities.map(q => {
        const label = q.height ? 
            `${q.height}p${q.fps > 30 ? ` ${q.fps}fps` : ''} - ${q.ext.toUpperCase()}` :
            `${q.format_note || 'Unknown'} - ${q.ext.toUpperCase()}`;
            
        return `<option value="${q.format_id}">${label} ${q.filesize ? `(${formatFileSize(q.filesize)})` : ''}</option>`;
    }).join('');
});

function senddata() {
    const video_url = document.getElementById('link').value;
    if (!video_url) {
        showNotification('Please enter a valid YouTube URL');
        return;
    }

    const downloadId = `download-${Date.now()}`;
    const isAudio = document.getElementById('formatSwitch').checked;
    const withAudio = document.getElementById('audioSwitch').checked;
    const selectedQuality = document.getElementById('qualitySelect').value;

    addDownloadItem(downloadId, video_url);

    ipcRenderer.send('download-video', {
        id: downloadId,
        url: video_url,
        isAudio,
        quality: selectedQuality,
        withAudio,
        savePath: downloadPath
    });

    // Clear input but keep format settings
    document.getElementById('link').value = '';
}

function addDownloadItem(id, url) {
    const downloadsList = document.getElementById('downloadsList');
    const downloadItem = document.createElement('div');
    downloadItem.className = 'download-item';
    downloadItem.id = id;

    const videoId = extractVideoId(url);
    const title = videoId || 'Unknown video';

    downloadItem.innerHTML = `
        <div class="title">${title}</div>
        <div class="pixel-progress">
            <div class="pixel-progress-fill"></div>
        </div>
        <div class="status">Starting download...</div>
        <div class="info"></div>
    `;

    downloadsList.insertBefore(downloadItem, downloadsList.firstChild);
    downloads.set(id, { url, progress: 0 });
}

// Event listeners for download progress and completion
ipcRenderer.on('download-progress', (event, data) => {
    updateDownloadProgress(data);
});

ipcRenderer.on('download-error', (event, data) => {
    handleDownloadError(data);
});

ipcRenderer.on('download-complete', (event, data) => {
    handleDownloadComplete(data);
});

function updateDownloadProgress(data) {
    const { id, progress, speed, eta } = data;
    const downloadItem = document.getElementById(id);
    if (!downloadItem) return;

    const progressBar = downloadItem.querySelector('.pixel-progress-fill');
    const status = downloadItem.querySelector('.status');
    const info = downloadItem.querySelector('.info');

    progressBar.style.width = `${progress}%`;
    status.textContent = `Downloading: ${progress.toFixed(1)}%`;
    
    if (speed && eta) {
        info.textContent = `Speed: ${speed} | ETA: ${eta}`;
    }

    // Add loading animation class
    progressBar.classList.add('loading');
}

function handleDownloadError(data) {
    const { id, error } = data;
    const downloadItem = document.getElementById(id);
    if (!downloadItem) return;

    downloadItem.classList.add('error');
    downloadItem.querySelector('.status').textContent = 'Error!';
    downloadItem.querySelector('.info').textContent = error;
    
    // Remove loading animation
    const progressBar = downloadItem.querySelector('.pixel-progress-fill');
    progressBar.classList.remove('loading');
}

function handleDownloadComplete(data) {
    const { id } = data;
    const downloadItem = document.getElementById(id);
    if (!downloadItem) return;

    downloadItem.classList.add('complete');
    downloadItem.querySelector('.status').textContent = 'Download Complete!';
    downloadItem.querySelector('.info').textContent = 'File saved successfully';
    
    // Remove loading animation
    const progressBar = downloadItem.querySelector('.pixel-progress-fill');
    progressBar.classList.remove('loading');
    
    // Play completion sound
    playCompletionSound();
}

// Settings and directory selection
function openSettings() {
    document.getElementById('settingsOverlay').style.display = 'block';
    document.getElementById('settingsModal').style.display = 'block';
}

function closeSettings() {
    document.getElementById('settingsOverlay').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'none';
}

function selectDownloadPath() {
    ipcRenderer.send('select-directory');
}

ipcRenderer.on('selected-directory', (event, path) => {
    if (path) {
        downloadPath = path;
        document.getElementById('currentPath').textContent = `Current: ${path}`;
        // Save to local storage
        localStorage.setItem('downloadPath', path);
    }
});

// Initialize download path from local storage
if (localStorage.getItem('downloadPath')) {
    downloadPath = localStorage.getItem('downloadPath');
    document.getElementById('currentPath').textContent = `Current: ${downloadPath}`;
}

// Clear downloads list
function clearDownloads() {
    const downloadsList = document.getElementById('downloadsList');
    // Only clear completed downloads
    const completedDownloads = downloadsList.querySelectorAll('.download-item.complete');
    completedDownloads.forEach(item => item.remove());
}

// Utility functions
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'pixel-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after animation
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function playCompletionSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdYiXp7Cbl4NydHaBjJeepZ2TgHly...');  // Base64 encoded short beep sound
    audio.volume = 0.5;
    audio.play().catch(() => {}); // Ignore autoplay restrictions
}

// Handle multiple concurrent downloads
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;

function checkDownloadQueue() {
    const pendingDownloads = document.querySelectorAll('.download-item:not(.downloading):not(.complete):not(.error)');
    
    while (activeDownloads < MAX_CONCURRENT_DOWNLOADS && pendingDownloads.length > 0) {
        const nextDownload = pendingDownloads[0];
        startDownload(nextDownload.id);
        activeDownloads++;
    }
}

function startDownload(downloadId) {
    const downloadItem = document.getElementById(downloadId);
    if (!downloadItem) return;
    
    downloadItem.classList.add('downloading');
    // Download logic is handled in the main senddata() function
}

// Update active downloads count when a download completes or errors
ipcRenderer.on('download-complete', (event, data) => {
    activeDownloads--;
    checkDownloadQueue();
});

ipcRenderer.on('download-error', (event, data) => {
    activeDownloads--;
    checkDownloadQueue();
});

// Export functions for use in HTML
window.senddata = senddata;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.selectDownloadPath = selectDownloadPath;
window.clearDownloads = clearDownloads;