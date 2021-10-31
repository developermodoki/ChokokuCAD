const { app, BrowserWindow,shell } = require('electron');


app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    webPreferences.nodeIntegration = false;
  });
  contents.setWindowOpenHandler(({ url }) => {

    if (isSafeForExternalOpen(url)) {
      setImmediate(() => {
        shell.openExternal(url);
      });
    };

    return { action: 'deny' };
  });
});


function createWindow () {
    const win = new BrowserWindow({
      width: 1000,
      height: 1600,
      webPreferences: {
        sandbox:true
      }
    })
  
    win.loadFile('index.html')
  };

  app.whenReady().then(() => {
    createWindow()
  });
  
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });