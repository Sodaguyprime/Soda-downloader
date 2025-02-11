const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('src/index.html');
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

// Update the path to include .exe extension for Windows
ipcMain.on('fetch-qualities', (event, video_url) => {
    const executablePath = path.join(__dirname,'yt_downloader.exe');
    const process = spawn(executablePath, ['fetch', video_url]);

    let outputData = '';

    process.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    process.stderr.on('data', (data) => {
        console.error(`Error fetching qualities: ${data}`);
        event.reply('download-error', { id: 'quality-fetch', error: `Error fetching qualities: ${data}` });
    });

    process.on('close', (code) => {
        if (code === 0 && outputData) {
            try {
                event.reply('qualities-fetched', JSON.parse(outputData).formats);
            } catch (e) {
                event.reply('download-error', { id: 'quality-fetch', error: 'Error parsing video qualities' });
            }
        }
    });
});

// Handle video downloads
ipcMain.on('download-video', (event, data) => {
    const { id, url, isAudio, quality, savePath } = data;
    const executablePath = path.join(__dirname,'yt_downloader.exe');
    
    let args = ['download', url, savePath, isAudio.toString(), quality || ''];

    const process = spawn(executablePath, args);

    process.stdout.on('data', (data) => {
        console.log(`Download log: ${data}`);
    });

    process.stderr.on('data', (data) => {
        console.error(`Download error: ${data}`);
        event.reply('download-error', { id, error: data.toString() });
    });

    process.on('close', (code) => {
        if (code === 0) {
            event.reply('download-complete', { id });
        }
    });
});

ipcMain.on('select-directory', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    
    if (!result.canceled) {
        event.reply('selected-directory', result.filePaths[0]);
    }
});