const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Tableau de bord – Plan stratégique',
    // Décommentez la ligne suivante si vous créez un assets/icon.ico
    // icon: path.join(__dirname, 'assets/icon.ico'),
  });

  // Supprime la barre de menus Electron (Fichier / Édition / …)
  Menu.setApplicationMenu(null);

  win.loadFile('index.html');

  // Autoriser les popups Microsoft OAuth (MSAL loginPopup / acquireTokenPopup)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://login.microsoftonline.com') ||
      url.startsWith('https://login.microsoft.com') ||
      url.startsWith('https://login.live.com')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          resizable: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          }
        }
      };
    }
    // Ouvre les autres liens externes dans le navigateur par défaut
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
