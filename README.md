# Chatwoot Desktop APP

A desktop client for Chatwoot, built with Electron.

## Features

- Cross-platform
- Proxy support
- Easy to use

Since chatwoot doesn't have an official desktop client app yet, I created one temporarily using electron. This app is a convenient way for users to be able to link chatwoot using a proxy, and supports minimizing to the system tray.

There are windows and linux versions of this program. It relies on the page service provided by the official URL: https://app.chatwoot.com.
If you build your own chatwoot server, please replace the relevant url with the url of your own chatwoot server. 
The modification is 
const url = 'https://app.chatwoot.com'; in main.js file.

For windows, we recommend vscode, npm, node.js, electron.
For Linux, we recommend the ubuntu distribution with vscode, npm, node.js and electron.


## Author

whygit2000