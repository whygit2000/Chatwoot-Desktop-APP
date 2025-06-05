// main.js
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const url = 'https://app.chatwoot.com';
const fs = require('fs');

// Disable GPU hardware acceleration
// This can solve rendering issues on some systems, especially Linux
app.commandLine.appendSwitch('disable-gpu');

let mainWindow;
let tray;
let isQuitting = false;
let proxyWindow = null;

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const appVersion = packageJson.version;

// Function to create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // Set userAgent first
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });



  // Load Chatwoot web page
  mainWindow.loadURL(url);

  // Intercept all new window events, open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Triggered when the window is closed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  // Automatically read proxy config on startup
  const { enabled, host, port } = readProxyConfig();
  if (enabled && host && port) {
    const proxyRule = `socks5://${host}:${port}`;
    mainWindow.webContents.session.setProxy({ proxyRules: proxyRule });
  } else {
    mainWindow.webContents.session.setProxy({ proxyRules: '' });
  }
}

// Create system tray icon
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Chatwoot', 
      click: () => {
        mainWindow.show();
      } 
    },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('Chatwoot');
  tray.setContextMenu(contextMenu);
  
  // Show window when clicking the tray icon
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}


// Create window after app initialization is complete
app.whenReady().then(() => {
  // 1. Add no-sandbox argument first (Linux only)
  // if (process.platform === 'linux') {
  //   app.commandLine.appendSwitch('no-sandbox');
  // }

  createWindow();
  createTray();

  // ====== Keep default menu and insert Proxy menu item before Help ======
  // Get default menu template
  const defaultTemplate = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { 
      role: 'help',
      submenu: [
        {
          label: 'About',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: 'About Chatwoot',
              message: `chatwoot version: ${appVersion}\nAuthor: whygit2000\n\nThis is a desktop client designed for Chatwoot. Since it was designed temporarily, crashes are normal.Try to reload if the page is blank.\n\nIf you have any questions or suggestions, please contact me.`,
              buttons: ['Close']
            });
          }
        }
      ]
    }
  ];

  // Find Help menu index
  const helpIndex = defaultTemplate.findIndex(item => item.role === 'help');

  // Construct Proxy menu item
  const proxyMenu = {
    label: 'Proxy',
    click: () => {
      if (proxyWindow) {
        proxyWindow.focus();
        return;
      }
      const { enabled, host, port } = readProxyConfig();

      proxyWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: mainWindow,
        modal: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        frame: false,
        title: 'Proxy Settings',
        autoHideMenuBar: true,
        menu: null,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      proxyWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <html>
        <head>
          <style>
            .switch {
              position: relative;
              display: inline-block;
              width: 48px;
              height: 24px;
              vertical-align: middle;
              margin-right: 10px;
            }
            .switch input {
              opacity: 0;
              width: 0;
              height: 0;
            }
            .slider {
              position: absolute;
              cursor: pointer;
              top: 0; left: 0; right: 0; bottom: 0;
              background-color: #ccc;
              transition: .4s;
              border-radius: 24px;
            }
            .slider:before {
              position: absolute;
              content: "";
              height: 18px;
              width: 18px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: .4s;
              border-radius: 50%;
            }
            input:checked + .slider {
              background-color: #4caf50;
            }
            input:checked + .slider:before {
              transform: translateX(24px);
            }
            #toggleLabel {
              font-size: 15px;
              vertical-align: middle;
            }
          </style>
        </head>
        <body style="font-family:sans-serif;">
          <h2>SOCKS5 Proxy Settings</h2>
          <div style="margin-bottom:10px;">
            <label class="switch">
              <input type="checkbox" id="toggle" ${enabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span id="toggleLabel">${enabled ? 'Proxy Enabled' : 'Proxy Disabled'}</span>
          </div>
          <form id="proxyForm">
            <label>Proxy Address: <input id="host" type="text" placeholder="e.g. 127.0.0.1" value="${host || ''}"></label><br><br>
            <label>Port: <input id="port" type="number" placeholder="e.g. 1080" value="${port || ''}"></label><br><br>
            <button type="submit">Apply</button>
            <button type="button" onclick="window.close()">Close</button>
          </form>
          <script>
            const { ipcRenderer } = require('electron');
            const toggle = document.getElementById('toggle');
            const toggleLabel = document.getElementById('toggleLabel');
            toggle.onchange = function() {
              toggleLabel.innerText = toggle.checked ? 'Proxy Enabled' : 'Proxy Disabled';
              ipcRenderer.send('toggle-proxy', { enabled: toggle.checked });
            };
            document.getElementById('proxyForm').onsubmit = function(e) {
              e.preventDefault();
              const host = document.getElementById('host').value;
              const port = document.getElementById('port').value;
              ipcRenderer.send('set-proxy', { host, port });
            };
          </script>
        </body>
        </html>
      `));

      proxyWindow.on('closed', () => {
        proxyWindow = null;
      });
    }
  };

  // Insert Proxy before Help
  if (helpIndex !== -1) {
    defaultTemplate.splice(helpIndex, 0, proxyMenu);
  } else {
    defaultTemplate.push(proxyMenu);
  }

  // Set new application menu
  const menu = Menu.buildFromTemplate(defaultTemplate);
  Menu.setApplicationMenu(menu);

  // macOS specific behavior: do not quit app when all windows are closed
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit app when all windows are closed (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the app is about to quit
app.on('before-quit', () => {
  isQuitting = true;
});

const proxyConfigPath = path.join(app.getPath('userData'), 'proxy.json'); // Recommended

function readProxyConfig() {
  try {
    if (!fs.existsSync(proxyConfigPath)) {
      const defaultConfig = { enabled: false, host: '127.0.0.1', port: '1080' }; // Default values
      fs.writeFileSync(proxyConfigPath, JSON.stringify(defaultConfig), 'utf-8');
      return defaultConfig;
    }
    const config = JSON.parse(fs.readFileSync(proxyConfigPath, 'utf-8'));
    return { enabled: !!config.enabled, host: config.host || '127.0.0.1', port: config.port || '1080' };
  } catch (e) {
    dialog.showMessageBoxSync({ type: 'warning', message: 'Failed to read proxy.json, will connect directly to the network' });
    return { enabled: false, host: '127.0.0.1', port: '1080' };
  }
}

function saveProxyConfig(config) {
  fs.writeFileSync(proxyConfigPath, JSON.stringify(config), 'utf-8');
}

// Listen for proxy setting events
ipcMain.on('toggle-proxy', (event, { enabled }) => {
  let config = readProxyConfig();
  config.enabled = enabled;
  saveProxyConfig(config);
  // Apply or disable proxy in real time
  if (mainWindow) {
    if (enabled && config.host && config.port) {
      const proxyRule = `socks5://${config.host}:${config.port}`;
      mainWindow.webContents.session.setProxy({ proxyRules: proxyRule });
    } else {
      mainWindow.webContents.session.setProxy({ proxyRules: '' });
    }
  }
});

ipcMain.on('set-proxy', (event, { host, port }) => {
  let config = readProxyConfig();
  config.host = host;
  config.port = port;
  saveProxyConfig(config);
  // If switch is on, apply proxy
  if (config.enabled && mainWindow) {
    const proxyRule = `socks5://${host}:${port}`;
    mainWindow.webContents.session.setProxy({ proxyRules: proxyRule }, () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: `Proxy set to: ${proxyRule}`,
        buttons: ['OK']
      });
    });
  } else if (mainWindow) {
    mainWindow.webContents.session.setProxy({ proxyRules: '' });
  }
});