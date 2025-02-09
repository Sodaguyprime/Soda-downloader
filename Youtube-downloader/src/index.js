const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('src/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Ensure downloads directory exists
ipcMain.on('ensure-downloads-directory', (event) => {
    const downloadsPath = path.join(app.getPath('userData'), 'Downloads');
    fs.mkdirSync(downloadsPath, { recursive: true });
    event.reply('downloads-directory-created', downloadsPath);
});

// Handle directory selection
ipcMain.on('select-directory', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Download Location'
    });
    
    if (!result.canceled) {
        event.reply('selected-directory', result.filePaths[0]);
    }
});

// Handle quality fetching with improved error handling
ipcMain.on('fetch-qualities', (event, video_url) => {
    const pythonProcess = spawn('python', ['src/download.py', video_url, '--get-qualities']);
    
    let outputData = '';
    
    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error fetching qualities: ${data}`);
        event.reply('download-error', {
            id: 'quality-fetch',
            error: `Error fetching video qualities: ${data}`
        });
    });
    
    pythonProcess.on('close', (code) => {
        if (code === 0 && outputData) {
            try {
                const qualityData = JSON.parse(outputData);
                event.reply('qualities-fetched', qualityData.formats);
            } catch (e) {
                console.error('Error parsing qualities:', e);
                event.reply('download-error', {
                    id: 'quality-fetch',
                    error: 'Error parsing video qualities'
                });
            }
        }
    });
});

// Handle download requests with enhanced features
ipcMain.on('download-video', (event, data) => {
    const { id, url, isAudio, quality, withAudio, savePath } = data;
    
    const args = [
        'src/download.py',
        url,
        savePath,
        isAudio.toString(),
        quality || '',
        withAudio.toString()
    ];

    const pythonProcess = spawn('python', args);

    pythonProcess.stdout.on('data', (data) => {
        try {
            const progressData = JSON.parse(data);
            if (progressData.progress) {
                // Extract percentage from progress string
                const percentage = parseFloat(progressData.progress.replace('%', ''));
                event.reply('download-progress', {
                    id,
                    progress: percentage,
                    speed: progressData.speed,
                    eta: progressData.eta
                });
            }
        } catch (e) {
            // If not JSON, treat as legacy progress data
            const match = data.toString().match(/(\d+(\.\d+)?)%/);
            if (match && match[1]) {
                event.reply('download-progress', {
                    id,
                    progress: parseFloat(match[1])
                });
            }
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
        event.reply('download-error', {
            id,
            error: data.toString()
        });
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            event.reply('download-complete', { id });
        }
    });
});